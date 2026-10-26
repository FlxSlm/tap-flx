import React, { useId, useState } from 'react';
import { EmptyState } from './components';
import { money, date } from './format';

/** Presentational only: receives verified dated valuations. It never reconstructs portfolio values. */
export default function PerformanceChart({ series = [], currency = 'IDR', range = '1M' }) {
  const titleId = useId();
  const [activeIndex, setActiveIndex] = useState(0);
  const dated = series.filter(point => point.value != null && point.value !== '' && Number.isFinite(Number(point.value)) && /^\d{4}-\d{2}-\d{2}$/.test(point.date) && Number.isFinite(Date.parse(`${point.date}T00:00:00Z`))).slice().sort((a, b) => a.date.localeCompare(b.date));
  const days = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 }[range];
  const lastDate = dated.length ? Date.parse(`${dated.at(-1).date}T00:00:00Z`) : 0;
  const points = days ? dated.filter(point => Date.parse(`${point.date}T00:00:00Z`) >= lastDate - days * 86400000) : dated;
  if (!points.length) return <div className="chart-unavailable"><div className="chart-axis-label">Nilai portofolio ({currency})</div><div className="chart-empty-body"><div className="chart-grid" aria-hidden="true"/><EmptyState compact icon="analytics" title="Kinerja belum dapat ditampilkan">Riwayat valuasi terverifikasi diperlukan untuk periode {range}.</EmptyState></div><div className="chart-x-label">Periode</div></div>;
  const values = points.map(point => Number(point.value));
  const low = Math.min(...values), high = Math.max(...values);
  const pad = low === high ? Math.max(Math.abs(high) * 0.02, 1) : 0;
  const min = low - pad, max = high + pad;
  const span = max - min;
  const coords = values.map((value, i) => [62 + i / Math.max(points.length - 1, 1) * 638, 184 - (value - min) / span * 134]);
  const selected = Math.min(activeIndex, points.length - 1);
  const [x, y] = coords[selected];
  return <div className="performance-chart"><div className="chart-axis-label">Nilai portofolio ({currency})</div><svg viewBox="0 0 730 230" role="img" aria-labelledby={titleId}><title id={titleId}>Nilai portofolio sepanjang periode {range}</title>{[50, 117, 184].map((line, i) => <g key={line}><line x1="62" x2="700" y1={line} y2={line} className="chart-grid-line"/><text x="54" y={line + 4} textAnchor="end" className="chart-tick">{new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(max - i * (max - min) / 2)}</text></g>)}<polyline points={coords.map(point => point.join(',')).join(' ')} fill="none" className="chart-series"/><line x1={x} x2={x} y1="40" y2="184" className="chart-guide"/><circle cx={x} cy={y} r="5" className="chart-selected-point"/>{coords.map(([cx], i) => <rect key={i} x={cx - 12} y="35" width="24" height="155" className="chart-hit-area" onPointerEnter={() => setActiveIndex(i)} onPointerMove={() => setActiveIndex(i)}/>)}<text x="62" y="215" className="chart-tick">{date(points[0].date)}</text><text x="700" y="215" textAnchor="end" className="chart-tick">{date(points.at(-1).date)}</text></svg><div className="chart-scrubber"><label htmlFor={`${titleId}-point`}>Pilih titik waktu</label><input id={`${titleId}-point`} type="range" min="0" max={points.length - 1} value={selected} onChange={event => setActiveIndex(Number(event.target.value))}/><output aria-live="polite">{date(points[selected].date)} · {money(points[selected].value, currency)}</output></div><div className="chart-x-label">Periode · valuasi yang dilaporkan</div></div>;
}
