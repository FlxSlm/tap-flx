import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

vi.mock('pdfjs-dist', () => import('pdfjs-dist/legacy/build/pdf.mjs'));
import * as pdfjs from 'pdfjs-dist';
import { PdfExtractor } from '../PdfExtractor';
import { sourceParser } from '../SourceContract';

// Text-only PDF generated in memory from invented fixtures. No private binary fixture is committed.
function textPdf(lines) {
  const escape = s => s.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
  const stream = `BT /F1 8 Tf 10 750 Td 14 TL ${lines.map((line, i) => `${i ? 'T* ' : ''}(${escape(line)}) Tj`).join('\n')} ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1200 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf).buffer;
}

const fixtures = [
  ['BIONS', 'TC', ['Trade Date : Thursday, 02-Jan-2020', '1. SYNTH001 ONLINE B TSTA VP 100.00 10 1,000.00 2.00 0.00 1.00 0.00 0.00 0.00 1,003.00']],
  ['BIONS', 'SOA', ['From : Wednesday, 01-Jan-2020 To : Friday, 31-Jan-2020', '1 TSTA-Synthetic Asset 10 100.00 1,000.00 110.00 1,100.00 100.00 10 %']],
  ['BIONS', 'CA', ['(Payment Date)', '02-Jan-20', 'TSTA 10.00 50.00 10.00 5.00 45.00']],
  ['STOCKBIT', 'TC', ['Transaction Date 02/01/2020', '9000001 RG TSTA Synthetic Asset 1 100.00 100.00 10,000.00 0.00']],
  ['STOCKBIT', 'SOA', ['Date 01/01/2020 - 31/01/2020', 'TSTA Synthetic Asset 10 100.00 110.00 1,000.00 1,100.00 100.00 10.00']],
  ['PLUANG', 'SOA', ['Period : 31 Jan 2020', 'TSTC 0.10000000 Rp1,000 Rp1,100 Rp110 Rp10']],
];

describe('real PDF.js extraction into parsers using synthetic PDF bytes', () => {
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(path.resolve('node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')).href;
  for (const [provider, type, lines] of fixtures) {
    it(`${provider} ${type} preserves extraction rows and yields normalized output`, async () => {
      const bytes = textPdf(lines);
      const { text, documentHash } = await PdfExtractor.extractDocument({ size: bytes.byteLength, arrayBuffer: async () => bytes });
      expect(documentHash).toMatch(/^[a-f0-9]{64}$/);
      const { parser } = sourceParser(provider, type);
      const normalized = parser.normalize(parser.parse(text));
      expect(normalized).toHaveLength(1);
      expect(normalized[0].as_of_date ?? normalized[0].transaction_date.slice(0, 10)).toMatch(/^2020-01-(02|31)$/);
    });
  }

  it('rejects oversize PDFs before attempting extraction', async () => {
    const read = vi.fn();
    await expect(PdfExtractor.extractDocument({ size: 21 * 1024 * 1024, arrayBuffer: read })).rejects.toThrow('20 MB');
    expect(read).not.toHaveBeenCalled();
  });

  it('rejects malformed bytes instead of inventing output', async () => {
    await expect(PdfExtractor.extractTextFromArrayBuffer(new TextEncoder().encode('synthetic malformed document').buffer)).rejects.toThrow();
  });
});
