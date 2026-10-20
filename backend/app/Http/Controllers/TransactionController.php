<?php

namespace App\Http\Controllers;

use App\Http\Resources\TransactionResource;
use App\Models\InvestmentAccount;
use App\Models\Transaction;
use App\Services\Integrity\TransactionContract;
use App\Services\Integrity\TransactionWriter;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class TransactionController extends Controller
{
    public function index(Request $request)
    {
        $query = Transaction::whereHas('investmentAccount', fn ($q) => $q->where('user_id', $request->user()->id));
        if ($request->has('investment_account_id')) {
            $query->where('investment_account_id', $request->investment_account_id);
        }

        return TransactionResource::collection($query->latest('transaction_date')->paginate(50));
    }

    public function store(Request $request)
    {
        $data = TransactionContract::validate($request->all());
        $this->authorizeAccount($data['investment_account_id'], $request->user()->id);

        return new TransactionResource(TransactionWriter::create($data, $request->user()->id));
    }

    public function bulkStore(Request $request)
    {
        $rows = $request->validate(['transactions' => 'required|array|list|min:1|max:1000', 'transactions.*' => 'required|array'])['transactions'];
        $rows = array_map(fn ($row) => TransactionContract::validate($row), $rows);
        $successful = [];
        $failed = [];
        foreach ($rows as $index => $data) {
            if (InvestmentAccount::whereKey($data['investment_account_id'])->value('user_id') !== $request->user()->id) {
                $failed[] = ['index' => $index, 'reason' => 'Unauthorized access to this investment account.'];

                continue;
            }
            try {
                $successful[] = new TransactionResource(TransactionWriter::create($data, $request->user()->id));
            } catch (ConflictHttpException $e) {
                $failed[] = ['index' => $index, 'reason' => 'Duplicate transaction detected.'];
            }
        }

        return response()->json(['message' => 'Bulk insert completed.', 'successful' => $successful, 'failed' => $failed]);
    }

    public function show(Request $request, Transaction $transaction)
    {
        $this->authorizeAccount($transaction->investment_account_id, $request->user()->id);

        return new TransactionResource($transaction);
    }

    public function update(Request $request, Transaction $transaction)
    {
        $this->authorizeAccount($transaction->investment_account_id, $request->user()->id);
        $patch = $request->only(array_keys(TransactionContract::rules()));
        unset($patch['investment_account_id']);

        return new TransactionResource(TransactionWriter::update($transaction, $patch, $request->user()->id));
    }

    public function destroy(Request $request, Transaction $transaction)
    {
        $this->authorizeAccount($transaction->investment_account_id, $request->user()->id);
        TransactionWriter::delete($transaction, $request->user()->id);

        return response()->json(['message' => 'Transaction deleted successfully.']);
    }

    private function authorizeAccount(int $id, int $userId): void
    {
        abort_unless(InvestmentAccount::whereKey($id)->where('user_id', $userId)->exists(), 403, 'Unauthorized.');
    }
}
