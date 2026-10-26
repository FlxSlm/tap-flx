import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../ui/Icon';
import { Badge, EmptyState, LoadingState, Metric, PageHeading, Panel, TableRegion } from '../ui/components';
import { AllocationView, HoldingsTable, ReconciliationSummary } from '../ui/FinancialViews';
import { date, number } from '../ui/format';
import PerformanceChart from '../ui/PerformanceChart';
import WorkspaceFilters from '../ui/WorkspaceFilters';
import { useTransactionFeed, useWorkspace } from '../ui/workspace';
import { RangeSelector } from './WorkspacePages';

export default function Dashboard({ presentation = null }) {
  const { profile, accounts, imports } = useWorkspace();
  const feed = useTransactionFeed();
  const [range, setRange] = useState('1M');
  const firstName = profile?.name?.trim().split(/\s+/)[0];
  return <>
    <PageHeading eyebrow="YOUR PORTFOLIO, IN CONTEXT" title="Overview" description={`${firstName ? `${firstName}, p` : 'P'}antau portofolio dan kualitas data Anda dalam satu workspace.`} action={<Link className="btn btn-primary" to="/documents"><Icon name="upload" size={17}/>Impor dokumen</Link>}/>
    <WorkspaceFilters/>
    <div className="metric-strip overview-metrics"><Metric primary label="Total portfolio value" value={presentation?.summary?.value} note="Valuasi pada tanggal laporan"/><Metric label="Invested / cost basis" value={presentation?.summary?.costBasis} note="Biaya perolehan terverifikasi"/><Metric label="Unrealized P/L" value={presentation?.summary?.unrealized} note="Posisi yang belum direalisasi"/><Metric label="Realized P/L" value={presentation?.summary?.realized} note="Hanya penjualan yang dapat dihitung"/></div>
    <div className="completeness-line"><span><Icon name="info" size={16}/><strong>Kelengkapan data</strong><Badge status="INCOMPLETE"/></span><p>Cakupan aktivitas dan biaya perolehan belum terverifikasi.</p></div>
    <ReconciliationSummary/>
    <div className="dashboard-chart-row"><Panel title="Portfolio performance" subtitle="Perubahan nilai berdasarkan valuasi terverifikasi" action={<RangeSelector value={range} onChange={setRange}/>}><PerformanceChart series={presentation?.series} range={range}/></Panel><Panel title="Asset allocation" subtitle="Saham dan crypto · berdasarkan nilai"><AllocationView allocations={presentation?.allocations}/></Panel></div>
    <Panel title="Holdings overview" subtitle="Posisi yang dilaporkan sumber, bukan estimasi dari data yang belum lengkap" action={<Link className="text-link" to="/portfolio">My Portfolio <Icon name="arrow" size={16}/></Link>}><HoldingsTable rows={presentation?.holdings}/></Panel>
    <div className="two-column activity-row"><Panel title="Recent activity" subtitle="Transaksi terakhir yang dimuat, difilter menurut scope pilihan" action={<Link className="text-link" to="/transactions">Lihat semua <Icon name="arrow" size={16}/></Link>}>
      {feed.status === 'loading' ? <LoadingState/> : feed.status === 'error' ? <EmptyState compact icon="transactions" title="Aktivitas belum dapat dimuat" action={<button className="btn btn-secondary" onClick={feed.retry}>Coba lagi</button>}>Data tidak dianggap kosong ketika koneksi belum berhasil.</EmptyState> : !feed.rows.length ? <EmptyState compact icon="transactions" title="Belum ada aktivitas yang dapat ditampilkan">Tidak ada baris dalam data yang dimuat untuk filter ini. Cakupan periode tetap belum diketahui.</EmptyState> : <TableRegion label="Aktivitas transaksi terbaru"><table><thead><tr><th>Aset / tanggal</th><th>Jenis</th><th className="numeric">Kuantitas</th><th>Kualitas</th></tr></thead><tbody>{feed.rows.slice(0, 5).map(tx => <tr key={tx.id}><td><strong>{tx.symbol ?? 'Cash event'}</strong><small className="cell-subline">{date(tx.transaction_date)}</small></td><td><span className={`trade-type trade-${tx.type.toLowerCase()}`}>{tx.type}</span></td><td className="numeric">{number(tx.quantity)}</td><td><Badge status={tx.review_status ?? 'UNKNOWN'}/></td></tr>)}</tbody></table></TableRegion>}
      <p className="panel-footnote">Maksimal 50 transaksi terbaru dimuat. Bukan total aktivitas bulanan.</p>
    </Panel><Panel title="Source activity" subtitle="Catatan impor yang dikonfirmasi pada sesi ini" action={<Link className="text-link" to="/documents">Document Center <Icon name="arrow" size={16}/></Link>}>
      {imports.length ? <ul className="source-activity-list">{imports.slice(0, 3).map(entry => <li key={entry.batchId}><Icon name="document"/><div><strong>{entry.provider} · {entry.documentType}</strong><small>{date(entry.recordedAt, true)}</small></div><Badge tone={entry.results.some(result => ['PENDING_REVIEW', 'SOURCE_CONFLICT'].includes(result.status)) ? 'warning' : 'info'}>{entry.results.some(result => ['PENDING_REVIEW', 'SOURCE_CONFLICT'].includes(result.status)) ? 'Perlu ditinjau' : 'Impor tercatat'}</Badge></li>)}</ul> : <EmptyState compact icon="document" title="Belum ada impor di sesi ini">Riwayat lengkap sumber belum tersedia. Impor yang dikonfirmasi akan muncul di sini selama sesi aktif.</EmptyState>}
      <div className="account-caption"><span>Akun investasi</span><strong>{accounts.status === 'ready' ? accounts.data.length : '—'}</strong><Link to="/connections" className="text-link">Lihat sumber <Icon name="arrow" size={14}/></Link></div>
    </Panel></div>
  </>;
}
