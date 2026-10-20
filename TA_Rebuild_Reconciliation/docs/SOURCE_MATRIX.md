# Source Matrix — Based on user-provided inventory; verify with actual samples

| Provider | Medium | Type | Intended output | Status |
|---|---|---|---|---|
| Stockbit | PDF | SOA/monthly statement | snapshot + activity if detailed | sample reportedly available |
| Stockbit | PDF | TC/trade confirmation | transaction ledger | sample reportedly available |
| Stockbit | Email body | dividend/corporate action | dividend event | fixture not supplied |
| BIONS | PDF | SOA/monthly statement | snapshot + activity if detailed | sample reportedly available |
| BIONS | PDF | TC/trade confirmation | transaction ledger | sample reportedly available |
| BIONS | PDF | CA cash dividend | dividend event | sample reportedly available |
| Pluang crypto | PDF | monthly statement | snapshot + activity if detailed | sample reportedly available |
| Pluang crypto | Email body | BUY/SELL confirmation | transaction ledger | fixture not supplied |

**Important:** Do not implement imaginary PDF parsers for Pluang transaction or Stockbit dividend. Do not assume SOA contains line-item trades/dividends until inspecting source. Email body fixtures must be sanitized and explicitly provided. Password-protected PDFs must not have passwords persisted.

## Field mapping worksheet
For each fixture record: exact section/header (sanitized), field names, extraction pattern, units, number/date locale, optionality, semantics (gross/net/fee), confidence rule, known failure modes, sample assertions, parser version.
