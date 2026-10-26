import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from '../api/axios';
import { Badge, EmptyState, LoadingState, Notice, PageHeading, Panel } from '../ui/components';
import ReconciliationResult from '../ui/ReconciliationResult';
import useApiData from '../ui/useApiData';
import { useWorkspace } from '../ui/workspace';
import { date, safeError, TIME_ZONE } from '../ui/format';

export default function ReconciliationWorkspace() {
  const { accounts, filters, setFilters } = useWorkspace();
  const [limitDate, setLimitDate] = useState(() => {
    const parts = new Intl.DateTimeFormat('en', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
  });
  const listScope = `${filters.accountId}:${limitDate}`;
  const [selection, setSelection] = useState({ scope: null, opening: null, closing: null });
  const [paging, setPaging] = useState({ scope: null, page: 1 });
  const [historyPaging, setHistoryPaging] = useState({ account: null, page: 1 });
  const [timezone, setTimezone] = useState('');
  const [cutoff, setCutoff] = useState('');
  const [boundaryAccount, setBoundaryAccount] = useState(null);
  const [evaluation, setEvaluation] = useState({ scope: null, status: 'idle', data: null });
  const [proof, setProof] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [historyRevision, setHistoryRevision] = useState(0);
  const [historySelection, setHistorySelection] = useState({ account: null, id: '' });
  const requestRef = useRef({ sequence: 0, controller: null });
  const selectedAccount = accounts.data.find(account => String(account.id) === String(filters.accountId));
  const base = selectedAccount ? `/api/investment-accounts/${selectedAccount.id}` : null;
  const opening = selection.scope === listScope ? selection.opening : null;
  const closing = selection.scope === listScope ? selection.closing : null;
  const activeTimezone = boundaryAccount === filters.accountId ? timezone.trim() : '';
  const activeCutoff = boundaryAccount === filters.accountId ? cutoff : '';
  const scope = `${listScope}:${opening?.id ?? ''}:${closing?.id ?? ''}:${activeTimezone}:${activeCutoff}`;
  useEffect(() => () => { requestRef.current.sequence += 1; requestRef.current.controller?.abort(); }, [scope]);
  const page = paging.scope === listScope ? paging.page : 1;
  const historyPage = historyPaging.account === filters.accountId ? historyPaging.page : 1;
  const snapshots = useApiData(base && limitDate ? `${base}/portfolio-snapshots?as_of=${limitDate}&page=${page}` : null);
  const history = useApiData(base ? `${base}/reconciliation-runs?page=${historyPage}` : null, historyRevision);
  const selectedRun = historySelection.account === filters.accountId ? historySelection.id : '';
  const detail = useApiData(base && selectedRun ? `${base}/reconciliation-runs/${selectedRun}` : null, historyRevision);
  const current = evaluation.scope === scope ? evaluation : { status: 'idle', data: null };
  const pending = current.status === 'loading';
  const result = current.status === 'ready' ? current.data.data : null;
  const availableSnapshots = snapshots.data?.data ?? [];
  const snapshotChoices = [...new Map([...availableSnapshots, opening, closing].filter(Boolean).map(snapshot => [String(snapshot.id), snapshot])).values()];
  const parameters = () => ({ opening_snapshot_id: opening.id, closing_snapshot_id: closing.id, ...(activeTimezone ? { timezone: activeTimezone } : {}), ...(activeCutoff ? { cutoff: activeCutoff.length === 5 ? activeCutoff + ':00' : activeCutoff } : {}) });
  const evaluate = async (coverage = null) => {
    if (!base || !opening || !closing || pending || saving) return;
    const sequence = ++requestRef.current.sequence;
    requestRef.current.controller?.abort();
    const controller = new AbortController(); requestRef.current.controller = controller;
    setEvaluation({ scope, status: 'loading', data: null }); setSaveError(''); setSaveMessage('');
    const payload = { ...parameters(), ...(coverage ? { coverage } : {}), ...(result ? { previous_input_version: result.input_version } : {}) };
    try {
      const response = await axios.post(`${base}/reconciliation`, payload, { signal: controller.signal });
      if (requestRef.current.sequence !== sequence) return;
      setEvaluation({ scope, status: 'ready', data: response.data });
      setProof(response.data.data.coverage.confirmed ? coverage : null);
      setHistoryRevision(value => value + 1);
    } catch (err) {
      if (requestRef.current.sequence === sequence) setEvaluation({ scope, status: 'error', data: null, message: safeError(err, 'Perbandingan belum dapat dimuat. Periksa pilihan snapshot serta batas tanggal dan coba kembali.') });
    }
  };
  const save = async () => {
    if (!result || !current.data.history_available || saving) return;
    setSaving(true); setSaveMessage(''); setSaveError('');
    const sequence = ++requestRef.current.sequence;
    try {
      const response = await axios.post(`${base}/reconciliation-runs`, { ...parameters(), expected_input_version: result.input_version, ...(result.coverage.confirmed ? { coverage: { confirmed: true, input_version: result.input_version, source_ids: result.coverage.source_ids } } : {}) });
      if (requestRef.current.sequence !== sequence) return;
      setSaveMessage(response.data.replayed ? 'Hasil identik sudah tersimpan; tidak dibuat histori ganda.' : 'Hasil dan evidence tersimpan sebagai histori immutable.');
      setHistoryRevision(value => value + 1);
    } catch (err) {
      if (requestRef.current.sequence === sequence) {
        if (err.response?.status === 409) { setProof(null); setEvaluation({ scope, status: 'idle', data: null }); }
        setSaveError(err.response?.status === 409 ? 'Input berubah sebelum penyimpanan. Hitung ulang dan tinjau kembali konfirmasi coverage.' : safeError(err, 'Histori belum dapat disimpan. Perbandingan tetap dapat digunakan.'));
      }
    } finally { setSaving(false); }
  };
  const changeSelection = (role, id) => {
    const snapshot = snapshotChoices.find(item => String(item.id) === id) ?? null;
    setSelection(previous => ({ scope: listScope, opening: previous.scope === listScope ? previous.opening : null, closing: previous.scope === listScope ? previous.closing : null, [role]: snapshot }));
    setProof(null); setSaveMessage(''); setSaveError('');
  };
  const choices = accounts.data.filter(account => filters.provider === 'all' || account.platform_code === filters.provider);
  return <>
    <PageHeading eyebrow="POSITION INTEGRITY" title="Reconciliation" description="Bandingkan proyeksi ledger dan Monthly Statement dengan bukti serta kelengkapan yang dapat ditelusuri." action={<Badge status={result?.status ?? 'NOT_RUN'}/>}/>
    <Notice>Snapshot posisi FULL tidak otomatis menjamin aktivitas transaksi satu periode lengkap. Selisih adalah indikasi untuk review; tidak ada transaksi penyesuaian otomatis.</Notice>
    <Panel title="Pilihan rekonsiliasi" subtitle="Satu akun, satu opening baseline dan satu closing statement yang lebih baru."><form className="reconciliation-controls" onSubmit={event => { event.preventDefault(); evaluate(result?.coverage.confirmed ? proof : null); }}>
      <div className="baseline-controls"><label className="form-group">Provider<select value={filters.provider} disabled={pending || saving} onChange={event => { setFilters({ provider: event.target.value }); setProof(null); }}><option value="all">Semua provider</option><option value="stockbit">Stockbit</option><option value="bions">BIONS</option><option value="pluang">Pluang Crypto</option></select></label><label className="form-group">Akun rekonsiliasi<select value={filters.accountId} disabled={accounts.status !== 'ready' || pending || saving} onChange={event => { setFilters({ accountId: event.target.value }); setProof(null); setSaveMessage(''); setSaveError(''); }}><option value="all">Pilih satu akun</option>{choices.map(account => <option key={account.id} value={account.id}>{account.account_name || account.platform_name}</option>)}</select></label><label className="form-group">Snapshot sampai tanggal<input type="date" value={limitDate} required disabled={pending || saving} onChange={event => { setLimitDate(event.target.value); setProof(null); }}/></label><div className="form-group"><span>Interval efektif</span><strong>{opening && closing ? `${date(opening.as_of_date)} → ${date(closing.as_of_date)}` : 'Pilih opening dan closing'}</strong></div></div>
      {snapshots.status === 'ready' && <div className="baseline-controls"><label className="form-group">Opening snapshot<select value={opening?.id ?? ''} required disabled={pending || saving} onChange={event => changeSelection('opening', event.target.value)}><option value="">Pilih baseline terkonfirmasi</option>{snapshotChoices.map(snapshot => <option key={snapshot.id} value={snapshot.id} disabled={snapshot.baseline_issues.length > 0}>#{snapshot.id} · {date(snapshot.as_of_date)} · {snapshot.coverage} · {snapshot.review_status}</option>)}</select></label><label className="form-group">Closing Monthly Statement<select value={closing?.id ?? ''} required disabled={pending || saving} onChange={event => changeSelection('closing', event.target.value)}><option value="">Pilih statement penutup</option>{snapshotChoices.map(snapshot => <option key={snapshot.id} value={snapshot.id} disabled={!!opening && snapshot.as_of_date <= opening.as_of_date}>#{snapshot.id} · {date(snapshot.as_of_date)} · {snapshot.coverage} · {snapshot.review_status}</option>)}</select></label></div>}
      {snapshots.data?.meta.last_page > 1 && <div className="pagination"><button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1 || pending || saving} onClick={() => setPaging({ scope: listScope, page: page - 1 })}>Snapshot lebih baru</button><span>Halaman {page} / {snapshots.data.meta.last_page}</span><button type="button" className="btn btn-secondary btn-sm" disabled={page >= snapshots.data.meta.last_page || pending || saving} onClick={() => setPaging({ scope: listScope, page: page + 1 })}>Snapshot lebih lama</button></div>}
      <details className="timestamp-controls"><summary>Batas waktu transaksi TIMESTAMP</summary><div className="baseline-controls"><label className="form-group">Timezone batas periode<input value={activeTimezone} disabled={pending || saving} placeholder="Contoh: Asia/Jakarta" onChange={event => { if (boundaryAccount !== filters.accountId) setCutoff(''); setBoundaryAccount(filters.accountId); setTimezone(event.target.value); setProof(null); }}/></label><label className="form-group">Cutoff harian<input type="time" step="1" value={activeCutoff} disabled={pending || saving} onChange={event => { if (boundaryAccount !== filters.accountId) setTimezone(''); setBoundaryAccount(filters.accountId); setCutoff(event.target.value); setProof(null); }}/></label></div><p>Isi keduanya hanya setelah batas sumber diverifikasi. DATE memakai tanggal kalender; timezone broker tidak ditebak.</p></details>
      <div className="reconciliation-actions"><button className="btn btn-primary" disabled={!base || !opening || !closing || pending || saving}>{pending ? 'Membandingkan...' : result ? 'Hitung ulang' : 'Bandingkan posisi'}</button><Link className="text-link" to="/portfolio">Tinjau & konfirmasi snapshot di My Portfolio</Link></div>
    </form></Panel>
    {accounts.status === 'loading' && <LoadingState label="Akun rekonsiliasi sedang dimuat"/>}
    {accounts.status === 'error' && <EmptyState title="Akun belum dapat dimuat" action={<button className="btn btn-secondary" onClick={accounts.retry}>Coba lagi</button>}/>}
    {!base && accounts.status === 'ready' && <EmptyState icon="reconcile" title="Pilih akun untuk memulai">Belum ada perhitungan pada halaman ini. Quantity yang belum diketahui tidak ditampilkan sebagai nol.</EmptyState>}
    {snapshots.status === 'loading' && <LoadingState label="Pilihan snapshot sedang dimuat"/>}
    {snapshots.status === 'error' && <EmptyState title="Snapshot belum dapat dimuat" action={<button className="btn btn-secondary" onClick={snapshots.retry}>Coba lagi</button>}/>}
    {snapshots.status === 'ready' && !availableSnapshots.length && <EmptyState title="Belum ada snapshot pada rentang pilihan">Impor opening dan closing statement, lalu konfirmasikan melalui My Portfolio.</EmptyState>}
    {pending && <LoadingState label="Rekonsiliasi sedang dihitung"/>}
    {current.status === 'error' && <Notice tone="danger" role="alert">{current.message}</Notice>}
    {result && <><Panel title="Konfirmasi kelengkapan aktivitas" subtitle="Opsional; terikat pada interval, referensi sumber dan versi input saat ini."><div className="confirmation-controls"><label className="attestation-control"><input type="checkbox" checked={result.coverage.confirmed} disabled={pending || saving || !result.evidence.sources.length} onChange={event => { const next = event.target.checked ? { confirmed: true, input_version: result.input_version, source_ids: result.evidence.sources.map(source => source.id) } : null; setProof(next); evaluate(next); }}/><span>Saya telah meninjau seluruh sumber yang tercantum dan mengonfirmasi bahwa aktivitas quantity pada interval ini lengkap, termasuk bila memang tidak ada aktivitas.</span></label><p>Ini attestation pengguna, bukan verifikasi otomatis PDF. Konfirmasi tidak meloloskan transaksi invalid, duplicate pending, unit UNKNOWN, atau snapshot yang belum valid. Input berubah memerlukan konfirmasi ulang.</p></div></Panel><ReconciliationResult result={result}/><div className="reconciliation-actions"><button className="btn btn-secondary" disabled={!current.data.history_available || saving} onClick={save}>{saving ? 'Menyimpan histori...' : 'Simpan hasil ke histori'}</button>{!current.data.history_available && <span className="muted">Histori belum aktif: migration Gate 3 menunggu penerapan manual. Perbandingan tetap berfungsi.</span>}</div></>}
    {saveError && <Notice tone="danger" role="alert">{saveError}</Notice>}{saveMessage && <Notice tone="success">{saveMessage}</Notice>}
    {base && <Panel title="Histori rekonsiliasi" subtitle="Hasil tersimpan tidak ditimpa. Freshness diperiksa kembali saat dibaca.">{history.status === 'loading' ? <LoadingState label="Histori rekonsiliasi sedang dimuat"/> : history.status === 'error' ? <EmptyState title="Histori belum dapat dimuat" action={<button className="btn btn-secondary" onClick={history.retry}>Muat ulang histori</button>}/> : history.data && !history.data.available ? <EmptyState compact title="Penyimpanan histori belum aktif">Migration additive Gate 3 belum diterapkan. Tidak ada migration otomatis dari halaman ini.</EmptyState> : history.data?.data.length ? <><ul className="reconciliation-history-list">{history.data.data.map(run => <li key={run.run_id}><div><strong>{date(run.result.window.opening_exclusive)} → {date(run.result.window.as_of_inclusive)}</strong><small>Disimpan {date(run.saved_at, true)} · {run.freshness === 'STALE' ? 'STALE — input berubah' : 'Versi diperiksa saat dimuat'}</small></div><Badge status={run.result.status}/><button className="btn btn-secondary btn-sm" disabled={pending || saving} onClick={() => setHistorySelection({ account: filters.accountId, id: run.run_id })}>Lihat hasil</button></li>)}</ul>{history.data.meta.last_page > 1 && <div className="pagination"><button className="btn btn-secondary btn-sm" disabled={historyPage <= 1} onClick={() => setHistoryPaging({ account: filters.accountId, page: historyPage - 1 })}>Lebih baru</button><span>Halaman {historyPage} / {history.data.meta.last_page}</span><button className="btn btn-secondary btn-sm" disabled={historyPage >= history.data.meta.last_page} onClick={() => setHistoryPaging({ account: filters.accountId, page: historyPage + 1 })}>Lebih lama</button></div>}</> : <EmptyState compact title="Belum ada hasil tersimpan">Perbandingan tidak otomatis disimpan. Tinjau hasil, lalu gunakan Simpan hasil ke histori.</EmptyState>}</Panel>}
    {detail.status === 'loading' && <LoadingState label="Hasil historis sedang dimuat"/>}
    {detail.status === 'error' && <Notice tone="danger" role="alert">Hasil historis belum dapat dimuat.</Notice>}
    {detail.status === 'ready' && <><div className="reconciliation-actions"><button className="btn btn-secondary" disabled={pending || saving} onClick={() => { const saved = detail.data.result; setSelection({ scope: listScope, opening: saved.evidence.snapshots.opening, closing: saved.evidence.snapshots.closing }); setBoundaryAccount(filters.accountId); setTimezone(saved.parameters.timezone ?? ''); setCutoff(saved.parameters.cutoff ?? ''); setProof(null); setEvaluation({ scope: null, status: 'idle', data: null }); }}>Gunakan pilihan histori untuk hitung ulang</button></div><ReconciliationResult result={detail.data.result} historical stale={!detail.data.is_current}/></>}
  </>;
}
