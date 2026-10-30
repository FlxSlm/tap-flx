export const TIME_ZONE = 'Asia/Makassar';

export function currentPeriod() {
  const parts = new Intl.DateTimeFormat('en', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  return `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}`;
}

export function number(value, digits = 12) {
  if (value == null || value === '') return '—';
  if (!/^-?\d+(?:\.\d+)?$/.test(String(value))) return '—';
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: digits }).format(value);
}

export function money(value, currency = 'IDR') {
  if (value == null || value === '') return 'Belum tersedia';
  if (!/^-?\d+(?:\.\d+)?$/.test(String(value))) return 'Belum tersedia';
  try { return new Intl.NumberFormat('id-ID', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value); }
  catch { return 'Belum tersedia'; }
}

export function date(value, withTime = false) {
  if (!value) return 'Belum tersedia';
  const input = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value;
  const parsed = new Date(input);
  if (Number.isNaN(parsed.valueOf())) return 'Belum tersedia';
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TIME_ZONE, ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(parsed);
}

export function safeError(error, fallback = 'Data belum dapat dimuat. Silakan coba lagi.') {
  if (error?.response?.status === 401) return 'Sesi Anda berakhir. Silakan masuk kembali.';
  if (error?.response?.status === 419) return 'Token sesi kedaluwarsa. Masuk kembali sebelum mencoba lagi.';
  if (error?.response?.data?.code === 'SOURCE_SCHEMA_PENDING') return 'Fondasi impor database belum tersedia. Pemilik perlu meninjau migration manual.';
  if (error?.response?.status === 409) return 'Data bertentangan dengan catatan yang sudah ada. Periksa sebelum mencoba kembali.';
  if (error?.response?.status === 422) return 'Periksa isian dan kelengkapan data Anda sebelum mencoba kembali.';
  return fallback;
}

export const availability = {
  COMPLETE: ['Data lengkap', 'success'], REPORTED: ['Posisi dilaporkan', 'info'],
  MATCHED: ['Posisi sesuai', 'success'], MISMATCH: ['Posisi berbeda', 'danger'],
  INCOMPLETE: ['Data tidak lengkap', 'warning'], PENDING_REVIEW: ['Perlu ditinjau', 'warning'],
  NOT_RUN: ['Belum dihitung', 'neutral'], NOT_AVAILABLE: ['Belum tersedia', 'neutral'],
  UNKNOWN: ['Cakupan belum diketahui', 'neutral'], PARTIAL: ['Cakupan sebagian', 'warning'],
  FULL: ['Posisi lengkap', 'info'], CONFIRMED: ['Dikonfirmasi', 'success'], REQUIRED: ['Perlu ditinjau', 'warning'],
};
