import { DocumentParserInterface } from '../DocumentParserInterface.js';
import { plainNumber, providerDate } from '../SourceNumbers.js';

export class StockbitTradeConfirmationParser extends DocumentParserInterface {
  parse(text) {
    const transactions = [];

    // Transaction Date 02/04/2026
    let transactionDate = null;
    const dateMatch = text.match(/Transaction Date\s*([\d]{2}\/[\d]{2}\/[\d]{4})/i);
    if (dateMatch) {
      transactionDate = dateMatch[1]; // 02/04/2026 (DD/MM/YYYY)
    }

    // REF # Board Share Lot Quantity Price Buy Sell
    // 0082249 RG BBRI Bank Rakyat Indonesia (Persero) Tbk. 5 500.00 3,330.00 1,665,000.00 0.00
    const rowRegex = /^\d+\s+[A-Z]{2}\s+([A-Z]{4}).*?\s+(\d+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)/gm;

    let match;
    while ((match = rowRegex.exec(text)) !== null) {
      const symbol = match[1];
      const quantity = parseFloat(match[3].replace(/,/g, ''));
      const price = parseFloat(match[4].replace(/,/g, ''));
      const buyAmount = parseFloat(match[5].replace(/,/g, ''));
      const sellAmount = parseFloat(match[6].replace(/,/g, ''));

      let type = 'UNKNOWN';
      let totalAmount = 0;
      if (buyAmount > 0) {
        type = 'BUY';
        totalAmount = buyAmount;
      } else if (sellAmount > 0) {
        type = 'SELL';
        totalAmount = sellAmount;
      }

      transactions.push({
        external_identifier: match[0].match(/^\d+/)[0],
        exact_values: { quantity: plainNumber(match[3]), price: plainNumber(match[4]), total_amount: plainNumber(type === 'BUY' ? match[5] : match[6]), gross_amount: plainNumber(type === 'BUY' ? match[5] : match[6]) },
        type: type,
        symbol: symbol,
        quantity: quantity,
        price: price,
        total_amount: totalAmount, // Gross amount, fee is 0 per line for now
        date: transactionDate
      });
    }

    return transactions;
  }

  normalize(parsedData) {
    return parsedData.map(data => {
      let isoDate = null;
      if (data.date) {
        // DD/MM/YYYY to YYYY-MM-DD
        const parts = data.date.split('/');
        if (parts.length === 3) {
          const date = providerDate(data.date, 'numeric');
          isoDate = date ? date + ' 00:00:00' : null;
        }
      }

      return {
        exact_values: data.exact_values,
        gross_amount: data.exact_values.gross_amount,
        net_amount: null,
        tax_amount: null,
        settlement_amount: null,
        amount_semantics: 'GROSS',
        date_precision: 'DATE',
        external_identifier: data.external_identifier,
        type: data.type,
        symbol: data.symbol,
        quantity: data.quantity,
        price: data.price,
        total_amount: data.total_amount,
        fee_amount: null, // Document-level charges are not allocated to rows.
        transaction_date: isoDate,
        currency: 'IDR'
      };
    });
  }
}
