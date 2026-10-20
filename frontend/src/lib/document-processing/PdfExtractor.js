import * as pdfjsLib from 'pdfjs-dist';
import { pageText } from './PdfLayout';

// Note: Vite uses ?url to get the path to the asset.
// Make sure to use the .mjs extension for pdfjs-dist v4+
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export class PdfExtractor {
  /**
   * Extract text from a File object
   * @param {File} file 
   * @returns {Promise<string>}
   */
  static async extractTextFromFile(file) {
    return (await this.extractDocument(file)).text;
  }

  static async extractDocument(file) {
    if (file.size > 20 * 1024 * 1024) throw new Error('PDF exceeds the 20 MB limit.');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const documentHash = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('');
      const text = await this.extractTextFromArrayBuffer(arrayBuffer);
      return { text, documentHash };
    } catch (error) {
      if (error.name === 'PasswordException') {
        throw new Error('PasswordProtected');
      }
      throw error;
    }
  }

  /**
   * Extract text from an ArrayBuffer
   * @param {ArrayBuffer} arrayBuffer 
   * @returns {Promise<string>}
   */
  static async extractTextFromArrayBuffer(arrayBuffer) {
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    try {
      const pdf = await loadingTask.promise;
      if (pdf.numPages > 100) throw new Error('PDF exceeds the 100-page limit.');
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += pageText(textContent.items) + '\n';
      }
      return fullText;
    } finally {
      await loadingTask.destroy();
    }
  }
}
