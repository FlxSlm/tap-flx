import { holdingsReasons } from './holdingsReasons';

const reasons = {
  NUMERICALLY_EQUAL_BUT_COVERAGE_UNVERIFIED: 'Quantity sama secara numerik, tetapi kelengkapan bukti periode belum terverifikasi.',
  PROVISIONAL_QUANTITY_DIFFERENCE: 'Selisih bersifat provisional karena cakupan atau validitas bukti belum cukup.',
  QUANTITY_DIFFERENCE_OBSERVED: 'Ada perbedaan quantity antara ledger dan statement.',
  POSSIBLE_MISSING_OR_UNSUPPORTED_ACTIVITY: 'Periksa kemungkinan impor belum lengkap, unit, transfer, corporate action, atau kesalahan parsing. Selisih tidak membuktikan transaksi tertentu hilang.',
  QUANTITY_MISMATCH: 'Quantity berbeda pada input valid dan cakupan yang dikonfirmasi pengguna.',
  COVERAGE_CONFIRMATION_STALE: 'Input berubah setelah konfirmasi coverage. Tinjau bukti dan konfirmasikan kembali.',
  UNIT_UNKNOWN_OR_INVALID: 'Unit belum diketahui atau tidak sesuai provider; quantity tidak dibandingkan.',
  REPORTED_QUANTITY_UNKNOWN: 'Reported quantity tidak diketahui; simbol yang tidak tercantum pada snapshot parsial bukan nol.',
  CALCULATED_QUANTITY_UNKNOWN: 'Calculated quantity belum dapat ditentukan secara sah.',
  OPENING_SOURCE_EVIDENCE_MISSING: 'Referensi sumber posisi awal belum tersedia.',
  CLOSING_SOURCE_EVIDENCE_MISSING: 'Referensi sumber posisi penutup belum tersedia.',
  TRANSACTION_SOURCE_EVIDENCE_MISSING: 'Transaksi yang digunakan belum mempunyai referensi sumber tervalidasi.',
  TRANSACTION_SOURCE_REQUIRES_REVIEW: 'Bukti sumber transaksi masih perlu ditinjau.',
  CLOSING_POSITION_COVERAGE_PARTIAL: 'Statement penutup hanya mencakup sebagian posisi.',
  CLOSING_POSITION_COVERAGE_UNKNOWN: 'Kelengkapan posisi statement penutup belum diketahui.',
};

export const describeReconciliationReason = code => reasons[code] ?? holdingsReasons[code] ?? 'Ada prasyarat bukti yang belum terpenuhi.';
