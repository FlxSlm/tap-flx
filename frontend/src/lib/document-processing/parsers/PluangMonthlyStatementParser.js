import { DocumentParserInterface } from '../DocumentParserInterface';

export class PluangMonthlyStatementParser extends DocumentParserInterface {
  parse(text) {
    const snapshots = [];
    
    // Period : 31 Aug 2026
    let asOfDate = null;
    const dateMatch = text.match(/Period\s*:\s*([\d]{1,2}\s+[A-Za-z]{3}\s+[\d]{4})/i);
    
    if (dateMatch) {
      asOfDate = dateMatch[1]; // e.g. 31 Aug 2026
    }

    // Code Quantity Avg. Buy Price Closing Price Market Value Unrealized P&L
    // BTC 0.00703327 Rp1,490,227,421 Rp1,390,860,900 Rp9,782,300 -Rp698,871
    const rowRegex = /^([A-Z0-9]+)\s+([\d,.]+)\s+Rp([\d,.]+)\s+Rp([\d,.]+)\s+Rp([\d,.]+)\s+[-]?Rp([\d,.]+)/gm;

    let match;
    while ((match = rowRegex.exec(text)) !== null) {
      snapshots.push({
        symbol: match[1],
        quantity: parseFloat(match[2].replace(/,/g, '')),
        average_price: parseFloat(match[3].replace(/,/g, '')),
        market_price: parseFloat(match[4].replace(/,/g, '')),
        market_value: parseFloat(match[5].replace(/,/g, '')),
        date: asOfDate
      });
    }

    return snapshots;
  }

  normalize(parsedData) {
    return parsedData.map(data => {
      let isoDate = null;
      if (data.date) {
        const parts = data.date.split(' ');
        if (parts.length === 3) {
          const months = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};
          isoDate = `${parts[2]}-${months[parts[1]]}-${parts[0].padStart(2, '0')}`;
        }
      }

      return {
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
