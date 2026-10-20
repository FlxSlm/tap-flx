import { DocumentParserInterface } from '../DocumentParserInterface';
import { plainNumber } from '../SourceNumbers';

export class BionsMonthlyStatementParser extends DocumentParserInterface {
  parse(text) {
    const snapshots = [];
    
    // "From : Wednesday, 01-Jul-2026 To : Friday, 31-Jul-2026"
    // or "As of 31 Jul 2026"
    let asOfDate = null;
    const dateMatch = text.match(/To\s*:\s*[A-Za-z]+,\s*([\d]{2}-[A-Za-z]{3}-[\d]{4})/i) || text.match(/As of\s*([\d]{2}\s+[A-Za-z]{3}\s+[\d]{4})/i);
    
    if (dateMatch) {
      asOfDate = dateMatch[1].replace(/\s+/g, '-'); // e.g. 31-Jul-2026
    }

    // Pattern: No. Stock Balance AvgPrice Stock Value Market Price Market Value Unrealized %
    // Example: 1 BBCA-BANK CENTRAL ASIA Tbk 500 7,730.00 3,865,000 6,325 3,162,500 -702,500 -18 %
    const rowRegex = /^\d+\s+([A-Z]{4})-.*?\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+[-]?[\d,.]+\s+[-]?[\d,.]+\s*%/gm;

    let match;
    while ((match = rowRegex.exec(text)) !== null) {
      snapshots.push({
        exact_values: { quantity: plainNumber(match[2]), average_price: plainNumber(match[3]), market_price: plainNumber(match[5]), market_value: plainNumber(match[6]) },
        symbol: match[1],
        quantity: parseFloat(match[2].replace(/,/g, '')),
        average_price: parseFloat(match[3].replace(/,/g, '')),
        market_price: parseFloat(match[5].replace(/,/g, '')),
        market_value: parseFloat(match[6].replace(/,/g, '')),
        date: asOfDate
      });
    }

    return snapshots;
  }

  normalize(parsedData) {
    return parsedData.map(data => {
      let isoDate = null;
      if (data.date) {
        const parts = data.date.split('-');
        if (parts.length === 3) {
          const months = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};
          isoDate = `${parts[2]}-${months[parts[1]]}-${parts[0].padStart(2, '0')}`;
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
