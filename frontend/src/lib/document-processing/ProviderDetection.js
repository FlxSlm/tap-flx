export class ProviderDetection {
  /**
   * Detect the provider based on the text content of the PDF.
   * @param {string} text 
   * @returns {string|null} Provider name ('Stockbit', 'Pluang', 'BIONS') or null if unknown
   */
  static detect(text) {
    if (!text) return null;
    
    const upperText = text.toUpperCase();
    
    // Stockbit detection: mentions Stockbit Sekuritas
    if (upperText.includes('STOCKBIT') || upperText.includes('PT STOCKBIT SEKURITAS')) {
      return 'Stockbit';
    }
    
    // Pluang detection: mentions Pluang or PT Bumi Santosa Cemerlang
    if (upperText.includes('PLUANG') || upperText.includes('BUMI SANTOSA CEMERLANG')) {
      return 'Pluang';
    }
    
    // BIONS detection: mentions BIONS or BNI Sekuritas
    if (upperText.includes('BIONS') || upperText.includes('BNI SEKURITAS')) {
      return 'BIONS';
    }
    
    return null;
  }
}
