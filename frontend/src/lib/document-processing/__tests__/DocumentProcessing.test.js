import { describe, it, expect } from 'vitest';
import { ProviderDetection } from '../ProviderDetection.js';
import StockbitParser from '../parsers/StockbitParser.js';
import PluangParser from '../parsers/PluangParser.js';
import BionsParser from '../parsers/BionsParser.js';
import { ValidationAndConfidence } from '../ValidationAndConfidence.js';

describe('ProviderDetection', () => {
  it('detects Stockbit', () => {
    expect(ProviderDetection.detect('Statement from PT Stockbit Sekuritas')).toBe('Stockbit');
  });

  it('detects Pluang', () => {
    expect(ProviderDetection.detect('Invoice PLUANG BTC')).toBe('Pluang');
  });

  it('detects BIONS', () => {
    expect(ProviderDetection.detect('Trade confirmation BNI Sekuritas (BIONS)')).toBe('BIONS');
  });

  it('returns null for unknown', () => {
    expect(ProviderDetection.detect('Random text')).toBeNull();
  });
});

describe('Parsers & Normalization', () => {
  it('StockbitParser works', () => {
    const parser = new StockbitParser();
    const text = "2026-09-01 BUY BBCA 100 8500 850000";
    const raw = parser.parse(text);
    expect(raw).toHaveLength(1);
    
    const normalized = parser.normalize(raw);
    expect(normalized[0].transaction_date).toBe('2026-09-01');
    expect(normalized[0].type).toBe('BUY');
    expect(normalized[0].symbol).toBe('BBCA');
    expect(normalized[0].quantity).toBe(100);
    expect(normalized[0].price).toBe(8500);
    expect(normalized[0].total_amount).toBe(850000);
    expect(normalized[0].source_metadata.provider).toBe('Stockbit');
  });

  it('PluangParser works', () => {
    const parser = new PluangParser();
    const text = "01/09/2026 BUY BTC 0.5 900000000 450000000";
    const raw = parser.parse(text);
    const normalized = parser.normalize(raw);
    expect(normalized[0].transaction_date).toBe('2026-09-01');
    expect(normalized[0].type).toBe('BUY');
    expect(normalized[0].symbol).toBe('BTC');
  });

  it('BionsParser works', () => {
    const parser = new BionsParser();
    const text = "Beli BBRI 50 5000 250000 2026-09-01";
    const raw = parser.parse(text);
    const normalized = parser.normalize(raw);
    expect(normalized[0].transaction_date).toBe('2026-09-01');
    expect(normalized[0].type).toBe('BUY');
    expect(normalized[0].symbol).toBe('BBRI');
  });
});

describe('ValidationAndConfidence', () => {
  it('Auto Accepts perfect transaction', () => {
    const tx = {
      transaction_date: '2026-09-01',
      type: 'BUY',
      symbol: 'BBCA',
      quantity: 100,
      price: 8500,
      total_amount: 850000
    };
    const result = ValidationAndConfidence.evaluate(tx);
    expect(result.score).toBe(100);
    expect(result.status).toBe('AUTO ACCEPT');
    expect(result.isHardValidationPass).toBe(true);
  });

  it('Rejects transaction with missing fields', () => {
    const tx = {
      transaction_date: 'invalid-date',
      type: 'BUY',
      symbol: '',
      quantity: -5,
      price: 8500,
      total_amount: 850000
    };
    const result = ValidationAndConfidence.evaluate(tx);
    expect(result.status).toBe('REJECT');
    expect(result.isHardValidationPass).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
