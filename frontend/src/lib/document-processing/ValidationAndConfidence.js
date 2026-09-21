export class ValidationAndConfidence {
  /**
   * Evaluate a normalized transaction against Hard Validation rules and Confidence Scoring.
   * 
   * Scoring (Total = 100):
   * - Symbol = 20
   * - Transaction Date = 15
   * - Transaction Type = 15
   * - Quantity = 15
   * - Price = 15
   * - Total = 10
   * - Arithmetic & Provider Consistency = 10
   * 
   * @param {Object} transaction Canonical transaction data
   * @returns {Object} Evaluation result { score, status, isHardValidationPass, errors }
   */
  static evaluate(transaction) {
    let score = 0;
    let isHardValidationPass = true;
    const errors = [];

    // 1. Symbol (20)
    if (transaction.symbol && typeof transaction.symbol === 'string' && transaction.symbol.trim().length > 0) {
      score += 20;
    } else {
      isHardValidationPass = false;
      errors.push('Missing or invalid symbol');
    }

    // 2. Transaction Date (15)
    if (transaction.transaction_date && !isNaN(Date.parse(transaction.transaction_date))) {
      score += 15;
    } else {
      isHardValidationPass = false;
      errors.push('Missing or invalid date');
    }

    // 3. Transaction Type (15)
    const validTypes = ['BUY', 'SELL', 'DEPOSIT', 'WITHDRAWAL', 'DIVIDEND', 'FEE'];
    if (transaction.type && validTypes.includes(transaction.type.toUpperCase())) {
      score += 15;
    } else {
      isHardValidationPass = false;
      errors.push('Invalid transaction type');
    }

    // 4. Quantity (15)
    // Note: Some transactions like FEE might have 0 quantity, but we enforce > 0 for BUY/SELL
    if (transaction.quantity !== undefined && transaction.quantity !== null && transaction.quantity > 0) {
      score += 15;
    } else if (transaction.type === 'FEE' || transaction.type === 'DEPOSIT' || transaction.type === 'WITHDRAWAL') {
      // Allow 0 quantity for non-asset transactions
      score += 15;
    } else {
      isHardValidationPass = false;
      errors.push('Invalid quantity (must be > 0 for BUY/SELL/DIVIDEND)');
    }

    // 5. Price (15)
    if (transaction.price !== undefined && transaction.price !== null && transaction.price >= 0) {
      score += 15;
    } else {
      isHardValidationPass = false;
      errors.push('Invalid price');
    }

    // 6. Total (10)
    if (transaction.total_amount !== undefined && transaction.total_amount !== null && transaction.total_amount >= 0) {
      score += 10;
    } else {
      isHardValidationPass = false;
      errors.push('Invalid total amount');
    }

    // 7. Arithmetic Consistency (10)
    if (isHardValidationPass && (transaction.type === 'BUY' || transaction.type === 'SELL')) {
      const calculatedTotal = transaction.quantity * transaction.price;
      const difference = Math.abs(calculatedTotal - transaction.total_amount);
      
      // Allow up to 5% difference to account for fees/taxes embedded in total_amount
      if (calculatedTotal === 0 || (difference / calculatedTotal) <= 0.05) {
        score += 10;
      } else {
        errors.push('Arithmetic inconsistency: Qty * Price differs significantly from Total');
      }
    } else {
      // Automatic 10 points for non-BUY/SELL where this doesn't apply strictly
      score += 10; 
    }

    // Determine status
    let status = 'REVIEW';
    if (!isHardValidationPass || score < 70) {
      status = 'REJECT';
    } else if (score >= 90) {
      status = 'AUTO ACCEPT';
    }

    return {
      score,
      status,
      isHardValidationPass,
      errors
    };
  }
}
