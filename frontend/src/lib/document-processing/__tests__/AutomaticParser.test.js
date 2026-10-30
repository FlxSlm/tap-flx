import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { syntheticPdf, monthlyLines, syntheticPassword } from './syntheticPdf';

function parse(lines, { password = null, provided = null, provider = 'STOCKBIT', invalid = false } = {}) {
  const bytes = invalid ? Buffer.from('invalid synthetic PDF') : Buffer.from(syntheticPdf(lines, password ? { password } : {}));
  const result = spawnSync(process.execPath, ['scripts/parse-mail-pdf.mjs'], { input: JSON.stringify({
    pdf: bytes.toString('base64'), account_id: 1, provider, document_hash: createHash('sha256').update(bytes).digest('hex'), batch_key: 'synthetic-mail', password: provided,
  }), encoding: 'utf8', timeout: 20000 });
  expect(result.status).toBe(0);
  expect(result.stderr).not.toContain(syntheticPassword);
  expect(result.stdout).not.toContain(syntheticPassword);
  return JSON.parse(result.stdout);
}

describe('actual isolated server PDF.js worker', () => {
  it('keeps typed password states and permits a correct ephemeral password', () => {
    expect(parse(monthlyLines, { password: syntheticPassword }).status).toBe('PASSWORD_REQUIRED');
    expect(parse(monthlyLines, { password: syntheticPassword, provided: 'wrong' }).status).toBe('WRONG_PASSWORD');
    const result = parse(monthlyLines, { password: syntheticPassword, provided: syntheticPassword });
    expect(result.status).toBe('READY_FOR_REVIEW');
    expect(result.payload.snapshot.items).toHaveLength(4);
    expect(result.payload).not.toHaveProperty('password');
  }, 20000);
  it('rejects malformed bytes and provider mismatch without guessed rows', () => {
    expect(parse([], { invalid: true }).status).toBe('UNSUPPORTED_DOCUMENT');
    expect(parse(monthlyLines, { provider: 'BIONS' }).status).toBe('PROVIDER_MISMATCH');
  });
  it('maps BIONS SOA columns and leaves coverage/unit unknown', () => {
    const result = parse(['BIONS CLIENT STATEMENT', 'From : Wednesday, 01-Jan-2020 To : Friday, 31-Jan-2020',
      '1 TSTA-Synthetic Asset 10 100.00 1,000.00 110.00 1,100.00 100.00 10 %',
      '2 TSTB-Synthetic Asset 20 200.00 4,000.00 210.00 4,200.00 200.00 5 %'], { provider: 'BIONS' });
    expect(result.status).toBe('READY_FOR_REVIEW');
    expect(result.payload.snapshot).toMatchObject({ as_of_date: '2020-01-31', coverage: 'UNKNOWN', coverage_confirmed: false, parsed_item_count: 2 });
    expect(result.payload.snapshot.items).toEqual([
      { symbol: 'TSTA', quantity: '10', average_price: '100.00', market_price: '110.00', market_value: '1100.00', currency: 'IDR', unit: 'UNKNOWN' },
      { symbol: 'TSTB', quantity: '20', average_price: '200.00', market_price: '210.00', market_value: '4200.00', currency: 'IDR', unit: 'UNKNOWN' },
    ]);
  });
  it('maps BIONS TC exact gross/net, fee, tax, date and reference', () => {
    const result = parse(['BIONS TRADE CONFIRMATION', 'Trade Date : Thursday, 02-Jan-2020',
      '1. SYNTH001 ONLINE B TSTA VP 100.00 10 1,000.00 2.00 0.00 1.00 0.00 0.00 0.00 1,003.00'], { provider: 'BIONS' });
    expect(result.status).toBe('READY_FOR_REVIEW');
    expect(result.payload.transactions).toHaveLength(1);
    expect(result.payload.transactions[0]).toMatchObject({ transaction_date: '2020-01-02 00:00:00', type: 'BUY', symbol: 'TSTA', quantity: '10', price: '100.00',
      gross_amount: '1000.00', net_amount: '1003.00', fee_amount: '2.00', tax_amount: '1.00', amount_semantics: 'NET', external_identifier: 'SYNTH001', unit: 'UNKNOWN' });
  });
  it('maps BIONS CA reference balance without creating a quantity delta', () => {
    const result = parse(['BIONS CORPORATE ACTION ADVICE', '(Payment Date)', '02-Jan-20', 'TSTA 10.00 50.00 10.00 5.00 45.00'], { provider: 'BIONS' });
    expect(result.status).toBe('READY_FOR_REVIEW');
    expect(result.payload.transactions[0]).toMatchObject({ type: 'DIVIDEND', symbol: 'TSTA', quantity: null, price: null, reference_quantity: '10.00', gross_amount: '50.00', tax_amount: '5.00', net_amount: '45.00', transaction_date: '2020-01-02 00:00:00' });
  });
});
