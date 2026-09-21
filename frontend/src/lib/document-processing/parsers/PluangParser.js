import DocumentParserInterface from '../DocumentParserInterface.js';

/**
 * ASSUMPTION / LIMITATION:
 * Without real Pluang PDF samples, this parser uses a basic dummy regex 
 * format for testing purposes in Increment 2.
 * 
 * Expected dummy format: "01/09/2026 BUY BTC 0.5 900000000 450000000"
 */
export default class PluangParser extends DocumentParserInterface {
  parse(text) {
    const transactions = [];
    const regex = /(\d{2}\/\d{2}\/\d{4})\s+(BUY|SELL)\s+([A-Z]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/gi;
    
    let match;
    while ((match = regex.exec(text)) !== null) {
      // Convert DD/MM/YYYY to YYYY-MM-DD
      const [day, month, year] = match[1].split('/');
      const formattedDate = `${year}-${month}-${day}`;

      transactions.push({
        date: formattedDate,
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
      currency: 'IDR', // Or USD for some crypto, but IDR for dummy
      fee_amount: 0,
      source_metadata: {
        provider: 'Pluang',
        parser_version: '1.0'
      }
    }));
  }
}
