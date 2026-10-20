import { DocumentParserInterface } from '../DocumentParserInterface';
import { plainNumber, sumNumbers } from '../SourceNumbers';

export class BionsTradeConfirmationParser extends DocumentParserInterface {
  parse(text) {
    const transactions = [];
    // Date: "Trade Date : Monday, 02-Mar-2026"
    const dateRegex = /Trade Date\s*:\s*[A-Za-z]+,\s*([\d]{2}-[A-Za-z]{3}-[\d]{4})/i;
    const dateMatch = text.match(dateRegex);
    let transactionDate = null;
    if (dateMatch) {
      transactionDate = dateMatch[1]; // e.g. 02-Mar-2026
    }

    // Pattern: No. C/N Ch B/S Code Mode Price Qty. Amount Comm PPH 23 VAT Sell Tax Levy VAT Levy Net Amount
    // Example: 1. NI2735284 ONLINE S AADI VP 10,050.000000 400 4,020,000.00 4,588.00 0.00 505.00 4,020.00 1,608.00 133.00 4,009,146.00
    // Regex matches the row starting with a number and a dot.
    const rowRegex = /^\d+\.\s+([A-Z0-9]+)\s+([A-Z]+)\s+([BS])\s+([A-Z]+)\s+([A-Z]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)/gm;

    let match;
    while ((match = rowRegex.exec(text)) !== null) {
      const typeStr = match[3];
      const type = typeStr === 'B' ? 'BUY' : (typeStr === 'S' ? 'SELL' : 'UNKNOWN');
      const symbol = match[4];
      const price = parseFloat(match[6].replace(/,/g, ''));
      const quantity = parseFloat(match[7].replace(/,/g, ''));
      const amount = parseFloat(match[8].replace(/,/g, '')); // Gross
      
      const comm = parseFloat(match[9].replace(/,/g, ''));
      const pph = parseFloat(match[10].replace(/,/g, ''));
      const vat = parseFloat(match[11].replace(/,/g, ''));
      const sellTax = parseFloat(match[12].replace(/,/g, ''));
      const levy = parseFloat(match[13].replace(/,/g, ''));
      const vatLevy = parseFloat(match[14].replace(/,/g, ''));
      const netAmount = parseFloat(match[15].replace(/,/g, ''));

      const totalFee = comm + pph + vat + sellTax + levy + vatLevy;

      transactions.push({
        external_identifier: match[1],
        exact_values: {
          quantity: plainNumber(match[7]), price: plainNumber(match[6]),
          gross_amount: plainNumber(match[8]), net_amount: plainNumber(match[15]),
          total_amount: plainNumber(match[15]),
          fee_amount: sumNumbers(match[9], match[13]),
          tax_amount: sumNumbers(match[10], match[11], match[12], match[14]),
        },
        type: type,
        symbol: symbol,
        quantity: quantity,
        price: price,
        total: amount, // Keeping total as Gross, wait, the user asked mapping: I mapped it as netAmount or amount?
        // Wait, the mapping in my spec says: total_amount = Net Amount. 
        // Oh, let me store both for normalization.
        netAmount: netAmount,
        fee: totalFee,
        date: transactionDate
      });
    }

    return transactions;
  }

  normalize(parsedData) {
    return parsedData.map(data => {
      // Date conversion: 02-Mar-2026 -> 2026-03-02
      let isoDate = null;
      if (data.date) {
        const parts = data.date.split('-');
        if (parts.length === 3) {
          const months = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};
          isoDate = `${parts[2]}-${months[parts[1]]}-${parts[0].padStart(2, '0')} 00:00:00`;
        }
      }

      return {
        ...data.exact_values,
        exact_values: data.exact_values,
        external_identifier: data.external_identifier,
        amount_semantics: 'NET',
        date_precision: 'DATE',
        type: data.type,
        symbol: data.symbol,
        quantity: data.quantity,
        price: data.price,
        total_amount: data.netAmount, // Canonical uses Net Amount based on spec
        fee_amount: data.exact_values.fee_amount,
        tax_amount: data.exact_values.tax_amount,
        transaction_date: isoDate,
        currency: 'IDR'
      };
    });
  }
}
