<?php

// Disposable synthetic runtime only. No schema/data copy, main writes or seeder.
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

$root = dirname(__DIR__);
require $root.'/backend/vendor/autoload.php';
$app = require $root.'/backend/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
set_exception_handler(static function (Throwable $error): never {
    if (PHP_SAPI === 'cli') {
        fwrite(STDERR, 'Gate36 validation BLOCKED: '.get_class($error).PHP_EOL);
    } else {
        http_response_code(503);
        header('Content-Type: application/json');
        echo json_encode(['code' => 'GATE36_ISOLATION_BLOCKED']);
    }
    exit(1);
});
$name = getenv('GATE36_DATABASE') ?: '';
$mode = PHP_SAPI === 'cli-server' ? 'serve' : ($argv[1] ?? 'inspect');
if ($app->configurationIsCached() || ! preg_match('/\Atap_flx_gate36_20261027_[a-f0-9]{8}\z/', $name) || ! in_array($mode, ['prepare', 'inspect', 'serve'], true)) {
    throw new RuntimeException('Explicit isolated database and uncached config required.');
}
$config = config('database.connections.mysql');
if (! empty($config['url']) || ! in_array($config['host'], ['localhost', '127.0.0.1'], true)) {
    throw new RuntimeException('Only explicit local mysql configuration supported.');
}
if ($mode === 'prepare') {
    $admin = new PDO('mysql:host='.$config['host'].';port='.$config['port'].';charset=utf8mb4', $config['username'], $config['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $check = $admin->prepare('SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name=?');
    $check->execute([$name]);
    if ((int) $check->fetchColumn() !== 0) {
        throw new RuntimeException('Existing database will not be overwritten.');
    }
    $admin->exec('CREATE DATABASE `'.$name.'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    $admin = null;
}
foreach (array_keys(config('database.connections')) as $old) {
    DB::purge($old);
}
$config['database'] = $name;
$config['url'] = null;
$config['prefix'] = '';
config(['database.default' => 'gate36', 'database.connections' => ['gate36' => $config],
    'app.debug' => false, 'app.url' => 'http://localhost:8026', 'session.driver' => 'database', 'session.connection' => 'gate36',
    'session.cookie' => 'tap_flx_gate36_session', 'session.domain' => null, 'session.secure' => false, 'session.same_site' => 'lax',
    'cache.default' => 'array', 'queue.default' => 'sync', 'mail.default' => 'array',
    'cors.allowed_origins' => ['http://localhost:5186'], 'sanctum.stateful' => ['localhost:5186', 'localhost:8026']]);
DB::setDefaultConnection('gate36');
$db = DB::connection();
if ($db->getDatabaseName() !== $name || $db->selectOne('SELECT DATABASE() AS name')->name !== $name) {
    throw new RuntimeException('Database identity mismatch.');
}
Schema::swap($db->getSchemaBuilder());
if ($mode === 'prepare') {
    foreach (glob($root.'/backend/database/migrations/*.php') as $file) {
        (require $file)->up(); // Direct up(), disposable only; never invokes Artisan migrate/fresh/reset.
    }
}
if ($mode === 'serve') {
    header('X-Gate36-Database: '.$name);
    $app->handleRequest(Request::capture());
} else {
    $counts = [];
    foreach (['users', 'platforms', 'investment_accounts', 'transactions', 'portfolio_snapshots', 'portfolio_snapshot_items', 'source_observations'] as $table) {
        $counts[$table] = DB::table($table)->count();
    }
    echo json_encode(['database' => $name, 'server' => $db->selectOne('SELECT VERSION() AS version')->version, 'counts' => $counts], JSON_PRETTY_PRINT).PHP_EOL;
}
