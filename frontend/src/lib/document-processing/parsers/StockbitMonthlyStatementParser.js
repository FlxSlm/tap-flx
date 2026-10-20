import { DocumentParserInterface } from '../DocumentParserInterface';
import { plainNumber, providerDate } from '../SourceNumbers';

export class StockbitMonthlyStatementParser extends DocumentParserInterface {
  parse(text) {
    const snapshots = [];
    
    // Date 01/08/2026 - 31/08/2026
    let asOfDate = null;
    const dateMatch = text.match(/Date\s*[\d]{2}\/[\d]{2}\/[\d]{4}\s*-\s*([\d]{2}\/[\d]{2}\/[\d]{4})/i);
    
    if (dateMatch) {
      asOfDate = dateMatch[1]; // 31/08/2026
    }

    // Stocks Special Notes Margin Quantity Buying Close Buying Value Market Value Unreal. Gain/Loss %
    // BBCA Bank Central Asia Tbk. 6,900 7,674.28 6,475 52,952,500 44,677,500 -8,275,000 -15.63
    const rowRegex = /^([A-Z]{4})\s+.*?\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+[-]?[\d,.]+\s+[-]?[\d,.]+/gm;

    let match;
    while ((match = rowRegex.exec(text)) !== null) {
      snapshots.push({
        exact_values: { quantity: plainNumber(match[2]), average_price: plainNumber(match[3]), market_price: plainNumber(match[4]), market_value: plainNumber(match[6]) },
        symbol: match[1],
        quantity: parseFloat(match[2].replace(/,/g, '')),
        average_price: parseFloat(match[3].replace(/,/g, '')),
        market_price: parseFloat(match[4].replace(/,/g, '')),
        market_value: parseFloat(match[6].replace(/,/g, '')), // Match 5 is Buying Value, Match 6 is Market Value
        date: asOfDate
      });
    }

    return snapshots;
  }

  normalize(parsedData) {
    return parsedData.map(data => {
      let isoDate = null;
      if (data.date) {
        const parts = data.date.split('/');
        if (parts.length === 3) {
          isoDate = providerDate(data.date, 'numeric');
        }
      }

      return {
        exact_values: data.exact_values,
        symbol: data.symbol,
        quantity: data.quantity,
        average_price: data.average_price,
        market_price: data.market_price,
        market_value: data.market_value,
        as_of_date: isoDate,
        currency: 'IDR'
      };
    });
  }
}
