import React from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { Badge, EmptyState, TableRegion } from './components';
import { money, number } from './format';

export function ReconciliationSummary({ model = null }) {
  const status = model?.status ?? 'NOT_AVAILABLE';
  return <section className="reconciliation-band" aria-labelledby="reconciliation-summary-title"><div className="reconciliation-intro"><span className="feature-icon"><Icon name="reconcile" size={26}/></span><div><p className="eyebrow">PORTFOLIO RECONCILIATION</p><h2 id="reconciliation-summary-title">Setiap posisi punya dasar.</h2><p>Bandingkan posisi dari ledger dengan laporan bulanan.</p><div className="reconciliation-state"><Badge status={status}/>{!model && <span>Hasil belum dimuat di Overview.</span>}<span>Rekonsiliasi terakhir: {model?.lastRunAt ?? 'Belum tersedia'}</span></div></div></div><div className="reconciliation-counts">{[['MATCHED', 'Sesuai'], ['MISMATCH', 'Berbeda'], ['INCOMPLETE', 'Tidak lengkap'], ['PENDING_REVIEW', 'Perlu review']].map(([key, label]) => <div key={key}><span className={`result-indicator ${key.toLowerCase()}`}/><strong>{model?.counts?.[key] ?? '—'}</strong><span>{label}</span></div>)}</div><Link className="text-link reconciliation-link" to="/reconciliation">Buka rekonsiliasi <Icon name="arrow" size={17}/></Link></section>;
}

export function HoldingsTable({ rows = [] }) {
  if (!rows.length) return <EmptyState icon="portfolio" title="Posisi aset belum tersedia">Snapshot posisi belum dapat ditampilkan. Dokumen bulanan dapat disiapkan melalui Document Center.<Link className="text-link empty-action" to="/documents">Kelola dokumen <Icon name="arrow" size={16}/></Link></EmptyState>;
  return <TableRegion label="Posisi aset"><table><thead><tr><th>Aset</th><th>Provider</th><th className="numeric">Kuantitas / unit</th><th className="numeric">Biaya rata-rata</th><th className="numeric">Valuasi</th><th className="numeric">P/L</th></tr></thead><tbody>{rows.map((row, i) => <tr key={`${row.accountId}-${row.symbol}-${i}`}><td><span className="asset-cell"><span className="asset-symbol">{row.symbol.slice(0, 1)}</span><span><strong>{row.symbol}</strong><small>{row.assetName || 'Nama aset belum tersedia'}</small></span></span></td><td>{row.provider}</td><td className="numeric">{number(row.quantity)} <span className="muted">{row.unit === 'UNKNOWN' ? 'unit belum diketahui' : row.unit}</span></td><td className="numeric">{row.averageCost == null ? '—' : money(row.averageCost, row.currency)}</td><td className="numeric">{row.marketValue == null ? '—' : money(row.marketValue, row.currency)}</td><td className="numeric">{row.pnl == null ? 'Belum tersedia' : money(row.pnl, row.currency)}</td></tr>)}</tbody></table></TableRegion>;
}

export function AllocationView({ allocations = [] }) {
  if (!allocations.length) return <div className="allocation-unavailable"><div className="allocation-empty-mark"><Icon name="allocation" size={46}/></div><h3>Komposisi belum tersedia</h3><p>Bobot aset membutuhkan nilai posisi yang terverifikasi.</p><div className="allocation-legend"><span><i/>Saham <strong>—</strong></span><span><i/>Crypto <strong>—</strong></span></div><small>Distribusi provider & kategori belum dihitung.</small></div>;
  return <div className="allocation-data">{allocations.map((item, index) => <div className="allocation-row" key={item.label}><div><span>{item.label}</span><strong>{number(item.percent, 1)}%</strong></div><div className="allocation-track"><span className={index ? 'secondary' : ''} style={{ width: `${Math.max(0, Math.min(item.percent, 100))}%` }}/></div><small>{item.providerLabel}</small></div>)}<p className="muted">Basis: valuasi pada tanggal laporan. Bukan harga live.</p></div>;
}
