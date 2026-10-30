<?php

return [
    // Disabled until the owner configures an isolated environment.
    'enabled' => env('AUTOMATIC_ENABLED', false),
    'client_id' => env('GOOGLE_CLIENT_ID'),
    'client_secret' => env('GOOGLE_CLIENT_SECRET'),
    'redirect_uri' => env('GOOGLE_REDIRECT_URI', 'http://localhost:8000/automatic/gmail/callback'),
    'frontend_url' => env('AUTOMATIC_FRONTEND_URL', 'http://localhost:5173/connections'),
    'orchestrator_secret' => env('AUTOMATIC_ORCHESTRATOR_SECRET'),
    'orchestrator_ips' => explode(',', env('AUTOMATIC_ORCHESTRATOR_IPS', '127.0.0.1,::1')),
    'gmail_label' => env('AUTOMATIC_GMAIL_LABEL', 'TAP_FLX_IMPORT'),
    // Exact email addresses only. Sender matching is a filter, never proof of authenticity.
    'senders' => [
        'BIONS' => array_filter(explode(',', env('AUTOMATIC_BIONS_SENDERS', ''))),
        'STOCKBIT' => array_filter(explode(',', env('AUTOMATIC_STOCKBIT_SENDERS', ''))),
        'PLUANG' => array_filter(explode(',', env('AUTOMATIC_PLUANG_SENDERS', ''))),
    ],
    'node_binary' => env('AUTOMATIC_NODE_BINARY', 'node'),
];
