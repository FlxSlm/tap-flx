<?php

namespace Tests\Feature;

use App\Models\AutomaticIngestion;
use App\Models\EmailConnection;
use App\Models\InvestmentAccount;
use App\Models\User;
use App\Services\Automatic\AttachmentParser;
use App\Services\Automatic\AutomaticFailure;
use App\Services\Automatic\GmailClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AutomaticModeTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private InvestmentAccount $account;

    private EmailConnection $connection;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        Http::preventStrayRequests();
        config(['automatic.enabled' => true, 'automatic.client_id' => 'synthetic-client', 'automatic.client_secret' => str_repeat('s', 20),
            'automatic.senders.STOCKBIT' => ['sender@example.test'], 'automatic.orchestrator_secret' => str_repeat('n', 40)]);
        $this->owner = User::factory()->create();
        $this->actingAs($this->owner);
        $this->withHeader('Origin', 'http://localhost:5173');
        $id = $this->postJson('/api/investment-accounts', ['provider' => 'stockbit', 'account_name' => 'Synthetic Automatic'])->assertCreated()->json('data.id');
        $this->account = InvestmentAccount::findOrFail($id);
        $this->connection = EmailConnection::create(['user_id' => $this->owner->id, 'email_address' => 'synthetic@example.test', 'oauth_provider' => 'google', 'is_active' => true,
            'credentials' => json_encode(['access_token' => str_repeat('a', 24), 'refresh_token' => str_repeat('r', 24), 'expires_at' => now()->addHour()->timestamp])]);
    }

    private function enable(): void
    {
        $this->putJson('/api/automatic/accounts/'.$this->account->id.'/mode', ['mode' => 'AUTOMATIC', 'connection_id' => $this->connection->id, 'consent' => true])->assertOk();
    }

    private function pdf(): string
    {
        $lines = ['STOCKBIT STATEMENT OF ACCOUNT', 'Date 01/01/2020 - 31/01/2020', 'TSTA Synthetic Asset 10 100.00 110.00 1,000.00 1,100.00 100.00 10.00'];
        $stream = 'BT /F1 8 Tf 10 750 Td 14 TL ';
        foreach ($lines as $i => $line) {
            $stream .= ($i ? 'T* ' : '').'('.$line.") Tj\n";
        }
        $stream .= 'ET';
        $objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1200 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', '<< /Length '.strlen($stream).">>\nstream\n".$stream."\nendstream"];
        $pdf = "%PDF-1.4\n";
        $offsets = [];
        foreach ($objects as $i => $object) {
            $offsets[] = strlen($pdf);
            $pdf .= ($i + 1)." 0 obj\n".$object."\nendobj\n";
        }
        $xref = strlen($pdf);
        $pdf .= "xref\n0 6\n0000000000 65535 f \n";
        foreach ($offsets as $offset) {
            $pdf .= sprintf('%010d 00000 n ', $offset)."\n";
        }

        return $pdf."trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n".$xref."\n%%EOF";
    }

    private function mailbox(?string $bytes = null, string $sender = 'Synthetic <sender@example.test>', bool $attachment = true): void
    {
        Http::swap(new Factory);
        Http::preventStrayRequests();
        $bytes ??= $this->pdf();
        Http::fake([
            'gmail.googleapis.com/gmail/v1/users/me/messages/abc123/attachments/part123*' => Http::response(['size' => strlen($bytes), 'data' => rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=')]),
            'gmail.googleapis.com/gmail/v1/users/me/messages/abc123*' => Http::response(['payload' => ['headers' => [['name' => 'From', 'value' => $sender]], 'mimeType' => 'multipart/mixed', 'parts' => $attachment ? [['mimeType' => 'application/pdf', 'body' => ['attachmentId' => 'part123', 'size' => strlen($bytes)]]] : []]]),
            'gmail.googleapis.com/gmail/v1/users/me/messages*' => Http::response(['messages' => [['id' => 'abc123']]]),
            'oauth2.googleapis.com/revoke' => Http::response([]),
        ]);
    }

    public function test_offline_gmail_real_pdf_parser_review_import_receipt_replay_and_privacy_dedup(): void
    {
        $this->enable();
        $this->mailbox();
        $url = '/api/automatic/accounts/'.$this->account->id.'/sync';
        $this->postJson($url)->assertOk()->assertJsonPath('reviewed', 1)->assertJsonPath('coverage', 'UNKNOWN');
        $this->assertDatabaseCount('portfolio_snapshots', 0);
        $review = $this->getJson('/api/automatic/reviews')->assertOk()->assertJsonCount(1, 'data')->json('data.0');
        $detail = '/api/automatic/reviews/'.$review['public_id'];
        $payload = $this->getJson($detail)->assertOk()->assertJsonPath('status', 'READY_FOR_REVIEW')->assertJsonPath('sender_assurance', 'UNVERIFIED')->json('payload');
        $this->assertSame('10', $payload['snapshot']['items'][0]['quantity']);
        $this->assertSame('1100.00', $payload['snapshot']['items'][0]['market_value']);
        $cipher = DB::table('automatic_ingestions')->value('structured_payload');
        $this->assertStringNotContainsString('TSTA', $cipher);
        $this->assertArrayNotHasKey('credentials', $this->connection->toArray());
        $this->assertStringNotContainsString(str_repeat('r', 24), DB::table('email_connections')->value('credentials'));
        $this->postJson($detail.'/confirm', ['confirmed' => false])->assertUnprocessable();
        $receipt = $this->postJson($detail.'/confirm', ['confirmed' => true])->assertOk()->json();
        $this->postJson($detail.'/confirm', ['confirmed' => true])->assertOk()->assertJsonPath('replayed', true)->assertJsonPath('batch_id', $receipt['batch_id']);
        $this->postJson($url)->assertOk()->assertJsonPath('replayed', 1);
        $this->assertFalse($payload['confirmed']);
        $this->postJson('/api/source-imports', [...$payload, 'confirmed' => true, 'idempotency_key' => 'synthetic-privacy-replay'])->assertOk()->assertJsonPath('results.0.status', 'REPLAYED');
        $this->assertDatabaseCount('portfolio_snapshots', 1);
        $this->assertDatabaseCount('portfolio_snapshot_items', 1);
        $this->assertDatabaseCount('transactions', 0);
        $this->assertNull(AutomaticIngestion::sole()->structured_payload);
        foreach ([1, 2] as $request) {
            $this->getJson('/api/investment-accounts/'.$this->account->id.'/holdings?as_of=2020-01-31')->assertOk()->assertJsonPath('reported.snapshots.0.items.0.quantity', '10');
        }
        $this->postJson('/api/automatic/gmail/'.$this->connection->id.'/disconnect')->assertOk()->assertJsonPath('revocation_confirmed', true);
        $this->postJson($url)->assertConflict()->assertJsonPath('code', 'SYNC_PAUSED');
        $this->assertDatabaseCount('portfolio_snapshots', 1);
    }

    public function test_privacy_mode_pause_stales_review_and_preserves_evidence(): void
    {
        $this->enable();
        $this->mailbox();
        $url = '/api/automatic/accounts/'.$this->account->id;
        $this->postJson($url.'/sync')->assertOk();
        $review = AutomaticIngestion::sole();
        $this->putJson($url.'/mode', ['mode' => 'PRIVACY'])->assertOk();
        $this->postJson('/api/automatic/reviews/'.$review->public_id.'/confirm', ['confirmed' => true])->assertConflict()->assertJsonPath('code', 'SYNC_PAUSED');
        $this->assertDatabaseCount('automatic_ingestions', 1);
        $this->assertDatabaseCount('portfolio_snapshots', 0);
        $this->enable();
        $this->postJson($url.'/sync')->assertOk()->assertJsonPath('reviewed', 1);
        $this->assertDatabaseCount('automatic_ingestions', 1);
    }

    public function test_sender_filter_does_not_trust_display_name_and_email_parser_is_not_invented(): void
    {
        $this->enable();
        $this->mailbox(sender: 'sender@example.test <attacker@example.test>');
        $this->postJson('/api/automatic/accounts/'.$this->account->id.'/sync')->assertOk()->assertJsonPath('filtered', 1);
        $this->assertDatabaseCount('automatic_ingestions', 0);
        $this->mailbox(attachment: false);
        $this->postJson('/api/automatic/accounts/'.$this->account->id.'/sync')->assertOk();
        $this->assertSame('UNSUPPORTED_EMAIL', AutomaticIngestion::sole()->status);
    }

    public function test_invalid_pdf_is_reviewable_without_ledger_writes(): void
    {
        $this->enable();
        $this->mailbox(bytes: 'synthetic invalid PDF');
        $this->postJson('/api/automatic/accounts/'.$this->account->id.'/sync')->assertOk();
        $this->assertSame('UNSUPPORTED_DOCUMENT', AutomaticIngestion::sole()->status);
        $this->assertDatabaseCount('transactions', 0);
        $this->assertDatabaseCount('portfolio_snapshots', 0);
    }

    public function test_cross_owner_routes_and_connection_injection_are_rejected(): void
    {
        $this->enable();
        $this->mailbox();
        $this->postJson('/api/automatic/accounts/'.$this->account->id.'/sync')->assertOk();
        $review = AutomaticIngestion::sole();
        $this->actingAs(User::factory()->create());
        $this->getJson('/api/automatic')->assertOk()->assertJsonCount(0, 'connections')->assertJsonCount(0, 'accounts');
        $this->getJson('/api/automatic/reviews')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/automatic/reviews/'.$review->public_id)->assertNotFound();
        $this->postJson('/api/automatic/reviews/'.$review->public_id.'/unlock', ['password' => 'synthetic'])->assertNotFound();
        $this->postJson('/api/automatic/reviews/'.$review->public_id.'/confirm', ['confirmed' => true])->assertNotFound();
        $this->postJson('/api/automatic/gmail/'.$this->connection->id.'/disconnect')->assertNotFound();
        $this->putJson('/api/automatic/accounts/'.$this->account->id.'/mode', ['mode' => 'PRIVACY'])->assertNotFound();
        $this->postJson('/api/automatic/accounts/'.$this->account->id.'/sync')->assertNotFound();
        $id = $this->postJson('/api/investment-accounts', ['provider' => 'bions', 'account_name' => 'Synthetic Other'])->assertCreated()->json('data.id');
        $this->putJson('/api/automatic/accounts/'.$id.'/mode', ['mode' => 'AUTOMATIC', 'connection_id' => $this->connection->id, 'consent' => true])->assertNotFound();
    }

    public function test_oauth_state_single_use_pkce_encryption_and_multiple_connections(): void
    {
        Http::fake(['oauth2.googleapis.com/token' => Http::response(['access_token' => str_repeat('b', 24), 'refresh_token' => str_repeat('c', 24), 'expires_in' => 3600, 'scope' => GmailClient::SCOPE]),
            'gmail.googleapis.com/gmail/v1/users/me/profile' => Http::sequence()->push(['emailAddress' => 'second@example.test'])->push(['emailAddress' => 'third@example.test'])]);
        foreach ([1, 2] as $iteration) {
            $authorization = $this->postJson('/api/automatic/gmail/connect')->assertOk()->json('authorization_url');
            parse_str(parse_url($authorization, PHP_URL_QUERY), $query);
            $this->assertSame(GmailClient::SCOPE, $query['scope']);
            $this->assertSame('S256', $query['code_challenge_method']);
            $callback = '/automatic/gmail/callback?'.http_build_query(['state' => $query['state'], 'code' => 'synthetic-code']);
            $this->get($callback)->assertRedirect(config('automatic.frontend_url').'?gmail=CONNECTED');
            $this->get($callback)->assertRedirect(config('automatic.frontend_url').'?gmail=OAUTH_STATE_INVALID');
        }
        $this->assertDatabaseCount('email_connections', 3);
        Http::assertSent(fn ($request) => str_contains($request->url(), '/token') && strlen($request['code_verifier']) === 96);
        $this->assertStringNotContainsString(str_repeat('c', 24), DB::table('email_connections')->where('email_address', 'second@example.test')->value('credentials'));
    }

    public function test_oauth_expiry_state_mismatch_and_other_session_cannot_exchange(): void
    {
        Http::fake();
        $authorization = $this->postJson('/api/automatic/gmail/connect')->assertOk()->json('authorization_url');
        parse_str(parse_url($authorization, PHP_URL_QUERY), $query);
        $this->travel(11)->minutes();
        $this->get('/automatic/gmail/callback?state='.$query['state'].'&code=synthetic')->assertRedirect(config('automatic.frontend_url').'?gmail=OAUTH_STATE_INVALID');
        $this->travelBack();
        $this->postJson('/api/automatic/gmail/connect')->assertOk();
        $this->get('/automatic/gmail/callback?state=wrong&code=synthetic')->assertRedirect(config('automatic.frontend_url').'?gmail=OAUTH_STATE_INVALID');
        $authorization = $this->postJson('/api/automatic/gmail/connect')->assertOk()->json('authorization_url');
        parse_str(parse_url($authorization, PHP_URL_QUERY), $query);
        $this->actingAs(User::factory()->create());
        $this->get('/automatic/gmail/callback?state='.$query['state'].'&code=synthetic')->assertRedirect(config('automatic.frontend_url').'?gmail=OAUTH_STATE_INVALID');
        Http::assertNothingSent();
    }

    public function test_token_refresh_and_revoked_connection_are_safe(): void
    {
        $this->connection->update(['credentials' => json_encode(['access_token' => 'old', 'refresh_token' => 'synthetic-refresh', 'expires_at' => 0])]);
        Http::fake(['oauth2.googleapis.com/token' => Http::sequence()->push(['access_token' => 'synthetic-fresh', 'expires_in' => 3600])->push(['error' => 'invalid_grant'], 400)]);
        $this->assertSame('synthetic-fresh', app(GmailClient::class)->access($this->connection));
        $this->connection->update(['credentials' => json_encode(['refresh_token' => 'synthetic-refresh', 'expires_at' => 0])]);
        try {
            app(GmailClient::class)->access($this->connection);
            $this->fail('Expected reconnect');
        } catch (AutomaticFailure $error) {
            $this->assertSame('RECONNECT_REQUIRED', $error->reason);
        }
        $this->assertFalse($this->connection->fresh()->is_active);
        $this->assertNull($this->connection->fresh()->credentials);
    }

    public function test_orchestrator_requires_long_secret_and_source_ip_and_returns_only_opaque_ids(): void
    {
        $this->enable();
        $this->getJson('/api/internal/automatic/jobs')->assertForbidden();
        $headers = ['Authorization' => 'Bearer '.str_repeat('n', 40)];
        $response = $this->getJson('/api/internal/automatic/jobs', $headers)->assertOk()->json();
        $this->assertSame(['job'], array_keys($response[0]));
        $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.1'])->getJson('/api/internal/automatic/jobs', $headers)->assertForbidden();
    }

    public function test_feature_disabled_and_missing_schema_fail_closed(): void
    {
        config(['automatic.enabled' => false]);
        $this->postJson('/api/automatic/gmail/connect')->assertStatus(503)->assertJsonPath('code', 'AUTOMATIC_NOT_CONFIGURED');
        $this->getJson('/api/automatic')->assertOk()->assertJsonPath('enabled', false);
    }

    public function test_disabling_feature_still_allows_owner_to_pause_and_disconnect(): void
    {
        $this->enable();
        $this->mailbox();
        config(['automatic.enabled' => false]);
        $this->putJson('/api/automatic/accounts/'.$this->account->id.'/mode', ['mode' => 'PRIVACY'])->assertOk();
        $this->postJson('/api/automatic/gmail/'.$this->connection->id.'/disconnect')->assertOk();
        $this->assertNull($this->connection->fresh()->credentials);
    }

    public function test_manual_confirmation_revalidates_financial_arithmetic_and_rejects_client_override(): void
    {
        $this->enable();
        $this->mailbox();
        $this->postJson('/api/automatic/accounts/'.$this->account->id.'/sync')->assertOk();
        $review = AutomaticIngestion::sole();
        $url = '/api/automatic/reviews/'.$review->public_id.'/confirm';
        $this->postJson($url, ['confirmed' => true, 'transactions' => []])->assertUnprocessable();
        $payload = $review->structured_payload;
        $payload['source']['document_type'] = 'TC';
        unset($payload['snapshot']);
        $payload['transactions'] = [['row_key' => 'synthetic', 'transaction_date' => '2020-01-02', 'date_precision' => 'DATE', 'type' => 'BUY', 'symbol' => 'TSTA',
            'unit' => 'SHARE', 'currency' => 'IDR', 'quantity' => '10', 'price' => '100', 'gross_amount' => '999', 'total_amount' => '999', 'amount_semantics' => 'GROSS']];
        $review->update(['structured_payload' => $payload]);
        $this->postJson($url, ['confirmed' => true])->assertUnprocessable();
        $this->assertDatabaseCount('transactions', 0);
        $this->assertDatabaseCount('portfolio_snapshots', 0);
        $this->assertSame('READY_FOR_REVIEW', $review->fresh()->status);
    }

    public function test_mode_change_during_parse_blocks_in_flight_ingestion_write(): void
    {
        $this->enable();
        $this->mailbox();
        $this->mock(AttachmentParser::class)->shouldReceive('parse')->once()->andReturnUsing(function () {
            InvestmentAccount::whereKey($this->account->id)->update(['acquisition_mode' => 'PRIVACY', 'acquisition_epoch' => DB::raw('acquisition_epoch + 1'), 'sync_lease' => null, 'sync_status' => 'PAUSED']);

            return ['status' => 'VALIDATION_REQUIRED'];
        });
        $this->postJson('/api/automatic/accounts/'.$this->account->id.'/sync')->assertConflict()->assertJsonPath('code', 'SYNC_PAUSED');
        $this->assertDatabaseCount('automatic_ingestions', 0);
        $this->assertSame('PAUSED', $this->account->fresh()->sync_status);
    }

    public function test_attachment_budget_retains_page_until_remaining_parts_are_reviewed(): void
    {
        $this->enable();
        $this->mock(AttachmentParser::class)->shouldReceive('parse')->times(8)->andReturn(['status' => 'VALIDATION_REQUIRED']);
        $parts = array_map(fn ($i) => ['mimeType' => 'application/pdf', 'body' => ['attachmentId' => 'part'.$i, 'size' => 4]], range(1, 8));
        Http::fake([
            'gmail.googleapis.com/gmail/v1/users/me/messages/abc123/attachments/*' => Http::response(['size' => 4, 'data' => base64_encode('test')]),
            'gmail.googleapis.com/gmail/v1/users/me/messages/abc123*' => Http::response(['payload' => ['headers' => [['name' => 'From', 'value' => 'sender@example.test']], 'parts' => $parts]]),
            'gmail.googleapis.com/gmail/v1/users/me/messages*' => Http::response(['messages' => [['id' => 'abc123']], 'nextPageToken' => 'synthetic-next-page']),
        ]);
        $url = '/api/automatic/accounts/'.$this->account->id.'/sync';
        $this->postJson($url)->assertOk()->assertJsonPath('reviewed', 5)->assertJsonPath('status', 'MORE_AVAILABLE');
        $this->assertNull($this->account->fresh()->automatic_page_token);
        $this->assertDatabaseCount('automatic_ingestions', 5);
        $this->postJson($url)->assertOk()->assertJsonPath('reviewed', 3)->assertJsonPath('replayed', 5);
        $this->assertDatabaseCount('automatic_ingestions', 8);
        $this->assertSame('synthetic-next-page', Crypt::decryptString($this->account->fresh()->automatic_page_token));
    }
}
