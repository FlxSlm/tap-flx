<?php

namespace App\Services\Reconciliation;

use App\Models\InvestmentAccount;
use App\Services\Integrity\SourceImporter;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

final class ReconciliationHistory
{
    public function __construct(private ReconciliationService $engine) {}

    public function available(): bool
    {
        return Schema::hasTable('reconciliation_runs') && Schema::hasTable('reconciliation_items');
    }

    /** Caller holds the account's write lock; no current financial input is changed. */
    public function store(InvestmentAccount $account, int $actor, array $input): array
    {
        $result = $this->engine->evaluate($account, $actor, $input);
        if (! hash_equals($result['input_version'], $input['expected_input_version'])) {
            throw new ConflictHttpException('Inputs changed; recalculate and review before saving.');
        }
        $stable = $result;
        unset($stable['calculated_at'], $stable['previous_input_stale']);
        $fingerprint = SourceImporter::digest($stable);
        $existing = DB::table('reconciliation_runs')->where('investment_account_id', $account->id)->where('result_fingerprint', $fingerprint)->first();
        if ($existing) {
            return ['run_id' => $existing->public_id, 'replayed' => true, 'input_version' => $result['input_version']];
        }
        $publicId = (string) Str::uuid();
        $summary = $result;
        unset($summary['items'], $summary['previous_input_stale']);
        unset($summary['evidence']['transactions']); // Retained once per item instead of duplicating source-link metadata.
        $id = DB::table('reconciliation_runs')->insertGetId([
            'public_id' => $publicId, 'investment_account_id' => $account->id, 'actor_id' => $actor,
            'opening_snapshot_id' => $input['opening_snapshot_id'], 'closing_snapshot_id' => $input['closing_snapshot_id'],
            'input_version' => $result['input_version'], 'result_fingerprint' => $fingerprint,
            'rule_version' => $result['rule_version'], 'status' => $result['status'],
            'parameters' => json_encode($result['parameters'], JSON_THROW_ON_ERROR),
            'summary' => json_encode($summary, JSON_THROW_ON_ERROR), 'created_at' => now()->utc(),
        ]);
        foreach ($result['items'] as $item) {
            DB::table('reconciliation_items')->insert([
                'reconciliation_run_id' => $id, 'symbol' => $item['symbol'], 'unit' => $item['unit'], 'status' => $item['status'],
                'result' => json_encode($item, JSON_THROW_ON_ERROR),
            ]);
        }

        return ['run_id' => $publicId, 'replayed' => false, 'input_version' => $result['input_version']];
    }

    public function describe(object $run, InvestmentAccount $account, int $actor, bool $withItems): array
    {
        $summary = json_decode($run->summary, true, 512, JSON_THROW_ON_ERROR);
        try {
            // Stored attestations never renew themselves for a changed input version.
            $current = $this->engine->evaluate($account, $actor, json_decode($run->parameters, true, 512, JSON_THROW_ON_ERROR));
            $currentVersion = $current['input_version'];
        } catch (NotFoundHttpException|ModelNotFoundException|ValidationException) {
            $currentVersion = null;
        }
        $stale = $currentVersion === null || ! hash_equals($run->input_version, $currentVersion);
        $response = [
            'run_id' => $run->public_id, 'saved_at' => CarbonImmutable::parse($run->created_at, 'UTC')->toIso8601String(),
            'freshness' => $stale ? 'STALE' : 'CURRENT', 'is_current' => ! $stale,
            'current_input_version' => $currentVersion, 'freshness_checked_at' => now()->utc()->toIso8601String(),
            'result' => $summary,
        ];
        if ($withItems) {
            $response['result']['items'] = DB::table('reconciliation_items')->where('reconciliation_run_id', $run->id)->orderBy('symbol')->orderBy('unit')
                ->get()->map(fn ($item) => json_decode($item->result, true, 512, JSON_THROW_ON_ERROR))->all();
            $response['result']['evidence']['transactions'] = collect($response['result']['items'])->flatMap(fn ($item) => $item['transaction_evidence'])->unique('id')->sortBy('id')->values()->all();
        }

        return $response;
    }
}
