<?php

namespace Tests\Feature;

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use PDOException;
use Tests\TestCase;

class PrivateApiErrorsTest extends TestCase
{
    public function test_database_error_response_and_log_do_not_expose_financial_bindings_even_in_debug_mode(): void
    {
        config(['app.debug' => true]);
        Log::shouldReceive('error')->once()->withArgs(function ($message, $context) {
            $this->assertSame('API request failed.', $message);
            $this->assertSame(['exception_type' => QueryException::class], $context);
            $this->assertStringNotContainsString('SYNTHETIC_PRIVATE_BINDING', json_encode([$message, $context]));

            return true;
        });
        Route::post('/api/synthetic-error-test', function () {
            throw new QueryException('synthetic', 'insert into synthetic_test (value) values (?)', ['SYNTHETIC_PRIVATE_BINDING'], new PDOException('Synthetic failure'));
        });
        $this->postJson('/api/synthetic-error-test', ['raw_text' => 'SYNTHETIC_PRIVATE_BODY'])->assertStatus(500)
            ->assertExactJson(['message' => 'Request could not be completed.'])->assertHeader('Cache-Control', 'no-store, private');
    }

    public function test_unexpected_error_is_sanitized_but_validation_still_returns_actionable_field_errors(): void
    {
        Log::shouldReceive('error')->once()->with('API request failed.', ['exception_type' => \RuntimeException::class]);
        Route::get('/api/synthetic-error-test', fn () => throw new \RuntimeException('SYNTHETIC_PRIVATE_EXCEPTION'));
        $this->getJson('/api/synthetic-error-test')->assertStatus(500)->assertExactJson(['message' => 'Request could not be completed.']);
        Route::post('/api/synthetic-validation-test', fn () => request()->validate(['provider' => 'required|in:stockbit,bions,pluang']));
        $this->postJson('/api/synthetic-validation-test', [])->assertUnprocessable()->assertJsonValidationErrors('provider');
    }
}
