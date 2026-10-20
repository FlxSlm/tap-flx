export class ValidationAndConfidence {
  /**
   * Evaluate a normalized data against Hard Validation rules and Confidence Scoring.
   * 
   * @param {Object} data Canonical transaction or snapshot data
   * @param {String} profile 'transaction' or 'snapshot'
   * @returns {Object} Evaluation result { score, status, isHardValidationPass, errors }
   */
  static evaluate(data, profile = 'transaction') {
    if (profile === 'snapshot') {
      return this._evaluateSnapshot(data);
    }
    return this._evaluateTransaction(data);
  }

  static _evaluateTransaction(transaction) {
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
    if (transaction.quantity !== undefined && transaction.quantity !== null && transaction.quantity > 0) {
      score += 15;
    } else if (['FEE', 'DEPOSIT', 'WITHDRAWAL', 'DIVIDEND'].includes(transaction.type) && transaction.quantity == null) {
      score += 15;
    } else {
      isHardValidationPass = false;
      errors.push('Invalid quantity (must be > 0 for BUY/SELL/DIVIDEND)');
    }

    // 5. Price (15)
    if (transaction.type === 'DIVIDEND' && transaction.price == null) {
      score += 15;
    } else if (transaction.price !== undefined && transaction.price !== null && Number.isFinite(Number(transaction.price)) && transaction.price >= 0) {
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
      const compareAmount = transaction.gross_amount ?? (transaction.amount_semantics === 'NET' ? null : transaction.total_amount);
      const difference = compareAmount == null ? null : Math.abs(calculatedTotal - Number(compareAmount));
      
      // Client feedback only. Net totals must never be compared as if they were gross.
      if (difference == null) {
        errors.push('Gross amount unavailable; arithmetic not verified');
      } else if (difference <= Math.max(0.0001, Math.abs(calculatedTotal) * Number.EPSILON * 4)) {
        score += 10;
      } else {
        isHardValidationPass = false;
        errors.push('Arithmetic inconsistency: Qty * Price differs significantly from Total');
      }
    } else {
      score += 10; 
    }

    let status = 'REVIEW';
    if (!isHardValidationPass || score < 70) {
      status = 'REJECT';
    } else if (score >= 90) {
      status = 'AUTO ACCEPT';
    }

    return { score, status, isHardValidationPass, errors };
  }

  static _evaluateSnapshot(snapshot) {
    let score = 0;
    let isHardValidationPass = true;
    const errors = [];

    // 1. Symbol (25)
    if (snapshot.symbol && typeof snapshot.symbol === 'string' && snapshot.symbol.trim().length > 0) {
      score += 25;
    } else {
      isHardValidationPass = false;
      errors.push('Missing or invalid symbol');
    }

    // 2. As Of Date (20)
    if (snapshot.as_of_date && !isNaN(Date.parse(snapshot.as_of_date))) {
      score += 20;
    } else {
      isHardValidationPass = false;
      errors.push('Missing or invalid as_of_date');
    }

    // 3. Quantity (25)
    if (snapshot.quantity !== undefined && snapshot.quantity !== null && Number.isFinite(Number(snapshot.quantity)) && snapshot.quantity >= 0) {
      score += 25;
    } else {
      isHardValidationPass = false;
      errors.push('Invalid quantity');
    }

    // 4. Market Value (20)
    if (snapshot.market_value !== undefined && snapshot.market_value !== null) {
      score += 20;
    } else {
      errors.push('Missing market_value');
    }
    
    // 5. Average Price (10)
    if (snapshot.average_price !== undefined && snapshot.average_price !== null) {
      score += 10;
    } else {
      errors.push('Missing average_price');
    }

    let status = 'REVIEW';
    if (!isHardValidationPass || score < 70) {
      status = 'REJECT';
    } else if (score >= 90) {
      status = 'AUTO ACCEPT';
    }

    return { score, status, isHardValidationPass, errors };
  }
}
