import { afterEach, expect, it, vi } from 'vitest';
vi.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {}, PasswordResponses: { INCORRECT_PASSWORD: 2 }, getDocument: vi.fn() }));
import * as pdfjs from 'pdfjs-dist';
import { PdfExtractor } from '../PdfExtractor';
afterEach(() => vi.resetAllMocks());

it('destroys a pending task exactly once on cancel and does not retain an onPassword callback', async () => {
  let reject;
  const task = { promise: new Promise((resolve, fail) => { reject = fail; }), onPassword: null, destroy: vi.fn(async () => { reject(new Error('Synthetic cancelled task')); }) };
  pdfjs.getDocument.mockReturnValue(task);
  const controller = new AbortController();
  const pending = PdfExtractor.extractTextFromArrayBuffer(new ArrayBuffer(8), { password: 'SYNTHETIC_SECRET', signal: controller.signal });
  controller.abort();
  await expect(pending).rejects.toMatchObject({ code: 'CANCELLED' });
  expect(task.destroy).toHaveBeenCalledOnce();
  expect(task.onPassword).toBeNull();
});

it('destroys a failed password task and hides library diagnostics', async () => {
  const task = { promise: Promise.reject({ name: 'PasswordException', code: 2, message: 'SYNTHETIC_SECRET' }), destroy: vi.fn(async () => {}) };
  pdfjs.getDocument.mockReturnValue(task);
  await expect(PdfExtractor.extractTextFromArrayBuffer(new ArrayBuffer(8))).rejects.toMatchObject({ code: 'INCORRECT_PASSWORD', message: 'INCORRECT_PASSWORD' });
  expect(task.destroy).toHaveBeenCalledOnce();
});
