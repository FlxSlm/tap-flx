import DocumentParserInterface from '../DocumentParserInterface.js';

/**
 * ASSUMPTION / LIMITATION:
 * Without real BIONS PDF samples, this parser uses a basic dummy regex 
 * format for testing purposes in Increment 2.
 * 
 * Expected dummy format: "Beli BBRI 50 5000 250000 2026-09-01"
 */
export default class BionsParser extends DocumentParserInterface {
  parse(text) {
    const transactions = [];
    const regex = /(Beli|Jual)\s+([A-Z]{4})\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+(\d{4}-\d{2}-\d{2})/gi;
    
    let match;
    while ((match = regex.exec(text)) !== null) {
      let type = match[1].toUpperCase();
      if (type === 'BELI') type = 'BUY';
      if (type === 'JUAL') type = 'SELL';

      transactions.push({
        type: type,
        symbol: match[2].toUpperCase(),
        quantity: parseFloat(match[3]),
        price: parseFloat(match[4]),
        total: parseFloat(match[5]),
        date: match[6]
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
        provider: 'BIONS',
        parser_version: '1.0'
      }
    }));
  }
}
