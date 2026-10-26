import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AllocationView } from '../ui/FinancialViews';
import { Badge, EmptyState, Metric, Notice, PageHeading, Panel } from '../ui/components';
import PerformanceChart from '../ui/PerformanceChart';
import WorkspaceFilters from '../ui/WorkspaceFilters';
import { useWorkspace } from '../ui/workspace';
import Icon from '../ui/Icon';

export { default as Portfolio } from './PortfolioHoldings';

export function Analytics() {
  const [range, setRange] = useState('1M');
  return <><PageHeading eyebrow="ACTIVITY & PERFORMANCE" title="Analytics" description="Statistik yang dapat ditelusuri ke transaksi dan biaya perolehan." action={<Badge status="NOT_AVAILABLE"/>}/><WorkspaceFilters/><Notice>Analitik belum tersedia. Tidak adanya transaksi terimpor belum membuktikan satu periode tanpa aktivitas.</Notice><div className="metric-strip analytics-metrics">{[['Transaksi BUY / SELL', 'count'], ['Volume beli', 'money'], ['Volume jual', 'money'], ['Dividen diterima', 'money'], ['Realized P/L', 'money'], ['Unrealized P/L', 'money'], ['Win rate', 'percent'], ['Aktivitas bulanan', 'count']].map(([label, kind]) => <Metric key={label} label={label} kind={kind} status="INCOMPLETE" note={label === 'Win rate' ? 'Memerlukan realized P/L dan cost basis' : 'Cakupan dan metode belum terverifikasi'}/>)}</div><div className="dashboard-chart-row"><Panel title="Historical performance" subtitle="Riwayat nilai portofolio" action={<RangeSelector value={range} onChange={setRange}/>}><PerformanceChart range={range}/></Panel><Panel title="Portfolio allocation" subtitle="Bobot nilai saham dan crypto"><AllocationView/></Panel></div><Panel title="Monthly activity trend" subtitle="Jumlah transaksi dan volume terverifikasi per periode"><EmptyState compact icon="transactions" title="Tren aktivitas belum tersedia">Bulan dengan data UNKNOWN tidak digambar sebagai aktivitas nol. Belum ada statistik yang bisa dipertanggungjawabkan untuk filter ini.</EmptyState></Panel></>;
}

export function RangeSelector({ value, onChange }) {
  return <div className="segmented-control" role="group" aria-label="Rentang grafik">{['1M', '3M', '6M', '1Y', 'ALL'].map(range => <button key={range} type="button" aria-pressed={value === range} className={value === range ? 'selected' : ''} onClick={() => onChange(range)}>{range}</button>)}</div>;
}

export function Connections() {
  const { accounts } = useWorkspace();
  return <><PageHeading eyebrow="SOURCES & ACCOUNTS" title="Connections" description="Sumber data portofolio Anda, dengan kendali atas cara dokumen diproses."/><div className="connection-list">{[['stockbit', 'Stockbit', 'Saham', 'SOA dan Trade Confirmation'], ['bions', 'BIONS', 'Saham', 'SOA, Trade Confirmation, dan Cash Dividend'], ['pluang', 'Pluang', 'Crypto', 'Monthly Statement']].map(([code, label, category, documents]) => <section className="connection-row" key={code}><span className={`provider-monogram provider-${code}`}>{label.slice(0, 1)}</span><div><h2>{label} <span className="category-label">{category}</span></h2><p>{documents}</p><small>{accounts.status === 'ready' ? `${accounts.data.filter(account => account.platform_code === code).length} akun tercatat` : 'Informasi akun belum tersedia'}</small></div><div className="connection-action"><Badge tone="info">Upload manual</Badge><Link className="text-link" to="/documents">Kelola dokumen <Icon name="arrow" size={16}/></Link></div></section>)}</div><Panel title="Otomatisasi email" subtitle="Koneksi yang membutuhkan persetujuan akses terpisah"><EmptyState compact icon="connections" title="Automatic Mode belum tersedia">Tidak ada koneksi Gmail atau pengambilan email otomatis yang diaktifkan. Gunakan Privacy Mode untuk memproses PDF lokal.</EmptyState></Panel></>;
}

export function Settings() {
  const { profile } = useWorkspace();
  return <><PageHeading eyebrow="PERSONAL WORKSPACE" title="Settings" description="Identitas akun dan cara workspace menjaga data Anda."/><div className="settings-layout"><Panel title="Profil akun" subtitle="Informasi akun yang sedang masuk"><dl className="definition-list"><div><dt>Nama</dt><dd>{profile?.name ?? 'Belum tersedia'}</dd></div><div><dt>Email</dt><dd>{profile?.email ?? 'Belum tersedia'}</dd></div><div><dt>Jenis workspace</dt><dd>Personal</dd></div></dl><p className="panel-footnote">Perubahan profil belum tersedia pada versi ini.</p></Panel><Panel title="Privasi & sesi" subtitle="Kendali data saat memproses dokumen"><ul className="privacy-principles"><li><Icon name="shield"/><div><strong>Pemrosesan PDF lokal</strong><p>File asli dan password PDF tidak dikirim ke server.</p></div></li><li><Icon name="check"/><div><strong>Konfirmasi sebelum impor</strong><p>Hanya data terstruktur yang Anda pilih dikirim setelah konfirmasi.</p></div></li><li><Icon name="clock"/><div><strong>Riwayat sesi tidak disimpan di browser</strong><p>Daftar impor sesi dibersihkan saat workspace ditutup atau Anda keluar.</p></div></li></ul></Panel></div></>;
}
