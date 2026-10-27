// Real localhost HTTP + MariaDB synthetic validation. No main financial data.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

async function main() {
  const base = 'http://localhost:8015';
  const origin = 'http://localhost:5185';
  const cookies = new Map();
  const results = [];
  assert.match(process.env.GATE35_DATABASE ?? '', /^tap_flx_gate35_20261027_[a-f0-9]{8}$/, 'Explicit disposable database identity required');
  async function request(path, body, expected = 200, { csrf = true } = {}) {
    const headers = { Accept: 'application/json', Origin: origin, Referer: `${origin}/` };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (csrf && cookies.has('XSRF-TOKEN')) headers['X-XSRF-TOKEN'] = decodeURIComponent(cookies.get('XSRF-TOKEN'));
    headers.Cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const response = await fetch(`${base}${path}`, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
    assert.equal(response.headers.get('x-gate35-database'), process.env.GATE35_DATABASE, 'Refusing a server without the expected disposable database identity');
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.slice(0, cookie.indexOf(';')); const i = pair.indexOf('=');
      cookies.set(pair.slice(0, i), pair.slice(i + 1));
    }
    assert.equal(response.status, expected, `${path}: unexpected HTTP status ${response.status}`);
    assert.equal(response.headers.get('access-control-allow-origin'), origin, `${path}: CORS origin`);
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true', `${path}: credential CORS`);
    const text = await response.text();
    results.push({ endpoint: path.replace(/[a-f0-9]{8}-[a-f0-9-]{27,}/g, '{uuid}'), status: response.status });
    return text ? JSON.parse(text) : null;
  }
  async function reactEntries() {
    // Entry delivery only: this does NOT assert React rendered, layout, or browser E2E.
    for (const route of ['/login', '/register', '/', '/portfolio', '/documents', '/transactions', '/reconciliation']) {
      const page = await fetch(`${origin}${route}`);
      assert.equal(page.status, 200, `${route}: React entry delivery`);
      assert.match(await page.text(), /id="root"/, `${route}: React root`);
      results.push({ frontend_entry: route, status: page.status, rendered_in_browser: false });
    }
  }
  if (process.argv[2] === 'entries') {
    await request('/api/user', undefined, 401); // Verify the isolated server identity first.
    await reactEntries();
    console.log(JSON.stringify({ phase: 'react-entry-delivery-only', checks: results }, null, 2));
    return;
  }
  const credentials = { email: 'gate35@example.test', password: 'Gate35-demo-only!' };
  await request('/api/user', undefined, 401);
  await request('/sanctum/csrf-cookie', undefined, 204);
  await request('/login', credentials, 419, { csrf: false });
  await request('/login', { ...credentials, password: 'wrong-synthetic-password' }, 401);
  await request('/login', credentials);
  const user = await request('/api/user'); assert.equal(user.email, credentials.email);
  const accounts = await request('/api/investment-accounts');
  const account = accounts.data.find(a => a.platform_code === 'stockbit' && !a.account_name.includes('legacy'));
  assert.ok(account, 'Synthetic Stockbit account exists');
  const prefix = `/api/investment-accounts/${account.id}`;
  assert.ok(['pending', 'exercise'].includes(process.argv[2]), 'Use pending or exercise');
  await reactEntries();
  const hash = text => createHash('sha256').update(text).digest('hex');
  const envelope = (key, type) => ({ schema_version: 'integrity-v1', investment_account_id: account.id, confirmed: true, idempotency_key: `gate35-${key}`, source: { provider: 'STOCKBIT', source_type: 'PDF', document_type: type, document_hash: hash(`gate35-${key}`), parser_version: 'synthetic@1' }, transactions: [] });
  async function statement(day, quantity, key) {
    const imported = await request('/api/source-imports', { ...envelope(key, 'SOA'), snapshot: { as_of_date: day, coverage: 'FULL', coverage_confirmed: true, parsed_item_count: 1, items: [{ symbol: 'TSTA', quantity, unit: 'SHARE', currency: 'IDR' }] } });
    const id = imported.results[0].snapshot_id;
    const list = await request(`${prefix}/portfolio-snapshots?as_of=2020-03-31`);
    const descriptor = list.data.find(s => s.id === id); assert.ok(descriptor);
    if (descriptor.review_status !== 'CONFIRMED') await request(`${prefix}/portfolio-snapshots/${id}/confirm`, { confirmed: true, expected_fingerprint: descriptor.fingerprint, coverage: 'FULL', items: descriptor.items.map(i => ({ id: i.id, unit: i.unit })) });
    return id;
  }
  async function trade(day, quantity, type, key) {
    return request('/api/source-imports', { ...envelope(key, 'TC'), transactions: [{ row_key: key, transaction_date: day, date_precision: 'DATE', type, symbol: 'TSTA', unit: 'SHARE', quantity, price: '1', total_amount: '1', currency: 'IDR' }] });
  }
  const opening = await statement('2020-01-31', '100', 'opening');
  await trade('2020-02-10', '30', 'BUY', 'buy');
  await trade('2020-02-15', '10', 'SELL', 'sell');
  const closing = await statement('2020-02-29', '120', 'closing');
  const parameters = { opening_snapshot_id: opening, closing_snapshot_id: closing };
  const initial = (await request(`${prefix}/reconciliation`, parameters)).data;
  assert.equal(initial.status, 'INCOMPLETE'); assert.equal(initial.items[0].numerical_comparison, 'EQUAL');
  assert.ok(initial.items[0].diagnostics.includes('NUMERICALLY_EQUAL_BUT_COVERAGE_UNVERIFIED'));
  if (process.argv[2] === 'pending') {
    const history = await request(`${prefix}/reconciliation-runs`);
    assert.equal(history.available, false); assert.equal(history.code, 'HISTORY_SCHEMA_PENDING');
    await request(`${prefix}/reconciliation-runs`, { ...parameters, expected_input_version: initial.input_version }, 503);
    console.log(JSON.stringify({ phase: 'pending-history', database: process.env.GATE35_DATABASE, comparison_without_history_schema: true, checks: results }, null, 2));
    return;
  }
  const holdings = await request(`${prefix}/holdings?as_of=2020-02-29&baseline_snapshot_id=${opening}`);
  assert.equal(holdings.calculated.items[0].quantity, '120');
  assert.equal(holdings.calculated.status, 'INCOMPLETE');
  const proof = result => ({ confirmed: true, input_version: result.input_version, source_ids: result.evidence.sources.map(s => s.id) });
  const verified = (await request(`${prefix}/reconciliation`, { ...parameters, coverage: proof(initial) })).data;
  assert.equal(verified.status, 'MATCHED'); assert.equal(verified.items[0].difference, '0'); assert.equal(verified.items[0].calculated_quantity, '120');
  assert.equal(verified.coverage.basis, 'USER_ATTESTED_PERIOD'); assert.equal(verified.evidence.sources.length, 4);
  const saving = { ...parameters, coverage: proof(verified), expected_input_version: verified.input_version };
  const saved = await request(`${prefix}/reconciliation-runs`, saving, 201);
  const replay = await request(`${prefix}/reconciliation-runs`, saving);
  assert.equal(replay.replayed, true); assert.equal(replay.run_id, saved.run_id);
  const current = await request(`${prefix}/reconciliation-runs/${saved.run_id}`);
  assert.equal(current.freshness, 'CURRENT'); assert.equal(current.result.status, 'MATCHED');
  const stableHistory = hash(JSON.stringify(current.result));
  const beforeLate = await request('/api/transactions?per_page=100');
  await trade('2020-02-20', '5', 'SELL', 'late-sell');
  const afterLate = await request('/api/transactions?per_page=100');
  assert.equal(afterLate.meta.total, beforeLate.meta.total + 1);
  const stale = await request(`${prefix}/reconciliation-runs/${saved.run_id}`);
  assert.equal(stale.freshness, 'STALE'); assert.equal(stale.is_current, false); assert.equal(stableHistory, hash(JSON.stringify(stale.result)));
  const invalidated = (await request(`${prefix}/reconciliation`, { ...parameters, coverage: proof(verified), previous_input_version: verified.input_version })).data;
  assert.equal(invalidated.coverage.confirmed, false); assert.equal(invalidated.status, 'INCOMPLETE'); assert.equal(invalidated.items[0].difference, '5');
  await request(`${prefix}/reconciliation-runs`, saving, 409);
  const mismatch = (await request(`${prefix}/reconciliation`, { ...parameters, coverage: proof(invalidated) })).data;
  assert.equal(mismatch.status, 'MISMATCH'); assert.equal(mismatch.items[0].calculated_quantity, '115'); assert.equal(mismatch.items[0].difference, '5');
  const second = await request(`${prefix}/reconciliation-runs`, { ...parameters, coverage: proof(mismatch), expected_input_version: mismatch.input_version }, 201);
  const history = await request(`${prefix}/reconciliation-runs`);
  assert.equal(history.available, true); assert.equal(history.data.length, 2);
  assert.equal(history.data.find(r => r.run_id === second.run_id).freshness, 'CURRENT');
  assert.equal(history.data.find(r => r.run_id === saved.run_id).freshness, 'STALE');
  await request(`${prefix}/reconciliation`, { ...parameters, closing_snapshot_id: opening }, 422);
  await request(`${prefix}/reconciliation`, { ...parameters, raw_pdf: 'SYNTHETIC_REJECT_ME' }, 422);
  const secondAccount = accounts.data.find(a => a.platform_code === 'bions');
  await request(`/api/investment-accounts/${secondAccount.id}/reconciliation`, parameters, 404);
  await request('/logout', {});
  await request('/api/user', undefined, 401);
  await request('/sanctum/csrf-cookie', undefined, 204);
  await request('/register', { name: 'Gate35 Synthetic Registration', email: 'gate35-register@example.test', password: credentials.password, password_confirmation: credentials.password }, 201);
  await request(`${prefix}/reconciliation-runs`, undefined, 404);
  await request('/logout', {});
  console.log(JSON.stringify({ phase: 'real-http-runtime', database: process.env.GATE35_DATABASE, matched_then_mismatch: true, idempotent_replay: true, immutable_stale_history: true, checks: results }, null, 2));
}

await main();
