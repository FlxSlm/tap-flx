// Opt-in real HTTP + MariaDB integration; never runs against the default API.
import { describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
vi.mock('pdfjs-dist', () => import('pdfjs-dist/legacy/build/pdf.mjs'));
import * as pdfjs from 'pdfjs-dist';
import { PdfExtractor } from '../PdfExtractor';
import { buildSourceImport, sourceParser } from '../SourceContract';
import { ProviderDetection } from '../ProviderDetection';
import { ValidationAndConfidence } from '../ValidationAndConfidence';
import { syntheticPdf, syntheticPassword, monthlyLines } from './syntheticPdf';

const enabled = /^tap_flx_gate36_20261027_[a-f0-9]{8}$/.test(process.env.GATE36_DATABASE ?? '');
describe.skipIf(!enabled)('Gate 3.6 real HTTP/MariaDB with actual encrypted synthetic PDF.js', () => {
  it('logs in, creates owned accounts, imports parsed PDF, replays, and reloads reported holdings', async () => {
    const cookies = new Map();
    const origin = 'http://localhost:5186';
    async function request(url, body, status = 200) {
      const response = await fetch(`http://localhost:8026${url}`, { method: body === undefined ? 'GET' : 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', Origin: origin, Referer: origin + '/', Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '), ...(cookies.has('XSRF-TOKEN') ? { 'X-XSRF-TOKEN': decodeURIComponent(cookies.get('XSRF-TOKEN')) } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000) });
      expect(response.headers.get('X-Gate36-Database')).toBe(process.env.GATE36_DATABASE);
      expect(response.status, url).toBe(status);
      for (const value of response.headers.getSetCookie()) { const pair = value.split(';')[0]; const index = pair.indexOf('='); cookies.set(pair.slice(0, index), pair.slice(index + 1)); }
      const text = await response.text(); return text ? JSON.parse(text) : null;
    }
    const credentials = { email: 'gate36-http@example.test', password: 'Gate36-local-only!' };
    await request('/api/user', undefined, 401);
    await request('/sanctum/csrf-cookie', undefined, 204);
    if (!process.env.GATE36_VERIFY_PERSISTENCE) {
      await request('/register', { ...credentials, password_confirmation: credentials.password, name: 'Gate36 Synthetic HTTP' }, 201);
      await request('/logout', {});
    }
    await request('/login', credentials);
    const before = await request('/api/investment-accounts');
    if (process.env.GATE36_VERIFY_PERSISTENCE) {
      const account = before.data.find(item => item.platform_code === 'stockbit');
      expect(account).toBeTruthy();
      const result = await request(`/api/investment-accounts/${account.id}/holdings?as_of=2020-01-31`);
      expect(result.reported.snapshots[0].items).toHaveLength(4);
      expect(result.reported.snapshots[0].coverage).toBe('UNKNOWN');
      await request('/logout', {});
      return;
    }
    expect(before.data).toEqual([]);
    const accounts = {};
    for (const provider of ['stockbit', 'bions', 'pluang']) accounts[provider] = (await request('/api/investment-accounts', { provider, account_name: `Synthetic ${provider}` }, 201)).data;
    const repeat = await request('/api/investment-accounts', { provider: 'stockbit', account_name: 'synthetic stockbit' });
    expect(repeat.already_exists).toBe(true); expect(repeat.data.id).toBe(accounts.stockbit.id);
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(path.resolve('node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')).href;
    async function parse(lines, password) {
      const bytes = syntheticPdf(lines, { password: password ?? null });
      const file = { size: bytes.byteLength, arrayBuffer: async () => syntheticPdf(lines, { password: password ?? null }) };
      if (password) {
        await expect(PdfExtractor.extractDocument(file)).rejects.toMatchObject({ code: 'PASSWORD_REQUIRED' });
        await expect(PdfExtractor.extractDocument(file, { password: 'wrong' })).rejects.toMatchObject({ code: 'INCORRECT_PASSWORD' });
      }
      const extracted = await PdfExtractor.extractDocument(file, password ? { password } : {});
      const detection = ProviderDetection.detect(extracted.text);
      const parser = sourceParser(detection.provider, detection.type).parser;
      const normalized = parser.normalize(parser.parse(extracted.text));
      return { extracted, detection, rows: normalized.map((data, id) => ({ id, data, ...ValidationAndConfidence.evaluate(data, detection.type === 'SOA' ? 'snapshot' : 'transaction') })) };
    }
    const parsed = await parse(monthlyLines, syntheticPassword);
    expect(parsed.rows).toHaveLength(4);
    const payload = buildSourceImport({ accountId: accounts.stockbit.id, detection: parsed.detection, documentHash: parsed.extracted.documentHash, batchKey: 'gate36-real-pdf', previewData: parsed.rows, selectedRows: new Set([0, 1, 2, 3]) });
    expect(JSON.stringify(payload)).not.toContain(syntheticPassword);
    expect(JSON.stringify(payload)).not.toContain('STATEMENT OF ACCOUNT');
    await request('/api/source-imports', { ...payload, investment_account_id: accounts.bions.id }, 422);
    const stored = await request('/api/source-imports', payload);
    const replay = await request('/api/source-imports', payload);
    expect(replay.replayed).toBe(true); expect(replay.batch_id).toBe(stored.batch_id);
    const receipt = await request(`/api/source-imports/${stored.batch_id}`);
    expect(receipt.current_observations[0].review_status).toBe('REQUIRED');
    for (const reload of [1, 2]) {
      const result = await request(`/api/investment-accounts/${accounts.stockbit.id}/holdings?as_of=2020-01-31`);
      expect(result.reported.snapshots).toHaveLength(1);
      expect(result.reported.snapshots[0].items).toHaveLength(4);
      expect(result.reported.snapshots[0].items[0]).toMatchObject({ symbol: 'TSTA', quantity: '1', unit: 'UNKNOWN' });
      expect(result.reported.snapshots[0].coverage).toBe('UNKNOWN');
      expect(reload).toBeGreaterThan(0);
    }
    for (const lines of [
      ['STOCKBIT TRADE CONFIRMATION', 'Transaction Date 02/01/2020', '9000001 RG TSTA Synthetic Asset 1 100.00 100.00 10,000.00 0.00'],
      ['BIONS TRADE CONFIRMATION', 'Trade Date : Thursday, 02-Jan-2020', '1. SYNTH001 ONLINE B TSTB VP 100.00 10 1,000.00 2.00 0.00 1.00 0.00 0.00 0.00 1,003.00'],
      ['BIONS CORPORATE ACTION ADVICE', '(Payment Date)', '02-Jan-20', 'TSTC 10.00 50.00 10.00 5.00 45.00'],
    ]) {
      const parsed = await parse(lines);
      const provider = parsed.detection.provider.toLowerCase();
      // This synthetic source explicitly specifies SHARE; production never infers it.
      for (const row of parsed.rows) if (['BUY', 'SELL'].includes(row.data.type)) row.data.unit = 'SHARE';
      const trade = buildSourceImport({ accountId: accounts[provider].id, detection: parsed.detection, documentHash: parsed.extracted.documentHash, batchKey: `gate36-${provider}-${parsed.detection.type}`, previewData: parsed.rows, selectedRows: new Set(parsed.rows.map(row => row.id)) });
      expect((await request('/api/source-imports', trade)).results[0].status).toBe('CREATED');
    }
    const transactions = await request('/api/transactions');
    expect(transactions.data).toHaveLength(3);
    expect(transactions.data.find(item => item.type === 'DIVIDEND')).toMatchObject({ quantity: null, price: null, reference_quantity: '10.00000000' });
    await request('/logout', {});
    expect((await fetch('http://localhost:5186/portfolio?account=1&as_of=2020-01-31')).status).toBe(200);
  }, 60000);
});
