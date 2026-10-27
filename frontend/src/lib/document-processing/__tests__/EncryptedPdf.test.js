import { describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
vi.mock('pdfjs-dist', () => import('pdfjs-dist/legacy/build/pdf.mjs'));
import * as pdfjs from 'pdfjs-dist';
import { PdfExtractor } from '../PdfExtractor';
import { monthlyLines, syntheticPassword, syntheticPdf } from './syntheticPdf';
import { sourceParser } from '../SourceContract';

pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(path.resolve('node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')).href;
const file = options => ({ size: syntheticPdf(monthlyLines, options).byteLength, arrayBuffer: async () => syntheticPdf(monthlyLines, options) });

describe('actual PDF.js encrypted synthetic fixtures', () => {
  it('creates deterministic encrypted bytes and requires a password', async () => {
    const bytes = syntheticPdf(monthlyLines, { password: syntheticPassword });
    expect(bytes).toEqual(syntheticPdf(monthlyLines, { password: syntheticPassword }));
    expect(new TextDecoder('latin1').decode(bytes)).not.toContain('TSTA Synthetic Asset');
    await expect(PdfExtractor.extractDocument(file({ password: syntheticPassword }))).rejects.toMatchObject({ code: 'PASSWORD_REQUIRED' });
  });
  it('rejects incorrect password safely then retries the same file with a correct password', async () => {
    const selected = file({ password: syntheticPassword });
    await expect(PdfExtractor.extractDocument(selected, { password: 'incorrect-secret' })).rejects.toMatchObject({ code: 'INCORRECT_PASSWORD', message: 'INCORRECT_PASSWORD' });
    const result = await PdfExtractor.extractDocument(selected, { password: syntheticPassword });
    const parser = sourceParser('STOCKBIT', 'SOA').parser;
    expect(parser.normalize(parser.parse(result.text))).toHaveLength(4);
    expect(result).not.toHaveProperty('password');
    expect(result.text).not.toContain(syntheticPassword);
  });
  it('distinguishes unsupported encryption and corrupt input without exposing library messages', async () => {
    await expect(PdfExtractor.extractDocument(file({ password: syntheticPassword, unsupportedEncryption: true }))).rejects.toMatchObject({ code: 'UNSUPPORTED_ENCRYPTION' });
    await expect(PdfExtractor.extractTextFromArrayBuffer(new TextEncoder().encode('corrupt synthetic').buffer)).rejects.toMatchObject({ code: 'CORRUPT_PDF' });
  });
  it('supports plain PDFs and honors cancellation before reading', async () => {
    const result = await PdfExtractor.extractDocument(file({}));
    expect(result.text).toContain('TSTA');
    const controller = new AbortController(); controller.abort();
    const read = vi.fn();
    await expect(PdfExtractor.extractDocument({ size: 10, arrayBuffer: read }, { signal: controller.signal })).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(read).not.toHaveBeenCalled();
  });
});
