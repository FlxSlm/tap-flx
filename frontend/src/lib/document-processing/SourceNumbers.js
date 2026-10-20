// Exact decimal values for structured imports. Never derive missing money from zero.
export function plainNumber(value) {
  if (value == null) return null;
  const original = String(value);
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(original)) throw new Error('Unsupported numeric grouping.');
  const text = original.replaceAll(',', '');
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw new Error('Unsupported numeric format.');
  return text;
}

export function sumNumbers(...values) {
  if (values.some(value => value == null)) return null;
  const texts = values.map(plainNumber);
  const scale = Math.max(...texts.map(text => (text.split('.')[1] ?? '').length));
  const total = texts.reduce((sum, text) => {
    const [whole, fraction = ''] = text.split('.');
    return sum + BigInt(whole + fraction.padEnd(scale, '0'));
  }, 0n).toString().padStart(scale + 1, '0');
  return scale ? `${total.slice(0, -scale)}.${total.slice(-scale)}` : total;
}

export function providerDate(value, format) {
  if (!value) return null;
  const months = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
  const parts = value.trim().split(/[ /-]+/);
  let [day, month, year] = parts;
  if (format === 'month-name') month = months[month];
  if (year?.length === 2) year = `20${year}`;
  const iso = `${year}-${month}-${day?.padStart(2, '0')}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.valueOf()) || d.toISOString().slice(0, 10) !== iso ? null : iso;
}
