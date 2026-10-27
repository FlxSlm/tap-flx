<?php

use App\Http\Controllers\HoldingsController;
use App\Http\Controllers\InvestmentAccountController;
use App\Http\Controllers\PortfolioSnapshotController;
use App\Http\Controllers\ReconciliationController;
use App\Http\Controllers\SourceImportController;
use App\Http\Controllers\TransactionController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    Route::get('/investment-accounts', [InvestmentAccountController::class, 'index']);
    Route::post('/investment-accounts', [InvestmentAccountController::class, 'store']);
    Route::post('/investment-accounts/{account}/reconciliation', [ReconciliationController::class, 'evaluate'])->whereNumber('account');
    Route::get('/investment-accounts/{account}/reconciliation-runs', [ReconciliationController::class, 'index'])->whereNumber('account');
    Route::post('/investment-accounts/{account}/reconciliation-runs', [ReconciliationController::class, 'store'])->whereNumber('account');
    Route::get('/investment-accounts/{account}/reconciliation-runs/{run}', [ReconciliationController::class, 'show'])->whereNumber('account')->whereUuid('run');
    Route::get('/investment-accounts/{account}/holdings', [HoldingsController::class, 'index'])->whereNumber('account');
    Route::get('/investment-accounts/{account}/portfolio-snapshots', [HoldingsController::class, 'snapshots'])->whereNumber('account');
    Route::post('/investment-accounts/{account}/portfolio-snapshots/{snapshot}/confirm', [HoldingsController::class, 'confirm'])->whereNumber('account')->whereNumber('snapshot');
    Route::post('/source-imports', [SourceImportController::class, 'store']);
    Route::get('/source-imports/{batch}', [SourceImportController::class, 'show']);
    Route::post('/transactions/bulk', [TransactionController::class, 'bulkStore']);
    Route::post('/portfolio-snapshots/bulk', [PortfolioSnapshotController::class, 'bulkStore']);
    Route::apiResource('transactions', TransactionController::class);
});
