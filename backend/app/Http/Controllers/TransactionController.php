<?php

namespace App\Http\Controllers;

use App\Http\Resources\TransactionResource;
use App\Models\InvestmentAccount;
use App\Models\Transaction;
use Illuminate\Http\Request;
use Illuminate\Database\QueryException;

class TransactionController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $query = Transaction::whereHas('investmentAccount', function ($q) use ($user) {
            $q->where('user_id', $user->id);
        });

        if ($request->has('investment_account_id')) {
            $query->where('investment_account_id', $request->investment_account_id);
        }

        // Simple pagination
        $transactions = $query->latest('transaction_date')->paginate(50);

        return TransactionResource::collection($transactions);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'investment_account_id' => 'required|exists:investment_accounts,id',
            'transaction_date'      => 'required|date',
            'type'                  => 'required|string',
            'symbol'                => 'required|string',
            'asset_name'            => 'nullable|string',
            'quantity'              => 'required|numeric',
            'price'                 => 'required|numeric',
            'total_amount'          => 'required|numeric',
            'currency'              => 'required|string',
            'fee_amount'            => 'nullable|numeric',
            'external_identifier'   => 'nullable|string',
            'source_metadata'       => 'nullable|array',
        ]);

        // Authorization check: User must own the investment account
        $investmentAccount = InvestmentAccount::find($validated['investment_account_id']);
        if ($investmentAccount->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized access to this investment account.'], 403);
        }

        // Generate transaction hash for deduplication
        $hashData = implode('|', [
            $validated['investment_account_id'],
            date('Y-m-d', strtotime($validated['transaction_date'])),
            $validated['type'],
            $validated['symbol'],
            (float) $validated['quantity'],
            (float) $validated['price'],
            (float) $validated['total_amount']
        ]);
        $validated['transaction_hash'] = md5($hashData);

        try {
            $transaction = Transaction::create($validated);
            return new TransactionResource($transaction);
        } catch (QueryException $e) {
            // Check for duplicate entry (MySQL: 1062, SQLite: 19)
            if (isset($e->errorInfo[1]) && in_array($e->errorInfo[1], [1062, 19])) {
                return response()->json([
                    'message' => 'Duplicate transaction detected.',
                    'transaction_hash' => $validated['transaction_hash']
                ], 409);
            }
            throw $e;
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(Request $request, Transaction $transaction)
    {
        // Authorization check
        if ($transaction->investmentAccount->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        return new TransactionResource($transaction);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Transaction $transaction)
    {
        // Authorization check
        if ($transaction->investmentAccount->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $validated = $request->validate([
            'transaction_date'      => 'sometimes|required|date',
            'type'                  => 'sometimes|required|string',
            'symbol'                => 'sometimes|required|string',
            'asset_name'            => 'nullable|string',
            'quantity'              => 'sometimes|required|numeric',
            'price'                 => 'sometimes|required|numeric',
            'total_amount'          => 'sometimes|required|numeric',
            'currency'              => 'sometimes|required|string',
            'fee_amount'            => 'nullable|numeric',
            'external_identifier'   => 'nullable|string',
            'source_metadata'       => 'nullable|array',
        ]);

        $transaction->update($validated);

        return new TransactionResource($transaction);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Request $request, Transaction $transaction)
    {
        // Authorization check
        if ($transaction->investmentAccount->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $transaction->delete();

        return response()->json(['message' => 'Transaction deleted successfully.'], 200);
    }
}
