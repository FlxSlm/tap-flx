import DocumentParserInterface from '../DocumentParserInterface.js';

/**
 * ASSUMPTION / LIMITATION:
 * Without real Stockbit PDF samples, this parser uses a basic dummy regex 
 * format for testing purposes in Increment 2.
 * 
 * Expected dummy format: "2026-09-01 BUY BBCA 100 8500 850000"
 */
export default class StockbitParser extends DocumentParserInterface {
  parse(text) {
    const transactions = [];
    const regex = /(\d{4}-\d{2}-\d{2})\s+(BUY|SELL|DIVIDEND)\s+([A-Z]{4})\s+(\d+)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/gi;
    
    let match;
    while ((match = regex.exec(text)) !== null) {
      transactions.push({
        date: match[1],
        type: match[2].toUpperCase(),
        symbol: match[3].toUpperCase(),
        quantity: parseFloat(match[4]),
        price: parseFloat(match[5]),
        total: parseFloat(match[6])
      });
    }
    
    return transactions;
  }

  normalize(parsedData) {
    return parsedData.map(tx => ({
      transaction_date: tx.date,
      type: tx.type,
      symbol: tx.symbol,
      asset_name: tx.symbol,
      quantity: tx.quantity,
      price: tx.price,
      total_amount: tx.total,
      currency: 'IDR',
      fee_amount: 0,
      source_metadata: {
        provider: 'Stockbit',
        parser_version: '1.0'
      }
    }));
  }
}
