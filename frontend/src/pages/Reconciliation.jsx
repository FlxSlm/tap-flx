import React from 'react';
import { Link } from 'react-router-dom';
import { Badge, EmptyState, Notice, PageHeading, Panel, TableRegion } from '../ui/components';
import WorkspaceFilters from '../ui/WorkspaceFilters';
import { useWorkspace } from '../ui/workspace';
import { number } from '../ui/format';
import Icon from '../ui/Icon';
import ReconciliationWorkspace from './ReconciliationWorkspace';

/** UI contract only. Expected quantities/deltas/statuses must come from the future engine API. */
function ReconciliationPresentation({ presentation = null }) {
  const { filters, accounts } = useWorkspace();
  const rows = (presentation?.items ?? []).filter(row =>
    (!presentation?.period || !filters.period || presentation.period === filters.period)
    && (filters.accountId === 'all' || String(row.accountId) === String(filters.accountId))
    && (filters.provider === 'all' || accounts.data.find(account => String(account.id) === String(row.accountId))?.platform_code === filters.provider));
  return <><PageHeading eyebrow="POSITION INTEGRITY" title="Reconciliation" description="Telusuri kesesuaian posisi aset, sumber bukti, dan kelengkapan datanya." action={<Badge status={presentation?.status ?? 'NOT_RUN'}/>}/><WorkspaceFilters/><div className="reconciliation-workflow"><div><span>01</span><strong>Opening position</strong><p>Posisi awal yang terverifikasi</p></div><Icon name="arrow"/><div><span>02</span><strong>Canonical ledger</strong><p>Transaksi valid setelah posisi awal</p></div><Icon name="arrow"/><div><span>03</span><strong>Statement checkpoint</strong><p>Snapshot pada akhir periode</p></div></div><Notice>Snapshot posisi FULL tidak otomatis menjamin aktivitas transaksi satu periode lengkap. Selisih posisi tidak akan dibuat menjadi transaksi penyesuaian.</Notice><Panel title="Perbandingan posisi" subtitle={`Checkpoint ${filters.period || 'seluruh periode'} · posisi dalam unit yang sama`} action={<span className="unavailable-label"><Icon name="clock" size={15}/>Perhitungan belum tersedia</span>}>
      {rows.length ? <TableRegion label="Perbandingan posisi rekonsiliasi"><table><thead><tr><th>Aset / akun</th><th className="numeric">Opening</th><th className="numeric">Ledger closing</th><th className="numeric">Statement closing</th><th className="numeric">Selisih kuantitas</th><th>Status</th><th>Bukti sumber</th></tr></thead><tbody>{rows.map(row => <tr key={`${row.accountId}-${row.symbol}`}><td><strong>{row.symbol}</strong><small className="cell-subline">{row.accountName} · {row.unit}</small></td><td className="numeric">{number(row.opening)}</td><td className="numeric">{number(row.ledgerClosing)}</td><td className="numeric">{number(row.statementClosing)}</td><td className="numeric">{number(row.delta)}</td><td><Badge status={row.status}/></td><td>{row.evidence?.length ? <details><summary>{row.evidence.length} sumber</summary><ul>{row.evidence.map(source => <li key={source.id}>{source.label}</li>)}</ul></details> : 'Belum tersedia'}</td></tr>)}</tbody></table></TableRegion> : <EmptyState icon="reconcile" title="Posisi belum dibandingkan">Belum ada hasil rekonsiliasi yang dapat ditampilkan untuk akun dan periode ini. Siapkan laporan bulanan serta transaksi pendukung.<Link className="btn btn-primary empty-action" to="/documents">Buka Document Center <Icon name="arrow" size={17}/></Link></EmptyState>}
    </Panel><div className="two-column"><Panel title="Cara membaca status" subtitle="Status menjelaskan bukti, bukan sekadar kesamaan angka."><div className="status-guide">{[['MATCHED', 'Posisi cocok dan cakupan data memadai.'], ['MISMATCH', 'Ada perbedaan pada input yang dapat dibandingkan.'], ['INCOMPLETE', 'Posisi awal, unit, atau cakupan aktivitas belum cukup.'], ['PENDING_REVIEW', 'Ada ambiguitas yang membutuhkan pemeriksaan.'], ['NOT_RUN', 'Perhitungan belum dijalankan; bukan hasil nol.']].map(([status, label]) => <div key={status}><Badge status={status}/><p>{label}</p></div>)}</div></Panel><Panel title="Perlu ditinjau" subtitle="Temuan dari hasil rekonsiliasi"><EmptyState compact icon="document" title="Daftar review belum tersedia">Hasil rekonsiliasi dan bukti sumber akan tampil di sini saat layanan tersedia. Review import tetap dapat dilihat di Document Center.</EmptyState></Panel></div></>;
}

export default function Reconciliation({ presentation = null }) {
  const { preview } = useWorkspace();
  return presentation || preview ? <ReconciliationPresentation presentation={presentation}/> : <ReconciliationWorkspace/>;
}
