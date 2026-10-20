<?php

use App\Http\Controllers\InvestmentAccountController;
use App\Http\Controllers\PortfolioSnapshotController;
use App\Http\Controllers\SourceImportController;
use App\Http\Controllers\TransactionController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    Route::get('/investment-accounts', [InvestmentAccountController::class, 'index']);
    Route::post('/source-imports', [SourceImportController::class, 'store']);
    Route::get('/source-imports/{batch}', [SourceImportController::class, 'show']);
    Route::post('/transactions/bulk', [TransactionController::class, 'bulkStore']);
    Route::post('/portfolio-snapshots/bulk', [PortfolioSnapshotController::class, 'bulkStore']);
    Route::apiResource('transactions', TransactionController::class);
});
