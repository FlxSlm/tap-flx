<?php

namespace App\Services\Automatic;

use App\Http\Controllers\SourceImportController;
use App\Models\AutomaticIngestion;
use App\Models\EmailConnection;
use App\Models\InvestmentAccount;
use App\Models\User;
use App\Services\Integrity\SourceImporter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AutomaticSync
{
    public function __construct(private GmailClient $gmail, private AttachmentParser $parser) {}

    public function active(InvestmentAccount $account): bool
    {
        return $account->acquisition_mode === 'AUTOMATIC' && $account->email_connection_id
            && EmailConnection::whereKey($account->email_connection_id)->where('user_id', $account->user_id)->where('is_active', true)->exists();
    }

    public function sync(InvestmentAccount $account): array
    {
        $lease = (string) Str::uuid();
        $account = DB::transaction(function () use ($account, $lease) {
            $account = InvestmentAccount::with('platform')->whereKey($account->id)->lockForUpdate()->firstOrFail();
            if (! $this->active($account)) {
                throw new AutomaticFailure('SYNC_PAUSED');
            }
            if ($account->sync_lease && $account->sync_started_at > now()->subMinutes(15)->toDateTimeString()) {
                throw new AutomaticFailure('SYNC_BUSY');
            }
            $account->forceFill(['sync_lease' => $lease, 'sync_started_at' => now(), 'sync_status' => 'SYNCING'])->save();

            return $account;
        });
        $status = 'GOOGLE_UNAVAILABLE';
        try {
            $provider = strtoupper($account->platform->code);
            $senders = config('automatic.senders.'.$provider, []);
            $label = config('automatic.gmail_label');
            if (! $senders || ! preg_match('/\A[A-Za-z0-9_-]{1,80}\z/', $label)) {
                throw new AutomaticFailure('SOURCE_FILTER_REQUIRED');
            }
            $connection = EmailConnection::findOrFail($account->email_connection_id);
            $token = $this->gmail->access($connection);
            $query = ['q' => 'label:'.$label.' newer_than:90d', 'maxResults' => 5];
            if ($account->automatic_page_token) {
                $query['pageToken'] = Crypt::decryptString($account->automatic_page_token);
            }
            $list = $this->gmail->request($token, 'messages', $query);
            $counts = ['reviewed' => 0, 'replayed' => 0, 'filtered' => 0];
            $truncated = false;
            foreach (array_slice($list['messages'] ?? [], 0, 5) as $entry) {
                $id = (string) ($entry['id'] ?? '');
                if (! preg_match('/\A[a-zA-Z0-9_-]{1,180}\z/', $id)) {
                    continue;
                }
                // Exclude body.data, snippet and filenames. Headers exist only in request memory.
                $partFields = 'mimeType,body(attachmentId,size)';
                for ($depth = 0; $depth < 5; $depth++) {
                    $partFields = 'mimeType,body(attachmentId,size),parts('.$partFields.')';
                }
                $message = $this->gmail->request($token, 'messages/'.$id, ['format' => 'full', 'fields' => 'id,sizeEstimate,payload(headers(name,value),'.$partFields.')']);
                $from = collect($message['payload']['headers'] ?? [])->first(fn ($h) => strtolower($h['name'] ?? '') === 'from')['value'] ?? '';
                preg_match('/(?:<|\A)\s*([^\s<>]+@[^\s<>]+)\s*>?\z/', trim($from), $match);
                $sender = strtolower($match[1] ?? '');
                if (! in_array($sender, array_map('strtolower', $senders), true)) {
                    $counts['filtered']++;

                    continue;
                }
                $parts = [];
                $walk = function (array $part, int $depth = 0) use (&$walk, &$parts) {
                    if ($depth > 12 || count($parts) >= 10) {
                        return;
                    }
                    if (($part['mimeType'] ?? '') === 'application/pdf' && isset($part['body']['attachmentId'])) {
                        $parts[] = ['attachment' => $part['body']['attachmentId'], 'size' => $part['body']['size'] ?? 0];
                    }
                    foreach (array_slice($part['parts'] ?? [], 0, 20) as $child) {
                        $walk($child, $depth + 1);
                    }
                };
                $walk($message['payload'] ?? []);
                if (! $parts) {
                    $parts[] = ['attachment' => null, 'size' => 0];
                }
                foreach ($parts as $part) {
                    $hash = hash('sha256', $connection->id.'|'.$id.'|'.$part['attachment']);
                    $old = AutomaticIngestion::where('investment_account_id', $account->id)->where('message_part_hash', $hash)->first();
                    if ($old && ($old->status === 'IMPORTED' || $old->policy_epoch === $account->acquisition_epoch)) {
                        $counts['replayed']++;

                        continue;
                    }
                    if ($counts['reviewed'] >= 5) {
                        $truncated = true;
                        break 2;
                    }
                    $publicId = $old?->public_id ?? (string) Str::uuid();
                    $locator = ['message' => $id, 'attachment' => $part['attachment']];
                    $parsed = $part['attachment'] === null ? ['status' => 'UNSUPPORTED_EMAIL']
                        : ($part['size'] > 20 * 1024 * 1024 ? ['status' => 'DOCUMENT_LIMIT'] : $this->parse($token, $locator, $account, $publicId));
                    DB::transaction(function () use ($account, $hash, $publicId, $locator, $parsed) {
                        $current = InvestmentAccount::whereKey($account->id)->lockForUpdate()->firstOrFail();
                        $this->assertCurrent($current, $account->acquisition_epoch, $account->email_connection_id);
                        $ingestion = AutomaticIngestion::firstOrNew(['investment_account_id' => $account->id, 'message_part_hash' => $hash]);
                        if ($ingestion->status === 'IMPORTED') {
                            return;
                        }
                        $ingestion->fill(['public_id' => $publicId, 'email_connection_id' => $account->email_connection_id, 'policy_epoch' => $account->acquisition_epoch,
                            'locator' => $locator, 'status' => $parsed['status'], 'structured_payload' => $parsed['payload'] ?? null])->save();
                    });
                    $counts['reviewed']++;
                }
            }
            $status = $truncated || isset($list['nextPageToken']) ? 'MORE_AVAILABLE' : 'REVIEW_REQUIRED';
            DB::transaction(function () use ($account, $list, $status, $truncated) {
                $current = InvestmentAccount::whereKey($account->id)->lockForUpdate()->firstOrFail();
                $this->assertCurrent($current, $account->acquisition_epoch, $account->email_connection_id);
                $next = $truncated ? $account->automatic_page_token : (isset($list['nextPageToken']) ? Crypt::encryptString($list['nextPageToken']) : null);
                $current->forceFill(['automatic_page_token' => $next, 'automatic_last_sync_at' => now(), 'sync_status' => $status])->save();
                EmailConnection::whereKey($account->email_connection_id)->update(['last_sync_at' => now()]);
            });

            return ['status' => $status, ...$counts, 'coverage' => 'UNKNOWN'];
        } catch (AutomaticFailure $error) {
            $status = $error->reason;
            if ($status === 'RECONNECT_REQUIRED') {
                EmailConnection::whereKey($account->email_connection_id)->update(['is_active' => false, 'credentials' => null]);
            }
            throw $error;
        } finally {
            InvestmentAccount::whereKey($account->id)->where('sync_lease', $lease)->update(['sync_lease' => null, 'sync_started_at' => null, 'sync_status' => $status]);
        }
    }

    private function parse(string $token, array $locator, InvestmentAccount $account, string $publicId, ?string $password = null): array
    {
        if (! preg_match('/\A[a-zA-Z0-9_-]{1,512}\z/', $locator['attachment'] ?? '')) {
            return ['status' => 'UNSUPPORTED_DOCUMENT'];
        }
        $attachment = $this->gmail->request($token, 'messages/'.rawurlencode($locator['message']).'/attachments/'.rawurlencode($locator['attachment']));
        if (($attachment['size'] ?? 0) > 20 * 1024 * 1024 || strlen($attachment['data'] ?? '') > 28 * 1024 * 1024) {
            return ['status' => 'DOCUMENT_LIMIT'];
        }
        $bytes = base64_decode(strtr($attachment['data'] ?? '', '-_', '+/'), true);
        if ($bytes === false || $bytes === '') {
            return ['status' => 'UNSUPPORTED_DOCUMENT'];
        }

        $result = $this->parser->parse($bytes, strtoupper($account->platform->code), $account->id, 'gmail-'.$publicId, $password);
        if (isset($result['payload'])) {
            $result['payload']['confirmed'] = false;
        }

        return $result;
    }

    public function unlock(AutomaticIngestion $ingestion, string $password): string
    {
        $account = InvestmentAccount::with('platform')->findOrFail($ingestion->investment_account_id);
        $this->assertCurrent($account, $ingestion->policy_epoch, $ingestion->email_connection_id);
        if (! in_array($ingestion->status, ['PASSWORD_REQUIRED', 'WRONG_PASSWORD', 'DECRYPTION_FAILED'], true)) {
            throw new AutomaticFailure('REVIEW_STATE_CONFLICT');
        }
        $parsed = $this->parse($this->gmail->access(EmailConnection::findOrFail($ingestion->email_connection_id)), $ingestion->locator, $account, $ingestion->public_id, $password);

        return DB::transaction(function () use ($account, $ingestion, $parsed) {
            $current = InvestmentAccount::whereKey($account->id)->lockForUpdate()->firstOrFail();
            $this->assertCurrent($current, $ingestion->policy_epoch, $ingestion->email_connection_id);
            $currentIngestion = AutomaticIngestion::whereKey($ingestion->id)->lockForUpdate()->firstOrFail();
            if (! in_array($currentIngestion->status, ['PASSWORD_REQUIRED', 'WRONG_PASSWORD', 'DECRYPTION_FAILED'], true)) {
                throw new AutomaticFailure('REVIEW_STATE_CONFLICT');
            }
            $currentIngestion->update(['status' => $parsed['status'], 'structured_payload' => $parsed['payload'] ?? null]);

            return $parsed['status'];
        });
    }

    public function confirm(AutomaticIngestion $ingestion, User $user): array
    {
        return DB::transaction(function () use ($ingestion, $user) {
            $account = InvestmentAccount::whereKey($ingestion->investment_account_id)->lockForUpdate()->firstOrFail();
            $ingestion = AutomaticIngestion::whereKey($ingestion->id)->lockForUpdate()->firstOrFail();
            if ($ingestion->receipt) {
                return [...$ingestion->receipt, 'replayed' => true];
            }
            $this->assertCurrent($account, $ingestion->policy_epoch, $ingestion->email_connection_id);
            if ($ingestion->status !== 'READY_FOR_REVIEW' || ! $ingestion->structured_payload) {
                throw new AutomaticFailure('REVIEW_STATE_CONFLICT');
            }
            // Reuse the authoritative Gate 1 allowlist, ownership, decimal, arithmetic and duplicate validation.
            $request = Request::create('/api/source-imports', 'POST', [...$ingestion->structured_payload, 'confirmed' => true]);
            $request->setUserResolver(fn () => $user);
            $response = app(SourceImportController::class)->store($request, app(SourceImporter::class));
            if ($response->getStatusCode() !== 200) {
                throw new AutomaticFailure('SOURCE_SCHEMA_PENDING');
            }
            $receipt = $response->getData(true);
            $ingestion->update(['receipt' => $receipt, 'status' => 'IMPORTED', 'structured_payload' => null]);

            return $receipt;
        });
    }

    private function assertCurrent(InvestmentAccount $account, int $epoch, int $connection): void
    {
        if (! $this->active($account) || $account->acquisition_epoch !== $epoch || $account->email_connection_id !== $connection) {
            throw new AutomaticFailure('SYNC_PAUSED');
        }
    }
}
