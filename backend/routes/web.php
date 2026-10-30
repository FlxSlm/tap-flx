<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\AutomaticController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/logout', [AuthController::class, 'logout']);
Route::get('/automatic/gmail/callback', [AutomaticController::class, 'callback']);
