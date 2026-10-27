import * as pdfjsLib from 'pdfjs-dist';
import { pageText } from './PdfLayout';

// Note: Vite uses ?url to get the path to the asset.
// Make sure to use the .mjs extension for pdfjs-dist v4+
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export class PdfProcessingError extends Error {
  constructor(code) { super(code); this.name = 'PdfProcessingError'; this.code = code; }
}

function classify(error, signal) {
  if (signal?.aborted) return new PdfProcessingError('CANCELLED');
  if (error instanceof PdfProcessingError) return error;
  if (error?.name === 'PasswordException') return new PdfProcessingError(error.code === pdfjsLib.PasswordResponses.INCORRECT_PASSWORD ? 'INCORRECT_PASSWORD' : 'PASSWORD_REQUIRED');
  // Only classify known library diagnostics; never surface the raw message or cause.
  if (/unsupported encryption|unknown encryption|unknown crypto|unsupported.*crypt|unknown.*crypt/i.test(error?.message ?? '')) return new PdfProcessingError('UNSUPPORTED_ENCRYPTION');
  if (error?.name === 'InvalidPDFException') return new PdfProcessingError('CORRUPT_PDF');
  return new PdfProcessingError('EXTRACTION_FAILED');
}

export class PdfExtractor {
  /**
   * Extract text from a File object
   * @param {File} file 
   * @returns {Promise<string>}
   */
  static async extractTextFromFile(file) {
    return (await this.extractDocument(file)).text;
  }

  static async extractDocument(file, options = {}) {
    if (file.size > 20 * 1024 * 1024) throw new Error('PDF exceeds the 20 MB limit.');
    try {
      if (options.signal?.aborted) throw new PdfProcessingError('CANCELLED');
      const arrayBuffer = await file.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const documentHash = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('');
      const text = await this.extractTextFromArrayBuffer(arrayBuffer, options);
      return { text, documentHash };
    } catch (error) {
      throw classify(error, options.signal);
    }
  }

  /**
   * Extract text from an ArrayBuffer
   * @param {ArrayBuffer} arrayBuffer 
   * @returns {Promise<string>}
   */
  static async extractTextFromArrayBuffer(arrayBuffer, { password, signal } = {}) {
    if (signal?.aborted) throw new PdfProcessingError('CANCELLED');
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer, ...(password == null ? {} : { password }), verbosity: 0 });
    password = null; // References are released; JavaScript memory cannot be securely zeroized.
    let destruction;
    const destroy = () => { destruction ??= loadingTask.destroy().catch(() => {}); return destruction; };
    const abort = () => { void destroy(); };
    signal?.addEventListener('abort', abort, { once: true });
    try {
      const pdf = await loadingTask.promise;
      if (pdf.numPages > 100) throw new Error('PDF exceeds the 100-page limit.');
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        if (signal?.aborted) throw new PdfProcessingError('CANCELLED');
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += pageText(textContent.items) + '\n';
      }
      return fullText;
    } catch (error) {
      throw classify(error, signal);
    } finally {
      signal?.removeEventListener('abort', abort);
      loadingTask.onPassword = null;
      await destroy();
    }
  }
}
