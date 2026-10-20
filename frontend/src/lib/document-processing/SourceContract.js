import { BionsTradeConfirmationParser } from './parsers/BionsTradeConfirmationParser';
import { BionsMonthlyStatementParser } from './parsers/BionsMonthlyStatementParser';
import { BionsCorporateActionParser } from './parsers/BionsCorporateActionParser';
import { StockbitTradeConfirmationParser } from './parsers/StockbitTradeConfirmationParser';
import { StockbitMonthlyStatementParser } from './parsers/StockbitMonthlyStatementParser';
import { PluangMonthlyStatementParser } from './parsers/PluangMonthlyStatementParser';

const registry = {
  'BIONS:TC': BionsTradeConfirmationParser,
  'BIONS:SOA': BionsMonthlyStatementParser,
  'BIONS:CA': BionsCorporateActionParser,
  'STOCKBIT:TC': StockbitTradeConfirmationParser,
  'STOCKBIT:SOA': StockbitMonthlyStatementParser,
  'PLUANG:SOA': PluangMonthlyStatementParser,
};

export function sourceParser(provider, type) {
  const Parser = registry[`${provider}:${type}`];
  if (!Parser) throw new Error('Unsupported source. Email parsers require verified samples.');
  return { parser: new Parser(), version: `${provider.toLowerCase()}-${type.toLowerCase()}@integrity-1` };
}

const transactionFields = ['transaction_date', 'date_precision', 'type', 'symbol', 'unit', 'quantity', 'reference_quantity', 'price', 'total_amount', 'currency', 'fee_amount', 'tax_amount', 'gross_amount', 'net_amount', 'settlement_amount', 'amount_semantics', 'external_identifier'];
const snapshotFields = ['symbol', 'quantity', 'average_price', 'market_price', 'market_value', 'currency', 'unit'];
const numeric = new Set(['quantity', 'reference_quantity', 'price', 'total_amount', 'fee_amount', 'tax_amount', 'gross_amount', 'net_amount', 'settlement_amount', 'average_price', 'market_price', 'market_value']);

function pick(row, fields) {
  return Object.fromEntries(fields.map(field => {
    const value = row.exact_values && Object.hasOwn(row.exact_values, field) ? row.exact_values[field] : row[field];
    return [field, value == null ? null : numeric.has(field) ? String(value) : value];
  }));
}

export function buildSourceImport({ accountId, detection, documentHash, batchKey, previewData, selectedRows }) {
  const { version } = sourceParser(detection.provider, detection.type);
  const selected = previewData.filter(row => selectedRows.has(row.id));
  if (!selected.length || selected.some(row => !row.isHardValidationPass || row.status === 'REJECT')) {
    throw new Error('Select valid rows before confirming the import.');
  }
  const result = {
    schema_version: 'integrity-v1', investment_account_id: Number(accountId),
    idempotency_key: batchKey, confirmed: true,
    source: { provider: detection.provider, source_type: 'PDF', document_type: detection.type, document_hash: documentHash, parser_version: version },
    transactions: [],
  };
  if (detection.type === 'SOA') {
    const dates = new Set(selected.map(row => row.data.as_of_date));
    if (dates.size !== 1 || !selected[0].data.as_of_date) throw new Error('Snapshot rows must share an as-of date.');
    result.snapshot = {
      as_of_date: selected[0].data.as_of_date,
      coverage: selected.length < previewData.length ? 'PARTIAL' : 'UNKNOWN',
      coverage_confirmed: false, parsed_item_count: previewData.length,
      items: selected.map(row => ({ ...pick(row.data, snapshotFields), unit: row.data.unit ?? 'UNKNOWN' })),
    };
  } else {
    result.transactions = selected.map(row => ({
      ...pick(row.data, transactionFields), unit: row.data.unit ?? 'UNKNOWN',
      date_precision: row.data.date_precision ?? 'DATE', amount_semantics: row.data.amount_semantics ?? 'UNKNOWN',
      row_key: `row-${row.id}`, confidence: row.score,
    }));
  }
  return result;
}
