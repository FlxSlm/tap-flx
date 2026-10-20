/** Preserve row boundaries for text PDFs; this does not claim support for arbitrary layouts. */
export function pageText(items) {
  if (items.every(item => Array.isArray(item.transform))) {
    const rows = [];
    for (const item of items) {
      if (typeof item.str !== 'string' || !item.str.trim()) continue;
      const y = item.transform[5];
      let row = rows.find(candidate => Math.abs(candidate.y - y) <= 2);
      if (!row) { row = { y, items: [] }; rows.push(row); }
      row.items.push(item);
    }
    return rows.sort((a, b) => b.y - a.y).map(row => row.items
      .sort((a, b) => a.transform[4] - b.transform[4])
      .map(item => item.str).join(' ').replace(/Rp\s+(?=\d)/g, 'Rp')).join('\n');
  }
  const lines = [];
  let row = [];
  let lastY = null;
  const flush = () => {
    if (row.length) lines.push(row.join(' ').replace(/Rp\s+(?=\d)/g, 'Rp'));
    row = [];
  };
  for (const item of items) {
    if (typeof item.str !== 'string') continue;
    const y = item.transform?.[5];
    if (lastY !== null && y != null && Math.abs(y - lastY) > 2) flush();
    row.push(item.str);
    lastY = y ?? lastY;
    if (item.hasEOL) flush();
  }
  flush();
  return lines.join('\n');
}
