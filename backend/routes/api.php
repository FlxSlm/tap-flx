<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\TransactionController;
use App\Http\Controllers\InvestmentAccountController;

Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    Route::get('/investment-accounts', [InvestmentAccountController::class, 'index']);
    Route::post('/transactions/bulk', [TransactionController::class, 'bulkStore']);
    Route::post('/portfolio-snapshots/bulk', [\App\Http\Controllers\PortfolioSnapshotController::class, 'bulkStore']);
    Route::apiResource('transactions', TransactionController::class);
});
