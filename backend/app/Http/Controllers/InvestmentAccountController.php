<?php

namespace App\Http\Controllers;

use App\Models\InvestmentAccount;
use Illuminate\Http\Request;

class InvestmentAccountController extends Controller
{
    /**
     * List investment accounts belonging to the authenticated user.
     */
    public function index(Request $request)
    {
        $accounts = InvestmentAccount::where('user_id', $request->user()->id)
            ->with('platform')
            ->get()
            ->map(function ($account) {
                return [
                    'id' => $account->id,
                    'account_name' => $account->account_name,
                    'platform_code' => $account->platform->code,
                    'platform_name' => $account->platform->name,
                ];
            });

        return response()->json(['data' => $accounts]);
    }
}
