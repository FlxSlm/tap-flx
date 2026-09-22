# Document Analysis & Parser Source Specification

## A. Source Inventory & Matrix
| Provider | Source Type | Document/Event Type | Parser Class | Output Type |
|----------|-------------|---------------------|--------------|-------------|
| BIONS | PDF | SOA (Client Statement) | BionsMonthlyStatementParser | Portfolio Snapshot |
| BIONS | PDF | TC (Trade Confirmation) | BionsTradeConfirmationParser | Canonical Transaction |
| BIONS | PDF | CA (Corporate Action) | BionsCorporateActionParser | Canonical Transaction (DIVIDEND) |
| Pluang | PDF | Monthly Statement | PluangMonthlyStatementParser | Portfolio Snapshot |
| Pluang | Email | Transaction | PluangTransactionEmailParser (Future) | Canonical Transaction |
| Stockbit | PDF | SOA (Statement of Account) | StockbitMonthlyStatementParser| Portfolio Snapshot |
| Stockbit | PDF | TC (Trade Confirmation) | StockbitTradeConfirmationParser | Canonical Transaction |
| Stockbit | Email | Transaction | StockbitTransactionEmailParser (Future)| Canonical Transaction |
| Stockbit | Email | Dividend | StockbitDividendEmailParser (Future) | Canonical Transaction (DIVIDEND) |

## B. BIONS - Trade Confirmation (TC)
- **Document Title**: TRADE CONFIRMATION
- **Date Pattern**: `Monday, 02-Mar-2026`
- **Field Structure**: No, C/N, Ch, B/S, Code, Mode, Price, Qty., Amount, Comm, PPH 23, VAT, Sell Tax, Levy, VAT Levy, Net Amount
- **Sanitized Example**: `1. NI2735284 ONLINE S AADI VP 10,050.00 400 4,020,000.00 4,588.00 0.00 505.00 4,020.00 1,608.00 133.00 4,009,146.00`
- **Gross vs Net**: `Amount` is Gross (`Price * Qty`). `Net Amount` includes all fees and taxes. 
- **Mapping**: `symbol` = Code, `type` = B/S (B=BUY, S=SELL), `quantity` = Qty, `price` = Price, `fee_amount` = sum of Comm + PPH + VAT + Sell Tax + Levy + VAT Levy, `total_amount` = Net Amount.

## C. BIONS - Client Statement (SOA)
- **Document Title**: CLIENT STATEMENT
- **Date Pattern**: `As of 31 Jul 2026` or Date Range `01-Jul-2026 To : Friday, 31-Jul-2026`
- **Field Structure (Portfolio)**: No., Stock, Balance, AvgPrice, Stock Value, Market Price, Market Value, Unrealized, %
- **Sanitized Example**: `1 BBCA-BANK CENTRAL ASIA Tbk 500 7,730.00 3,865,000 6,325 3,162,500 -702,500 -18 %`
- **Mapping**: `symbol` = BBCA, `quantity` = 500, `average_price` = 7,730.00, `market_value` = 3,162,500.
- **Limitation**: Output is Portfolio Snapshot. No BUY/SELL transaction is generated.

## D. BIONS - Corporate Action (CA)
- **Document Title**: Corporate Action Advice
- **Date Pattern**: Payment Date (`16-Sep-26`)
- **Field Structure**: Stock, Balance, Gross Amount, Tax Percent, Tax Amount, Net Amount
- **Sanitized Example**: `BBCA 500.00 12,500.00 0.00 0.00 12,500.00`
- **Mapping**: `type` = DIVIDEND, `symbol` = BBCA, `quantity` = 500 (Balance), `total_amount` = Net Amount, `fee_amount` = Tax Amount.

## E. Pluang - Monthly Statement
- **Document Title**: Crypto Assets Monthly Portfolio Summary
- **Date Pattern**: Period : `31 Aug 2026`
- **Field Structure**: Code, Quantity, Avg. Buy Price, Closing Price, Market Value, Unrealized P&L
- **Sanitized Example**: `BTC 0.00703327 Rp1,490,227,421 Rp1,390,860,900 Rp9,782,300 -Rp698,871`
- **Mapping**: `symbol` = BTC, `quantity` = 0.00703327, `average_price` = 1,490,227,421, `market_value` = 9,782,300.
- **Limitation**: Outputs Portfolio Snapshot.

## F. Stockbit - Trade Confirmation (TC)
- **Document Title**: Trade Confirmation
- **Date Pattern**: `Transaction Date 02/04/2026`
- **Field Structure**: REF #, Board, Share (Code + Name), Lot, Quantity, Price, Buy, Sell
- **Sanitized Example**: `0082249 RG BBRI Bank Rakyat Indonesia Tbk. 5 500.00 3,330.00 1,665,000.00 0.00`
- **Gross vs Net & Fee**: `Buy` and `Sell` are Gross Amounts. Stockbit aggregates total fees at the bottom (`Total Fee :0.1500 % All In` -> `Commission, VAT, etc.`).
- **Mapping**: `symbol` = BBRI, `type` = Buy > 0 ? BUY : SELL, `quantity` = Quantity, `price` = Price, `total_amount` = Buy or Sell (Gross). `fee_amount` = `NOT_AVAILABLE` per line.
- **Limitation**: Since fee is aggregated at the bottom, mapping it to individual lines accurately is complex without weighted distribution. For this prototype, row-level fee is set to 0 and `total_amount` is Gross. 

## G. Stockbit - Statement of Account (SOA)
- **Document Title**: Statement of Account
- **Date Pattern**: Date `01/08/2026 - 31/08/2026`
- **Field Structure (Portfolio)**: Stocks (Code + Name), Special Notes, Margin, Quantity, Buying, Close, Buying Value, Market Value, Unreal. Gain/Loss
- **Sanitized Example**: `BBCA Bank Central Asia Tbk. 6,900 7,674.28 6,475 52,952,500 44,677,500 -8,275,000 -15.63`
- **Mapping**: `symbol` = BBCA, `quantity` = 6,900, `average_price` = 7,674.28 (Buying), `market_value` = 44,677,500.
- **Limitation**: Outputs Portfolio Snapshot.
