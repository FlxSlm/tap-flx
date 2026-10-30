<?php

namespace App\Services\Automatic;

use Symfony\Component\Process\Process;

class AttachmentParser
{
    public function parse(string $bytes, string $provider, int $accountId, string $batchKey, ?string $password = null): array
    {
        if (strlen($bytes) > 20 * 1024 * 1024) {
            return ['status' => 'DOCUMENT_LIMIT'];
        }
        // Non-CLI Symfony environments can omit SystemRoot on Windows, breaking Node's
        // CSPRNG initialization. Explicitly retain OS essentials and remove app secrets.
        $inherited = getenv();
        $environment = array_fill_keys(array_unique([...array_keys($inherited), ...array_keys($_ENV), ...array_keys($_SERVER)]), false);
        foreach ($inherited as $key => $value) {
            if (in_array(strtoupper($key), ['SYSTEMROOT', 'WINDIR', 'PATH', 'PATHEXT', 'COMSPEC', 'TEMP', 'TMP', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'LOCALAPPDATA', 'APPDATA'], true)) {
                $environment[$key] = $value;
            }
        }
        $process = new Process([config('automatic.node_binary'), '--max-old-space-size=256', base_path('../frontend/scripts/parse-mail-pdf.mjs')], base_path('../frontend'), $environment, json_encode([
            'pdf' => base64_encode($bytes), 'provider' => $provider, 'account_id' => $accountId,
            'document_hash' => hash('sha256', $bytes), 'batch_key' => $batchKey, 'password' => $password,
        ], JSON_THROW_ON_ERROR), 60);
        try {
            $process->run();
            $output = json_decode($process->getOutput(), true, 512, JSON_THROW_ON_ERROR);
            $codes = ['READY_FOR_REVIEW', 'PASSWORD_REQUIRED', 'WRONG_PASSWORD', 'DECRYPTION_FAILED', 'UNSUPPORTED_DOCUMENT', 'DOCUMENT_LIMIT', 'PROVIDER_MISMATCH', 'VALIDATION_REQUIRED', 'UNKNOWN_PROVIDER', 'NO_MATCHING_ROWS', 'SOURCE_FORMAT_INVALID'];
            if (! $process->isSuccessful() || ! in_array($output['status'] ?? '', $codes, true)) {
                return ['status' => 'PARSER_UNAVAILABLE'];
            }

            return $output;
        } catch (\Throwable) {
            // Process exception messages can contain stdin/password. Never propagate them.
            return ['status' => 'PARSER_UNAVAILABLE'];
        } finally {
            $process->setInput(null);
            $process->clearOutput();
            $process->clearErrorOutput();
        }
    }
}
