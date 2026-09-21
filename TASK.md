# CURRENT TASK

## Task ID
I2-15 (and Finalization of Increment 2)

## Task
Document Processing Core & Privacy Mode

## Goal
Build the core processing layer that extracts text from PDFs, detects providers, parses data into canonical transactions, normalizes, validates, and computes confidence scores. All done in the frontend to satisfy Privacy Mode requirements.

## Status
COMPLETE ✅

## Prerequisites (completed)
- [x] I2-01 — Install dependencies (`pdfjs-dist`, `vitest` for tests)
- [x] I2-02 — Create `DocumentParserInterface.js`
- [x] I2-03 — Create `PdfExtractor.js` (PDF.js integration)
- [x] I2-04 — Create `ProviderDetection.js`
- [x] I2-05 — Implement `StockbitParser.js`
- [x] I2-06 — Implement `PluangParser.js`
- [x] I2-07 — Implement `BionsParser.js`
- [x] I2-08 — Implement Normalization, Validation, and Confidence Scoring (`ValidationAndConfidence.js`)
- [x] I2-09 — Implement Backend Endpoint `POST /api/transactions/bulk`
- [x] I2-10 — Create `DocumentProcessing.jsx` UI and update `App.jsx` routes
- [x] I2-11 — Write and run frontend tests (`__tests__`)
- [x] I2-12 — Write and run backend tests (`php artisan test`)
- [x] I2-13 — Verify application builds (`npm run build`)

## Features Implemented
1. **Frontend Parsing Engine**: Implemented `PdfExtractor` using `pdfjs-dist` to extract raw text directly in the browser (Privacy Mode).
2. **Provider Parsers**: Created dummy regex-based parsers for Stockbit, Pluang, and BIONS that output intermediate parsed data.
3. **Validation & Confidence**: Created a rule-based engine to score parsed transactions out of 100 and categorize them into `AUTO ACCEPT`, `REVIEW`, or `REJECT`.
4. **Document Processing UI**: Created `/process-document` page where users can upload a PDF, see a preview of extracted transactions, and import them in bulk.
5. **Backend Bulk API**: Added `POST /api/transactions/bulk` to handle importing multiple transactions efficiently while retaining duplication checks.
6. **Tests**: Added Vitest unit tests for the frontend parsers and PHPUnit feature tests for the new bulk endpoint.

## Verification Results
- [x] Frontend tests pass (9 Vitest tests).
- [x] Backend tests pass (13 PHPUnit tests, 30 assertions).
- [x] Application builds successfully (`npm run build`).

## Next Task
PENDING / NEXT INCREMENT — Do not implement yet. Increment 3 (Automatic Mode) will be next.
