<?php

// Local synthetic validation only. Never uses Artisan migrate, reset, wipe, or seed.
// Supply a NEW database name: tap_flx_gate35_20261027_<8 lowercase hex digits>.
use App\Models\InvestmentAccount;
use App\Models\Platform;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

$root = dirname(__DIR__);
require $root.'/backend/vendor/autoload.php';
$app = require $root.'/backend/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
// Laravel's CLI exception renderer may exit zero outside an Artisan command.
// Every harness failure must stop shell workflows; never expose DB error details.
set_exception_handler(static function (Throwable $exception): never {
    if (PHP_SAPI === 'cli') {
        fwrite(STDERR, 'Gate35 validation BLOCKED: '.get_class($exception).PHP_EOL);
    } else {
        http_response_code(503);
        header('Content-Type: application/json');
        echo json_encode(['code' => 'GATE35_VALIDATION_BLOCKED']);
    }
    exit(1);
});
if ($app->configurationIsCached()) {
    throw new RuntimeException('Refusing cached application configuration.');
}
$name = getenv('GATE35_DATABASE') ?: '';
if (! preg_match('/\Atap_flx_gate35_20261027_[a-f0-9]{8}\z/', $name)) {
    throw new RuntimeException('An explicit, isolated Gate 3.5 database name is required.');
}
$mode = PHP_SAPI === 'cli-server' ? 'serve' : ($argv[1] ?? 'inspect');
if (! in_array($mode, ['prepare', 'upgrade', 'inspect', 'constraints', 'serve'], true)) {
    throw new RuntimeException('Unknown validation mode.');
}
$connection = config('database.connections.mysql');
if (! empty($connection['url']) || ! in_array($connection['host'], ['127.0.0.1', 'localhost'], true)) {
    throw new RuntimeException('Only explicit local mysql configuration without a URL is supported.');
}
if ($mode === 'prepare') {
    // This connection has NO selected database. Existing databases are never reused.
    $admin = new PDO('mysql:host='.$connection['host'].';port='.$connection['port'].';charset=utf8mb4', $connection['username'], $connection['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $exists = $admin->prepare('SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name=?');
    $exists->execute([$name]);
    if ((int) $exists->fetchColumn() !== 0) {
        throw new RuntimeException('Disposable database already exists; refusing to overwrite or clear it.');
    }
    $admin->exec('CREATE DATABASE `'.$name.'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    $admin = null;
}
$connection['database'] = $name;
$connection['url'] = null;
$connection['prefix'] = '';
foreach (array_keys(config('database.connections')) as $old) {
    DB::purge($old);
}
config([
    'database.default' => 'gate35', 'database.connections' => ['gate35' => $connection],
    'app.debug' => false, 'app.url' => 'http://localhost:8015',
    'session.driver' => 'database', 'session.connection' => 'gate35',
    'session.cookie' => 'tap_flx_gate35_session', 'session.domain' => null,
    'session.secure' => false, 'session.same_site' => 'lax',
    'cache.default' => 'array', 'queue.default' => 'sync', 'mail.default' => 'array',
    'cors.allowed_origins' => ['http://localhost:5185'],
    'sanctum.stateful' => ['localhost:5185', 'localhost:8015'],
]);
DB::setDefaultConnection('gate35');
$db = DB::connection('gate35');
if ($db->getDatabaseName() !== $name || $db->selectOne('SELECT DATABASE() AS name')->name !== $name || $name === 'myportfolio') {
    throw new RuntimeException('Database identity guard failed.');
}
Schema::swap($db->getSchemaBuilder());
$evidenceDir = $root.'/.local-backups/gate35/'.$name;
if (! is_dir($evidenceDir)) {
    mkdir($evidenceDir, 0700, true);
}
$stateFile = $evidenceDir.'/validation.json';
$historyFile = $root.'/backend/database/migrations/2026_10_26_000001_add_reconciliation_history.php';
$fingerprints = function (): array {
    $result = [];
    foreach (['users', 'platforms', 'investment_accounts', 'transactions', 'portfolio_snapshots', 'portfolio_snapshot_items', 'source_documents', 'import_batches', 'source_observations', 'integrity_audit_events'] as $table) {
        $rows = DB::table($table)->orderBy('id')->get()->toArray();
        $result[$table] = ['count' => count($rows), 'sha256' => hash('sha256', json_encode($rows, JSON_THROW_ON_ERROR))];
    }

    return $result;
};
if ($mode === 'prepare') {
    foreach (glob($root.'/backend/database/migrations/*.php') as $file) {
        if ($file !== $historyFile) {
            (require $file)->up();
        }
    }
    // Legacy rows exist BEFORE the history upgrade; separate from demo accounts.
    $owner = User::create(['name' => 'Gate 3.5 Synthetic Investor', 'email' => 'gate35@example.test', 'password' => 'Gate35-demo-only!']);
    foreach (['stockbit' => 'Stockbit', 'bions' => 'BIONS', 'pluang' => 'Pluang Crypto'] as $code => $label) {
        $platform = Platform::create(['code' => $code, 'name' => $label]);
        InvestmentAccount::create(['user_id' => $owner->id, 'platform_id' => $platform->id, 'account_name' => 'SYNTHETIC '.strtoupper($code)]);
    }
    $legacy = InvestmentAccount::create(['user_id' => $owner->id, 'platform_id' => 1, 'account_name' => 'SYNTHETIC legacy preservation']);
    DB::table('transactions')->insert(['investment_account_id' => $legacy->id, 'transaction_date' => '2020-02-10', 'type' => 'BUY', 'symbol' => 'TSTA', 'quantity' => '9999999999999999.12345678', 'total_amount' => '123.4567', 'transaction_hash' => hash('sha256', 'gate35-legacy')]);
    $snapshot = DB::table('portfolio_snapshots')->insertGetId(['investment_account_id' => $legacy->id, 'as_of_date' => '2020-01-31', 'provider' => 'STOCKBIT', 'snapshot_hash' => hash('sha256', 'gate35-legacy-snapshot')]);
    DB::table('portfolio_snapshot_items')->insert(['portfolio_snapshot_id' => $snapshot, 'symbol' => 'TSTA', 'quantity' => '0.12345678']);
    $state = ['database' => $name, 'server' => $db->selectOne('SELECT VERSION() AS version')->version, 'before' => $fingerprints(), 'upgrade_applied' => false];
    file_put_contents($stateFile, json_encode($state, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));
    echo json_encode(['database' => $name, 'server' => $state['server'], 'history_available' => false, 'synthetic_accounts' => 4], JSON_PRETTY_PRINT).PHP_EOL;
} elseif ($mode === 'upgrade') {
    if (! is_file($stateFile)) {
        throw new RuntimeException('Missing preparation evidence.');
    }
    $state = json_decode(file_get_contents($stateFile), true, 512, JSON_THROW_ON_ERROR);
    if ($state['database'] !== $name || $state['upgrade_applied'] || Schema::hasTable('reconciliation_runs') || Schema::hasTable('reconciliation_items')) {
        throw new RuntimeException('Refusing existing history schema or mismatched preparation.');
    }
    // Runtime login/session rows are intentionally excluded; financial rows must match.
    $before = $fingerprints();
    (require $historyFile)->up();
    $after = $fingerprints();
    if ($before !== $after) {
        throw new RuntimeException('History upgrade changed existing rows.');
    }
    $state['upgrade_applied'] = true;
    $state['preserved_tables'] = $after;
    $state['history_migration_sha256'] = hash_file('sha256', $historyFile);
    file_put_contents($stateFile, json_encode($state, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));
    echo json_encode(['database' => $name, 'existing_tables_preserved' => count($after), 'history_available' => true], JSON_PRETTY_PRINT).PHP_EOL;
} elseif ($mode === 'inspect') {
    $tables = $db->select("SELECT table_name, engine FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('reconciliation_runs','reconciliation_items') ORDER BY table_name");
    $constraints = $db->select("SELECT constraint_type, COUNT(*) AS total FROM information_schema.table_constraints WHERE constraint_schema=DATABASE() AND table_name IN ('reconciliation_runs','reconciliation_items') GROUP BY constraint_type ORDER BY constraint_type");
    $jsonColumns = $db->select("SELECT table_name, column_name, data_type, collation_name FROM information_schema.columns WHERE table_schema=DATABASE() AND ((table_name='reconciliation_runs' AND column_name IN ('parameters','summary')) OR (table_name='reconciliation_items' AND column_name='result')) ORDER BY table_name,column_name");
    echo json_encode(['database' => $name, 'server' => $db->selectOne('SELECT VERSION() AS version')->version, 'tables' => $tables, 'constraints' => $constraints, 'json_columns' => $jsonColumns, 'runs' => Schema::hasTable('reconciliation_runs') ? DB::table('reconciliation_runs')->count() : null], JSON_PRETTY_PRINT).PHP_EOL;
} elseif ($mode === 'constraints') {
    $checks = [];
    $run = (array) DB::table('reconciliation_runs')->orderBy('id')->first();
    $item = (array) DB::table('reconciliation_items')->orderBy('id')->first();
    if (! $run || ! $item) {
        throw new RuntimeException('Run the HTTP exercise first.');
    }
    $reject = function (string $label, callable $operation, int $error) use (&$checks): void {
        DB::beginTransaction();
        try {
            $operation();
        } catch (QueryException $exception) {
            if ((int) ($exception->errorInfo[1] ?? 0) !== $error) {
                throw $exception;
            }
            $checks[$label] = ['rejected' => true, 'mariadb_error' => $error];
        } finally {
            DB::rollBack();
        }
        if (! isset($checks[$label])) {
            throw new RuntimeException('Expected constraint was not enforced: '.$label);
        }
    };
    $copy = $run;
    unset($copy['id']);
    $copy['public_id'] = (string) Str::uuid();
    $reject('account_result_unique', fn () => DB::table('reconciliation_runs')->insert($copy), 1062);
    $copy['result_fingerprint'] = hash('sha256', 'gate35-fk-probe');
    $copy['actor_id'] = 999999;
    $reject('actor_fk', fn () => DB::table('reconciliation_runs')->insert($copy), 1452);
    $copy = $item;
    unset($copy['id']);
    $reject('run_asset_unit_unique', fn () => DB::table('reconciliation_items')->insert($copy), 1062);
    $reject('snapshot_restrict', fn () => DB::table('portfolio_snapshots')->where('id', $run['opening_snapshot_id'])->delete(), 1451);
    $reject('history_restrict', fn () => DB::table('reconciliation_runs')->where('id', $run['id'])->delete(), 1451);
    foreach (['parameters', 'summary'] as $column) {
        $reject('json_'.$column, fn () => DB::table('reconciliation_runs')->where('id', $run['id'])->update([$column => '{invalid-json']), 4025);
    }
    $reject('json_result', fn () => DB::table('reconciliation_items')->where('id', $item['id'])->update(['result' => '{invalid-json']), 4025);
    DB::beginTransaction();
    try {
        $precise = ['quantity' => '9999999999999999.12345678', 'crypto_delta' => '0.00000001', 'unknown' => null];
        DB::table('reconciliation_items')->where('id', $item['id'])->update(['result' => json_encode($precise, JSON_THROW_ON_ERROR)]);
        $stored = DB::table('reconciliation_items')->where('id', $item['id'])->value('result');
        if (json_decode($stored, true, 512, JSON_THROW_ON_ERROR) !== $precise) {
            throw new RuntimeException('Exact decimal JSON roundtrip failed.');
        }
        $type = DB::selectOne("SELECT JSON_TYPE(JSON_EXTRACT(result, '$.quantity')) AS kind FROM reconciliation_items WHERE id=?", [$item['id']])->kind;
        if ($type !== 'STRING') {
            throw new RuntimeException('JSON converted decimal string into a number.');
        }
        $checks['exact_decimal_json_roundtrip'] = true;
    } finally {
        DB::rollBack();
    }
    $state = json_decode(file_get_contents($stateFile), true, 512, JSON_THROW_ON_ERROR);
    $state['constraint_checks'] = $checks;
    file_put_contents($stateFile, json_encode($state, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));
    echo json_encode(['database' => $name, 'checks' => $checks, 'probe_writes_rolled_back' => true], JSON_PRETTY_PRINT).PHP_EOL;
} else {
    // Normal Laravel HTTP kernel/middleware, real sessions/CSRF; no testing bypass.
    header('X-Gate35-Database: '.$name);
    $app->handleRequest(Request::capture());
}
