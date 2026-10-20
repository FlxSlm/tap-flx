import { describe, it, expect } from 'vitest';
import { sourceParser, buildSourceImport } from '../SourceContract';
import { plainNumber, providerDate, sumNumbers } from '../SourceNumbers';
import { pageText } from '../PdfLayout';
import { ValidationAndConfidence } from '../ValidationAndConfidence';

// All values/identifiers below are invented for contract tests, not copied from PDFs.
const stockbitRow = '9000001 RG TSTA Synthetic Asset 1 100.00 100.00 10,000.00 0.00';
const normalize = (provider, type, text) => {
  const { parser } = sourceParser(provider, type);
  return parser.normalize(parser.parse(text));
};
const preview = data => data.map((item, id) => ({ id, data: item, score: 100, status: 'AUTO ACCEPT', isHardValidationPass: true }));
const envelope = (detection, data, selected = new Set(data.map((_, i) => i))) => buildSourceImport({
  accountId: 1, detection, documentHash: 'a'.repeat(64), batchKey: 'synthetic-batch',
  previewData: preview(data), selectedRows: selected,
});

describe('source integrity contract', () => {
  it('preserves exact decimals without float addition', () => {
    expect(plainNumber('9,999,999,999,999.12345678')).toBe('9999999999999.12345678');
    expect(sumNumbers('0.1', '0.2')).toBe('0.3');
    expect(sumNumbers('999,999.99', '0.01')).toBe('1000000.00');
    expect(sumNumbers(null, '1')).toBeNull();
  });

  it('keeps gross/net/fee/tax separate for synthetic BIONS TC', () => {
    const data = normalize('BIONS', 'TC', 'Trade Date : Thursday, 02-Jan-2020\n1. SYNTH001 ONLINE B TSTA VP 100.00 10 1,000.00 2.00 0.00 1.00 0.00 0.00 0.00 1,003.00');
    const payload = envelope({ provider: 'BIONS', type: 'TC' }, data);
    expect(payload.transactions[0]).toMatchObject({ gross_amount: '1000.00', net_amount: '1003.00', fee_amount: '2.00', tax_amount: '1.00', total_amount: '1003.00', amount_semantics: 'NET', external_identifier: 'SYNTH001' });
    expect(payload.transactions[0].settlement_amount).toBeNull();
  });

  it('keeps Stockbit row fee/net/tax unavailable instead of zero', () => {
    const data = normalize('STOCKBIT', 'TC', `Transaction Date 02/01/2020\n${stockbitRow}`);
    const tx = envelope({ provider: 'STOCKBIT', type: 'TC' }, data).transactions[0];
    expect(tx).toMatchObject({ gross_amount: '10000.00', fee_amount: null, net_amount: null, tax_amount: null, amount_semantics: 'GROSS' });
  });

  it('models cash dividend with reference holdings and no synthetic price', () => {
    const data = normalize('BIONS', 'CA', '(Payment Date)\n02-Jan-20\nTSTA 10.00 50.00 10.00 5.00 45.00');
    const tx = envelope({ provider: 'BIONS', type: 'CA' }, data).transactions[0];
    expect(tx).toMatchObject({ quantity: null, reference_quantity: '10.00', price: null, tax_amount: '5.00', net_amount: '45.00', fee_amount: null, transaction_date: '2020-01-02 00:00:00' });
    expect(ValidationAndConfidence.evaluate(data[0]).isHardValidationPass).toBe(true);
  });

  it('partial selection is partial coverage; selecting all never implies full document coverage', () => {
    const data = [0, 1].map(i => ({ symbol: i ? 'TSTB' : 'TSTA', quantity: 10, as_of_date: '2020-01-31', currency: 'IDR' }));
    expect(envelope({ provider: 'STOCKBIT', type: 'SOA' }, data, new Set([0])).snapshot.coverage).toBe('PARTIAL');
    expect(envelope({ provider: 'STOCKBIT', type: 'SOA' }, data).snapshot.coverage).toBe('UNKNOWN');
    expect(envelope({ provider: 'STOCKBIT', type: 'SOA' }, data).transactions).toEqual([]);
  });

  it('only serializes allowlisted structured fields after selection', () => {
    const data = normalize('STOCKBIT', 'TC', `Transaction Date 02/01/2020\n${stockbitRow}`);
    data[0].raw_pdf = 'SYNTHETIC_PRIVATE_MARKER';
    data[0].password = 'SYNTHETIC_PRIVATE_MARKER';
    data[0].source_metadata = { filename: 'SYNTHETIC_PRIVATE_MARKER' };
    expect(JSON.stringify(envelope({ provider: 'STOCKBIT', type: 'TC' }, data))).not.toContain('SYNTHETIC_PRIVATE_MARKER');
    expect(() => envelope({ provider: 'STOCKBIT', type: 'TC' }, data, new Set())).toThrow();
  });

  it('rejects unsupported email and imaginary PDF parsers', () => {
    expect(() => sourceParser('PLUANG', 'TC')).toThrow();
    expect(() => sourceParser('STOCKBIT', 'DIVIDEND_EMAIL')).toThrow();
  });

  it('preserves row boundaries that anchored parsers require', () => {
    const text = pageText([
      { str: 'Transaction Date 02/01/2020', transform: [1, 0, 0, 1, 20, 700] },
      { str: stockbitRow, transform: [1, 0, 0, 1, 20, 680] },
    ]);
    expect(normalize('STOCKBIT', 'TC', text)).toHaveLength(1);
  });

  it('restores reading order when PDF objects are stored by column rather than row', () => {
    const text = pageText([
      { str: 'right', transform: [1, 0, 0, 1, 80, 680], hasEOL: true },
      { str: 'header', transform: [1, 0, 0, 1, 20, 700], hasEOL: true },
      { str: 'left', transform: [1, 0, 0, 1, 20, 680], hasEOL: true },
    ]);
    expect(text).toBe('header\nleft right');
  });

  it('uses provider calendar dates and rejects invalid calendar dates', () => {
    expect(providerDate('02-Jan-20', 'month-name')).toBe('2020-01-02');
    expect(providerDate('31/02/2020', 'numeric')).toBeNull();
    expect(providerDate('02/01/2020', 'numeric')).toBe('2020-01-02');
  });

  it('rejects bad snapshot quantities and gross arithmetic instead of auto accepting', () => {
    expect(ValidationAndConfidence.evaluate({ symbol: 'TSTA', as_of_date: '2020-01-31', quantity: -1, market_value: 1, average_price: 1 }, 'snapshot').status).toBe('REJECT');
    expect(ValidationAndConfidence.evaluate({ symbol: 'TSTA', transaction_date: '2020-01-02', type: 'BUY', quantity: 10, price: 100, total_amount: 900, gross_amount: 900 }).status).toBe('REJECT');
  });
});
