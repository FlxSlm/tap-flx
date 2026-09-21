/**
 * DocumentParserInterface
 * Base class/interface for provider-specific parsers.
 */
export default class DocumentParserInterface {
  /**
   * Parse the raw extracted text into an intermediate format.
   * @param {string} text Raw text extracted from PDF
   * @returns {Array|Object} Intermediate parsed data
   */
  parse(text) {
    throw new Error('parse() must be implemented');
  }

  /**
   * Normalize intermediate data into Canonical Transaction format.
   * @param {Array|Object} parsedData 
   * @returns {Array} Array of canonical transactions
   */
  normalize(parsedData) {
    throw new Error('normalize() must be implemented');
  }
}
