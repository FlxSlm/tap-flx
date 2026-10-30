import { DocumentParserInterface } from '../DocumentParserInterface.js';
import { plainNumber, providerDate } from '../SourceNumbers.js';

export class BionsCorporateActionParser extends DocumentParserInterface {
  parse(text) {
    const transactions = [];

    // Date Pattern: "4. Tanggal pembayaran dividen tunai (Payment Date)\nCash Dividend Payment Date (Payment Date)\n16-Sep-26"
    // Since there could be many dates, I'll extract the one following (Payment Date)
    let paymentDate = null;
    const dateMatch = text.match(/\(Payment Date\)[^]*?(\d{2}-[a-zA-Z]{3}-\d{2})/);
    if (dateMatch) {
      paymentDate = dateMatch[1];
    }

    // Table Headers: Stock, Balance, Gross Amount, Tax Percent, Tax Amount, Net Amount
    // Example Value: BBCA 500.00 12,500.00 0.00 0.00 12,500.00
    const rowRegex = /^([A-Z]{4})\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)/gm;

    let match;
    while ((match = rowRegex.exec(text)) !== null) {
      transactions.push({
        exact_values: { reference_quantity: plainNumber(match[2]), gross_amount: plainNumber(match[3]), tax_amount: plainNumber(match[5]), net_amount: plainNumber(match[6]), total_amount: plainNumber(match[6]) },
        type: 'DIVIDEND',
        symbol: match[1],
        quantity: parseFloat(match[2].replace(/,/g, '')), // balance
        grossAmount: parseFloat(match[3].replace(/,/g, '')),
        taxAmount: parseFloat(match[5].replace(/,/g, '')),
        netAmount: parseFloat(match[6].replace(/,/g, '')),
        date: paymentDate
      });
    }

    return transactions;
  }

  normalize(parsedData) {
    return parsedData.map(data => {
      let isoDate = null;
      if (data.date) {
        // Assume 2000s for YY
        const dateParts = data.date.split('-');
        if (dateParts.length === 3) {
          const year = dateParts[2].length === 2 ? `20${dateParts[2]}` : dateParts[2];
          const date = providerDate(`${dateParts[0]}-${dateParts[1]}-${year}`, 'month-name');
          isoDate = date ? date + ' 00:00:00' : null;
        }
      }

      return {
        ...data.exact_values,
        exact_values: data.exact_values,
        amount_semantics: 'NET',
        date_precision: 'DATE',
        type: data.type,
        symbol: data.symbol,
        quantity: null,
        reference_quantity: data.exact_values.reference_quantity,
        price: null,
        total_amount: data.netAmount,
        fee_amount: null,
        tax_amount: data.exact_values.tax_amount,
        transaction_date: isoDate,
        currency: 'IDR'
      };
    });
  }
}
