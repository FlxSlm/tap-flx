import * as pdfjsLib from 'pdfjs-dist';

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
    try {
      const arrayBuffer = await file.arrayBuffer();
      return await this.extractTextFromArrayBuffer(arrayBuffer);
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
    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // We can join with space, but sometimes we need to preserve newlines based on Y coordinate
      // For simplicity in prototipe S1, join strings with space and add a newline per page.
      // However, for tabular data, standard pdf.js getTextContent loses layout.
      // We will join items with a special separator or space.
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }

    return fullText;
  }
}
