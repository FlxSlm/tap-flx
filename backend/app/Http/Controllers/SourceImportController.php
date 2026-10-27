<?php

namespace App\Http\Controllers;

use App\Models\InvestmentAccount;
use App\Services\Integrity\SnapshotContract;
use App\Services\Integrity\SourceImporter;
use App\Services\Integrity\TransactionContract;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SourceImportController extends Controller
{
    public function store(Request $request, SourceImporter $importer)
    {
        if (array_diff(array_keys($request->all()), ['schema_version', 'investment_account_id', 'idempotency_key', 'confirmed', 'source', 'transactions', 'snapshot'])) {
            throw ValidationException::withMessages(['payload' => 'Only structured contract fields are allowed.']);
        }
        $keys = implode(',', [...array_keys(TransactionContract::rules()), 'row_key', 'confidence', 'match_transaction_id']);
        $data = $request->validate([
            'schema_version' => ['required', Rule::in(['integrity-v1'])],
            'investment_account_id' => 'required|integer|exists:investment_accounts,id',
            'idempotency_key' => ['required', 'string', 'max:80', 'regex:/^[a-zA-Z0-9_-]+$/D'],
            'confirmed' => 'required|accepted',
            'source' => 'required|array:provider,source_type,document_type,document_hash,parser_version',
            'source.provider' => ['required', Rule::in(['BIONS', 'STOCKBIT', 'PLUANG'])],
            'source.source_type' => ['required', Rule::in(['PDF'])],
            'source.document_type' => ['required', Rule::in(['SOA', 'TC', 'CA'])],
            'source.document_hash' => ['required', 'regex:/^[a-f0-9]{64}$/D'],
            'source.parser_version' => ['required', 'string', 'max:60', 'regex:/^[A-Za-z0-9@._-]+$/D'],
            'transactions' => 'present|array|list|max:1000',
            'transactions.*' => 'array:'.$keys,
            'transactions.*.row_key' => ['required', 'string', 'max:77', 'distinct:strict', 'regex:/^[a-zA-Z0-9_-]+$/D'],
            'transactions.*.confidence' => 'nullable|integer|min:0|max:100',
            'transactions.*.match_transaction_id' => 'nullable|integer',
            'snapshot' => 'nullable|array:as_of_date,coverage,coverage_confirmed,parsed_item_count,period_start,period_end,items',
        ]);
        $account = InvestmentAccount::with('platform')->findOrFail($data['investment_account_id']);
        abort_unless($account->user_id === $request->user()->id, 403, 'Unauthorized.');
        $source = $data['source'];
        if (strtoupper($account->platform->code) !== $source['provider']
            || ($source['document_type'] === 'CA' && $source['provider'] !== 'BIONS')
            || ($source['provider'] === 'PLUANG' && $source['document_type'] !== 'SOA')) {
            throw ValidationException::withMessages(['source' => 'Unsupported provider/document or account/provider mismatch.']);
        }
        $rows = [];
        foreach ($data['transactions'] as $row) {
            if (isset($row['source_metadata'])) {
                throw ValidationException::withMessages(['transactions' => 'Unstructured source metadata is not accepted.']);
            }
            $canonical = TransactionContract::validate([...$row, 'investment_account_id' => $account->id]);
            if ($source['document_type'] === 'CA' && $canonical['type'] !== 'DIVIDEND') {
                throw ValidationException::withMessages(['transactions' => 'CA cash dividend accepts only DIVIDEND events.']);
            }
            if ($source['document_type'] === 'TC' && ! in_array($canonical['type'], ['BUY', 'SELL'])) {
                throw ValidationException::withMessages(['transactions' => 'Trade confirmation accepts only BUY/SELL events.']);
            }
            if (in_array($canonical['type'], ['BUY', 'SELL'], true) && ! in_array($canonical['unit'], ['UNKNOWN', ...($source['provider'] === 'PLUANG' ? ['COIN'] : ['SHARE', 'LOT'])], true)) {
                throw ValidationException::withMessages(['transactions.unit' => 'Quantity unit is incompatible with the document provider.']);
            }
            $rows[] = [...$canonical, 'row_key' => $row['row_key'], 'confidence' => $row['confidence'] ?? null, 'match_transaction_id' => $row['match_transaction_id'] ?? null];
        }
        $snapshot = null;
        if (isset($data['snapshot'])) {
            if ($source['document_type'] !== 'SOA') {
                throw ValidationException::withMessages(['snapshot' => 'Only a statement can produce a snapshot.']);
            }
            $snapshot = SnapshotContract::validate([...$data['snapshot'], 'investment_account_id' => $account->id, 'provider' => $source['provider'], 'document_type' => 'SOA']);
            foreach ($snapshot['items'] as $item) {
                if (! isset($item['currency'])) {
                    throw ValidationException::withMessages(['snapshot.items.currency' => 'Structured source imports require explicit currency; do not infer a missing currency.']);
                }
            }
        }
        if ($rows === [] && $snapshot === null) {
            throw ValidationException::withMessages(['payload' => 'At least one structured observation is required.']);
        }

        return response()->json($importer->import($account, $request->user()->id, $data, $rows, $snapshot));
    }

    public function show(Request $request, string $batch)
    {
        $record = DB::table('import_batches')->where('public_id', $batch)->first();
        abort_unless($record && InvestmentAccount::whereKey($record->investment_account_id)->where('user_id', $request->user()->id)->exists(), 404);
        $source = DB::table('source_documents')->where('id', $record->source_document_id)->first();
        $observations = DB::table('source_observations')->where('source_document_id', $source->id)
            ->get(['id', 'row_key', 'kind', 'transaction_id', 'portfolio_snapshot_id', 'confidence', 'validation_status', 'review_status', 'status']);

        return response()->json([
            'batch_id' => $record->public_id,
            'source' => ['source_document_id' => $source->public_id, 'provider' => $source->provider, 'source_type' => $source->source_type, 'document_type' => $source->document_type, 'parser_version' => $source->parser_version, 'imported_at' => $source->imported_at],
            'receipt' => json_decode($record->receipt, true, 512, JSON_THROW_ON_ERROR),
            'current_observations' => $observations,
        ]);
    }
}
