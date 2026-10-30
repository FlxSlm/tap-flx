<?php

use App\Services\Automatic\AutomaticFailure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->statefulApi();
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $privateApi = static fn (Request $request) => $request->is('api/*', 'automatic/*', 'login', 'register', 'logout');
        $exceptions->report(function (Throwable $error) use ($privateApi) {
            if (app()->bound('request') && $privateApi(request())) {
                // Do not log exception messages, SQL bindings, request bodies or traces.
                Log::error('API request failed.', ['exception_type' => get_class($error)]);

                return false;
            }
        });
        $exceptions->render(function (Throwable $error, Request $request) use ($privateApi) {
            if ($error instanceof AutomaticFailure) {
                $status = in_array($error->reason, ['SYNC_PAUSED', 'SYNC_BUSY', 'REVIEW_STATE_CONFLICT'], true) ? 409 : 503;

                return response()->json(['code' => $error->reason, 'message' => 'Automatic processing requires attention.'], $status)->header('Cache-Control', 'private, no-store');
            }
            if (! $privateApi($request) || $error instanceof ValidationException) {
                return null;
            }
            $status = $error instanceof AuthenticationException ? 401 : ($error instanceof HttpExceptionInterface ? $error->getStatusCode() : 500);
            $messages = [401 => 'Unauthenticated.', 403 => 'Access denied.', 404 => 'Resource not found.', 405 => 'Method not allowed.', 409 => 'Inputs conflict; review and retry.', 419 => 'Session token expired; sign in again.'];
            if ($status === 409 && $error->getMessage() === 'Duplicate transaction detected.') {
                $messages[409] = 'Duplicate transaction detected.'; // Existing public API contract, fixed allowlisted text.
            }

            return response()->json(['message' => $messages[$status] ?? ($status >= 500 ? 'Request could not be completed.' : 'Request rejected.')], $status)
                ->header('Cache-Control', 'private, no-store');
        });
    })->create();
