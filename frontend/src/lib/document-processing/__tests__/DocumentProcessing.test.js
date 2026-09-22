import { describe, it, expect } from 'vitest';
import { ProviderDetection } from '../ProviderDetection';
import { ValidationAndConfidence } from '../ValidationAndConfidence';
import { BionsTradeConfirmationParser } from '../parsers/BionsTradeConfirmationParser';
import { BionsMonthlyStatementParser } from '../parsers/BionsMonthlyStatementParser';
import { BionsCorporateActionParser } from '../parsers/BionsCorporateActionParser';
import { PluangMonthlyStatementParser } from '../parsers/PluangMonthlyStatementParser';
import { StockbitTradeConfirmationParser } from '../parsers/StockbitTradeConfirmationParser';
import { StockbitMonthlyStatementParser } from '../parsers/StockbitMonthlyStatementParser';

describe('Document Processing Core (Actual Fixtures)', () => {

  describe('ProviderDetection', () => {
    it('detects BIONS TC', () => {
      const text = "TRADE CONFIRMATION ... PT BNI Sekuritas ... 1. NI2735284 ONLINE S AADI VP 10,050.000000 400";
      const result = ProviderDetection.detect(text);
      expect(result.provider).toBe('BIONS');
      expect(result.type).toBe('TC');
    });

    it('detects Pluang SOA', () => {
      const text = "Crypto Assets Monthly Portfolio Summary\nPT Bumi Santosa Cemerlang";
      const result = ProviderDetection.detect(text);
      expect(result.provider).toBe('PLUANG');
      expect(result.type).toBe('SOA');
    });

    it('detects Stockbit SOA', () => {
      const text = "PT. STOCKBIT SEKURITAS DIGITAL\nStatement of Account";
      const result = ProviderDetection.detect(text);
      expect(result.provider).toBe('STOCKBIT');
      expect(result.type).toBe('SOA');
    });
  });

  describe('Parsers', () => {
    it('parses BIONS Trade Confirmation', () => {
      const text = `Trade Date : Monday, 02-Mar-2026\n1. NI2735284 ONLINE S AADI VP 10,050.000000 400 4,020,000.00 4,588.00 0.00 505.00 4,020.00 1,608.00 133.00 4,009,146.00`;
      const parser = new BionsTradeConfirmationParser();
      const raw = parser.parse(text);
      expect(raw.length).toBe(1);
      expect(raw[0].symbol).toBe('AADI');
      expect(raw[0].type).toBe('SELL');
      expect(raw[0].quantity).toBe(400);
      expect(raw[0].netAmount).toBe(4009146);
      
      const norm = parser.normalize(raw);
      expect(norm[0].total_amount).toBe(4009146);
      expect(norm[0].transaction_date).toBe('2026-03-02 00:00:00');
    });

    it('parses BIONS Monthly Statement', () => {
      const text = `CLIENT STATEMENT\nFrom : Wednesday, 01-Jul-2026 To : Friday, 31-Jul-2026\n1 BBCA-BANK CENTRAL ASIA Tbk 500 7,730.00 3,865,000 6,325 3,162,500 -702,500 -18 %`;
      const parser = new BionsMonthlyStatementParser();
      const raw = parser.parse(text);
      expect(raw.length).toBe(1);
      expect(raw[0].symbol).toBe('BBCA');
      expect(raw[0].quantity).toBe(500);
      expect(raw[0].average_price).toBe(7730);
      expect(raw[0].market_value).toBe(3162500);

      const norm = parser.normalize(raw);
      expect(norm[0].as_of_date).toBe('2026-07-31');
    });

    it('parses BIONS Corporate Action', () => {
      const text = `(Payment Date)\n16-Sep-26\nBBCA 500.00 12,500.00 0.00 0.00 12,500.00`;
      const parser = new BionsCorporateActionParser();
      const raw = parser.parse(text);
      expect(raw.length).toBe(1);
      expect(raw[0].type).toBe('DIVIDEND');
      expect(raw[0].symbol).toBe('BBCA');
      expect(raw[0].quantity).toBe(500);
      expect(raw[0].netAmount).toBe(12500);
    });

    it('parses Pluang Monthly Statement', () => {
      const text = `Period : 31 Aug 2026\nBTC 0.00703327 Rp1,490,227,421 Rp1,390,860,900 Rp9,782,300 -Rp698,871`;
      const parser = new PluangMonthlyStatementParser();
      const raw = parser.parse(text);
      expect(raw[0].symbol).toBe('BTC');
      expect(raw[0].quantity).toBe(0.00703327);
      expect(raw[0].average_price).toBe(1490227421);
      
      const norm = parser.normalize(raw);
      expect(norm[0].as_of_date).toBe('2026-08-31');
    });

    it('parses Stockbit Trade Confirmation', () => {
      const text = `Transaction Date 02/04/2026\n0082249 RG BBRI Bank Rakyat Indonesia (Persero) Tbk. 5 500.00 3,330.00 1,665,000.00 0.00`;
      const parser = new StockbitTradeConfirmationParser();
      const raw = parser.parse(text);
      expect(raw[0].symbol).toBe('BBRI');
      expect(raw[0].quantity).toBe(500);
      expect(raw[0].total_amount).toBe(1665000);
      expect(raw[0].type).toBe('BUY');
    });

    it('parses Stockbit Monthly Statement', () => {
      const text = `Date 01/08/2026 - 31/08/2026\nBBCA Bank Central Asia Tbk. 6,900 7,674.28 6,475 52,952,500 44,677,500 -8,275,000 -15.63`;
      const parser = new StockbitMonthlyStatementParser();
      const raw = parser.parse(text);
      expect(raw[0].symbol).toBe('BBCA');
      expect(raw[0].quantity).toBe(6900);
      expect(raw[0].average_price).toBe(7674.28);
      expect(raw[0].market_value).toBe(44677500);
    });
  });

  describe('ValidationAndConfidence', () => {
    it('evaluates transaction profile', () => {
      const tx = {
        symbol: 'BBCA',
        transaction_date: '2026-09-01 00:00:00',
        type: 'BUY',
        quantity: 10,
        price: 1000,
        total_amount: 10000,
        fee_amount: 0
      };
      const result = ValidationAndConfidence.evaluate(tx, 'transaction');
      expect(result.score).toBe(100);
      expect(result.status).toBe('AUTO ACCEPT');
    });

    it('evaluates snapshot profile', () => {
      const snap = {
        symbol: 'BBCA',
        as_of_date: '2026-09-01',
        quantity: 500,
        average_price: 1000,
        market_price: 1100,
        market_value: 550000
      };
      const result = ValidationAndConfidence.evaluate(snap, 'snapshot');
      expect(result.score).toBe(100);
      expect(result.status).toBe('AUTO ACCEPT');
    });
  });
});
