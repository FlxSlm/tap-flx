<?php

namespace App\Services\Automatic;

use App\Models\EmailConnection;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class GmailClient
{
    public const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

    public function configured(): bool
    {
        $local = fn ($url) => parse_url($url ?? '', PHP_URL_SCHEME) === 'http' && in_array(parse_url($url ?? '', PHP_URL_HOST), ['localhost', '127.0.0.1', '[::1]'], true)
            && ! parse_url($url ?? '', PHP_URL_USER) && ! parse_url($url ?? '', PHP_URL_QUERY) && ! parse_url($url ?? '', PHP_URL_FRAGMENT);

        return config('automatic.enabled') && config('automatic.client_id') && config('automatic.client_secret')
            && $local(config('automatic.redirect_uri')) && $local(config('automatic.frontend_url'));
    }

    public function authorization(string $state, string $verifier): string
    {
        return 'https://accounts.google.com/o/oauth2/v2/auth?'.http_build_query([
            'client_id' => config('automatic.client_id'), 'redirect_uri' => config('automatic.redirect_uri'),
            'response_type' => 'code', 'scope' => self::SCOPE, 'access_type' => 'offline',
            'prompt' => 'consent', 'state' => $state,
            'code_challenge' => rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '='),
            'code_challenge_method' => 'S256',
        ]);
    }

    private function token(array $fields): array
    {
        try {
            $response = Http::asForm()->connectTimeout(5)->timeout(20)->withOptions(['allow_redirects' => false])->post('https://oauth2.googleapis.com/token', [
                'client_id' => config('automatic.client_id'), 'client_secret' => config('automatic.client_secret'), ...$fields,
            ]);
        } catch (\Throwable) {
            throw new AutomaticFailure('GOOGLE_UNAVAILABLE');
        }
        if (! $response->successful()) {
            throw new AutomaticFailure($response->json('error') === 'invalid_grant' ? 'RECONNECT_REQUIRED' : 'GOOGLE_UNAVAILABLE');
        }
        $data = $response->json();
        if (! is_array($data) || empty($data['access_token']) || ! is_numeric($data['expires_in'] ?? null)) {
            throw new AutomaticFailure('GOOGLE_UNAVAILABLE');
        }
        if (isset($data['scope']) && ! in_array(self::SCOPE, explode(' ', $data['scope']), true)) {
            throw new AutomaticFailure('SCOPE_REQUIRED');
        }

        return ['access_token' => $data['access_token'], 'refresh_token' => $data['refresh_token'] ?? null, 'expires_at' => now()->timestamp + (int) $data['expires_in']];
    }

    public function connect(int $userId, string $code, string $verifier): EmailConnection
    {
        if (! $this->configured()) {
            throw new AutomaticFailure('AUTOMATIC_NOT_CONFIGURED');
        }
        $tokens = $this->token(['grant_type' => 'authorization_code', 'code' => $code, 'code_verifier' => $verifier, 'redirect_uri' => config('automatic.redirect_uri')]);
        $profile = $this->request($tokens['access_token'], 'profile');
        if (! filter_var($profile['emailAddress'] ?? '', FILTER_VALIDATE_EMAIL)) {
            throw new AutomaticFailure('GOOGLE_UNAVAILABLE');
        }

        return DB::transaction(function () use ($userId, $profile, $tokens) {
            // Same user lock order as account creation/mode changes/disconnect.
            User::whereKey($userId)->lockForUpdate()->firstOrFail();
            $connection = EmailConnection::firstOrNew(['user_id' => $userId, 'oauth_provider' => 'google', 'email_address' => strtolower($profile['emailAddress'])]);
            $old = $connection->exists && $connection->credentials ? json_decode($connection->credentials, true) : [];
            $tokens['refresh_token'] ??= $old['refresh_token'] ?? null;
            if (! $tokens['refresh_token']) {
                throw new AutomaticFailure('RECONNECT_REQUIRED');
            }
            $connection->fill(['credentials' => json_encode($tokens, JSON_THROW_ON_ERROR), 'is_active' => true])->save();

            return $connection;
        });
    }

    public function access(EmailConnection $connection): string
    {
        if (! $this->configured()) {
            throw new AutomaticFailure('AUTOMATIC_NOT_CONFIGURED');
        }
        $result = DB::transaction(function () use ($connection) {
            $connection = EmailConnection::whereKey($connection->id)->lockForUpdate()->firstOrFail();
            if (! $connection->is_active || ! $connection->credentials) {
                return ['error' => 'RECONNECT_REQUIRED'];
            }
            $tokens = json_decode($connection->credentials, true, 512, JSON_THROW_ON_ERROR);
            if (($tokens['expires_at'] ?? 0) <= now()->timestamp + 60) {
                try {
                    if (empty($tokens['refresh_token'])) {
                        throw new AutomaticFailure('RECONNECT_REQUIRED');
                    }
                    $fresh = $this->token(['grant_type' => 'refresh_token', 'refresh_token' => $tokens['refresh_token']]);
                    $tokens = [...$fresh, 'refresh_token' => $fresh['refresh_token'] ?? $tokens['refresh_token']];
                    $connection->update(['credentials' => json_encode($tokens, JSON_THROW_ON_ERROR)]);
                } catch (AutomaticFailure $error) {
                    if ($error->reason === 'RECONNECT_REQUIRED') {
                        $connection->update(['is_active' => false, 'credentials' => null]);
                    }

                    return ['error' => $error->reason];
                }
            }

            return ['token' => $tokens['access_token']];
        });
        if (isset($result['error'])) {
            throw new AutomaticFailure($result['error']);
        }

        return $result['token'];
    }

    public function request(string $token, string $path, array $query = []): array
    {
        try {
            $response = Http::withToken($token)->connectTimeout(5)->timeout(30)->withOptions(['allow_redirects' => false])->get('https://gmail.googleapis.com/gmail/v1/users/me/'.$path, $query);
        } catch (\Throwable) {
            throw new AutomaticFailure('GOOGLE_UNAVAILABLE');
        }
        if (! $response->successful()) {
            throw new AutomaticFailure($response->status() === 401 ? 'RECONNECT_REQUIRED' : 'GOOGLE_UNAVAILABLE');
        }
        $result = $response->json();
        if (! is_array($result)) {
            throw new AutomaticFailure('GOOGLE_UNAVAILABLE');
        }

        return $result;
    }

    public function revoke(?string $credentials): bool
    {
        try {
            $tokens = $credentials ? json_decode($credentials, true, 512, JSON_THROW_ON_ERROR) : [];
            $token = $tokens['refresh_token'] ?? $tokens['access_token'] ?? null;
            if (! $token) {
                return true;
            }

            return Http::asForm()->connectTimeout(5)->timeout(10)->withOptions(['allow_redirects' => false])->post('https://oauth2.googleapis.com/revoke', ['token' => $token])->successful();
        } catch (\Throwable) {
            return false;
        }
    }
}
