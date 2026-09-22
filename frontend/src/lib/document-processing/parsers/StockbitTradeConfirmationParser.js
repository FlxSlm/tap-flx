import { DocumentParserInterface } from '../DocumentParserInterface';

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
          const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
          if (!isNaN(d)) {
            isoDate = d.toISOString().split('T')[0] + ' 00:00:00';
          }
        }
      }

      return {
        type: data.type,
        symbol: data.symbol,
        quantity: data.quantity,
        price: data.price,
        total_amount: data.total_amount,
        fee_amount: 0, // Not available per line on Stockbit TC
        transaction_date: isoDate,
        currency: 'IDR'
      };
    });
  }
}
