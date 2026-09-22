export class ProviderDetection {
  static detect(text) {
    if (!text) return { provider: 'UNKNOWN', type: 'UNKNOWN', confidence: 0 };
    
    const upperText = text.toUpperCase();
    
    // 1. Stockbit
    if (upperText.includes('STOCKBIT') || upperText.includes('PT STOCKBIT SEKURITAS')) {
      if (upperText.includes('STATEMENT OF ACCOUNT')) {
        return { provider: 'STOCKBIT', type: 'SOA', confidence: 100 };
      }
      if (upperText.includes('TRADE CONFIRMATION')) {
        return { provider: 'STOCKBIT', type: 'TC', confidence: 100 };
      }
      return { provider: 'STOCKBIT', type: 'UNKNOWN', confidence: 50 };
    }
    
    // 2. Pluang
    if (upperText.includes('PLUANG') || upperText.includes('BUMI SANTOSA CEMERLANG') || upperText.includes('CRYPTO ASSETS MONTHLY PORTFOLIO SUMMARY')) {
      return { provider: 'PLUANG', type: 'SOA', confidence: 100 };
    }
    
    // 3. BIONS (BNI Sekuritas)
    if (upperText.includes('BIONS') || upperText.includes('BNI SEKURITAS')) {
      if (upperText.includes('TRADE CONFIRMATION')) {
        return { provider: 'BIONS', type: 'TC', confidence: 100 };
      }
      if (upperText.includes('CLIENT STATEMENT')) {
        return { provider: 'BIONS', type: 'SOA', confidence: 100 };
      }
      if (upperText.includes('CORPORATE ACTION ADVICE')) {
        return { provider: 'BIONS', type: 'CA', confidence: 100 };
      }
      return { provider: 'BIONS', type: 'UNKNOWN', confidence: 50 };
    }
    
    return { provider: 'UNKNOWN', type: 'UNKNOWN', confidence: 0 };
  }
}
