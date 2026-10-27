import { createHash } from 'node:crypto';

// Deterministic Standard Security Handler R2/RC4 fixture. Test data only, not
// a recommendation to encrypt private PDFs with this obsolete cipher.
export const syntheticPassword = 'Local-PDF-only!';
const padding = Buffer.from('28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a', 'hex');
const md5 = bytes => createHash('md5').update(bytes).digest();
function padded(value) { const bytes = Buffer.from(value, 'latin1').subarray(0, 32); return Buffer.concat([bytes, padding]).subarray(0, 32); }
function rc4(key, input) {
  const state = Array.from({ length: 256 }, (_, i) => i);
  let j = 0;
  for (let i = 0; i < 256; i++) { j = (j + state[i] + key[i % key.length]) % 256; [state[i], state[j]] = [state[j], state[i]]; }
  let i = 0; j = 0;
  return Buffer.from(input.map(value => { i = (i + 1) % 256; j = (j + state[i]) % 256; [state[i], state[j]] = [state[j], state[i]]; return value ^ state[(state[i] + state[j]) % 256]; }));
}
export const monthlyLines = ['STOCKBIT STATEMENT OF ACCOUNT', 'Date 01/01/2020 - 31/01/2020', ...['TSTA', 'TSTB', 'TSTC', 'TSTD'].map((symbol, i) => `${symbol} Synthetic Asset ${i + 1} 100.00 110.00 1,000.00 1,100.00 100.00 10.00`)];

export function syntheticPdf(lines = monthlyLines, { password = null, unsupportedEncryption = false } = {}) {
  const escape = value => value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
  let stream = Buffer.from(`BT /F1 8 Tf 10 750 Td 14 TL ${lines.map((line, i) => `${i ? 'T* ' : ''}(${escape(line)}) Tj`).join('\n')} ET`, 'latin1');
  const id = md5(Buffer.from(`gate36-synthetic:${lines.join('|')}`));
  let encryption;
  if (password !== null) {
    const owner = rc4(md5(padded('Synthetic Owner Password')).subarray(0, 5), padded(password));
    const permission = Buffer.alloc(4); permission.writeInt32LE(-4);
    const key = md5(Buffer.concat([padded(password), owner, permission, id])).subarray(0, 5);
    const user = rc4(key, padding);
    const objectKey = md5(Buffer.concat([key, Buffer.from([5, 0, 0, 0, 0])])).subarray(0, 10);
    stream = rc4(objectKey, stream);
    encryption = `<< /Filter /Standard /V ${unsupportedEncryption ? 9 : 1} /R 2 /Length 40 /O <${owner.toString('hex')}> /U <${user.toString('hex')}> /P -4 >>`;
  }
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1200 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream.toString('latin1')}\nendstream`, ...(encryption ? [encryption] : [])];
  let pdf = '%PDF-1.4\n'; const offsets = [];
  for (const [index, object] of objects.entries()) { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R ${encryption ? `/Encrypt 6 0 R /ID [<${id.toString('hex')}> <${id.toString('hex')}>]` : ''} >>\nstartxref\n${xref}\n%%EOF`;
  return Uint8Array.from(Buffer.from(pdf, 'latin1')).buffer;
}
