import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from '../api/axios';
import { Badge, EmptyState, LoadingState, Notice, PageHeading, Panel, TableRegion } from '../ui/components';
import { date, number, safeError, TIME_ZONE } from '../ui/format';
import Icon from '../ui/Icon';
import { useWorkspace } from '../ui/workspace';
import useApiData from '../ui/useApiData';
import { describeHoldingsReason } from '../ui/holdingsReasons';

function ReasonList({ reasons = [] }) {
  return reasons.length ? <ul className="holdings-reasons">{reasons.map(reason => <li key={reason}>{describeHoldingsReason(reason)}</li>)}</ul> : null;
}

function SourceLabel({ snapshot }) {
  return <span>{snapshot.source ? `${snapshot.source.provider} · ${snapshot.source.document_type}` : snapshot.source_indicator === 'UNVERIFIED_SOURCE_LINK' ? 'Sumber belum terverifikasi' : 'Legacy / input manual'}<small className="cell-subline">{snapshot.source?.parser_version ?? 'Verifikasi sumber oleh pengguna diperlukan'}</small></span>;
}

function SnapshotConfirmation({ snapshot, onConfirmed, provider }) {
  const [coverage, setCoverage] = useState(snapshot.coverage);
  const [units, setUnits] = useState(Object.fromEntries(snapshot.items.map(item => [item.id, item.unit === 'UNKNOWN' ? '' : item.unit])));
  const [attested, setAttested] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const submit = async event => {
    event.preventDefault();
    if (!attested || pending) return;
    setPending(true); setError('');
    try {
      await axios.post(`/api/investment-accounts/${snapshot.accountId}/portfolio-snapshots/${snapshot.id}/confirm`, {
        confirmed: true, expected_fingerprint: snapshot.fingerprint, coverage,
        items: snapshot.items.map(item => ({ id: item.id, unit: units[item.id] })),
      });
      onConfirmed();
    } catch (err) { setError(safeError(err, 'Konfirmasi belum tersimpan. Muat ulang snapshot sebelum mencoba kembali.')); }
    finally { setPending(false); }
  };
  if (snapshot.baseline_issues.includes('SAME_DATE_SNAPSHOT_CONFLICT')) return <Notice tone="warning">{describeHoldingsReason('SAME_DATE_SNAPSHOT_CONFLICT')} Snapshot ini belum dapat dikonfirmasi sebagai baseline.</Notice>;
  return <form className="snapshot-confirmation" onSubmit={submit} aria-label="Konfirmasi snapshot">
    <Notice>Periksa quantity dan unit pada sumber asli. Konfirmasi mencatat pemeriksaan Anda dan tidak mengubah quantity atau membuat transaksi.</Notice>
    {error && <Notice tone="danger" role="alert">{error}</Notice>}
    <TableRegion label="Unit snapshot yang akan dikonfirmasi"><table><thead><tr><th>Aset</th><th className="numeric">Quantity sumber</th><th>Unit terverifikasi</th></tr></thead><tbody>{snapshot.items.map(item => <tr key={item.id}><td><strong>{item.symbol}</strong></td><td className="numeric">{number(item.quantity)}</td><td><label className="sr-only" htmlFor={`snapshot-unit-${item.id}`}>Unit {item.symbol}</label><select id={`snapshot-unit-${item.id}`} value={units[item.id]} disabled={pending || item.unit !== 'UNKNOWN'} required onChange={event => setUnits(previous => ({ ...previous, [item.id]: event.target.value }))}><option value="">Pilih berdasarkan sumber</option>{(provider === 'PLUANG' ? ['COIN'] : ['SHARE', 'LOT']).map(unit => <option key={unit}>{unit}</option>)}</select></td></tr>)}</tbody></table></TableRegion>
    {!snapshot.items.length && <p className="panel-footnote">Snapshot ini menyatakan tidak ada posisi. Pastikan dokumen memang kosong, bukan hasil parser yang gagal membaca baris.</p>}
    <div className="confirmation-controls"><label className="form-group">Cakupan posisi<select value={coverage} disabled={pending} onChange={event => setCoverage(event.target.value)}><option value="UNKNOWN">UNKNOWN — belum diketahui</option><option value="PARTIAL">PARTIAL — sebagian posisi</option><option value="FULL">FULL — seluruh posisi pada dokumen</option></select></label><p>FULL memerlukan jumlah posisi hasil parsing yang lengkap. FULL posisi tetap tidak membuktikan kelengkapan transaksi.</p><label className="attestation-control"><input type="checkbox" checked={attested} onChange={event => setAttested(event.target.checked)} disabled={pending} required/><span>Saya telah memeriksa quantity, unit, dan cakupan posisi terhadap dokumen sumber.</span></label><button className="btn btn-primary" disabled={pending || !attested || snapshot.items.some(item => !units[item.id])}>{pending ? 'Menyimpan konfirmasi...' : 'Konfirmasi snapshot'}</button></div>
  </form>;
}

function ReportedPositions({ reported, account }) {
  if (!reported.snapshots.length) return <Panel title="Reported holdings" subtitle="Posisi yang dilaporkan statement"><EmptyState icon="portfolio" title="Belum ada snapshot untuk tanggal ini">Impor laporan bulanan melalui Document Center. Tidak ada posisi yang diasumsikan nol.</EmptyState></Panel>;
  return <>{reported.snapshots.length > 1 && <Notice tone="warning">Ada beberapa snapshot pada tanggal laporan yang sama. Semua versi ditampilkan terpisah; baseline tidak dipilih otomatis dan konflik belum diselesaikan.</Notice>}{reported.snapshots.map(snapshot => <Panel key={snapshot.id} title={`Reported holdings · ${date(snapshot.as_of_date)}`} subtitle={`${account.account_name || 'Akun investasi'} · ${account.provider} · snapshot #${snapshot.id}`} action={<Badge status={snapshot.authoritative_reported ? 'CONFIRMED' : 'PENDING_REVIEW'}/>}>
    <div className="holdings-context"><Badge status={snapshot.coverage}/><span>{snapshot.authoritative_reported ? 'Posisi terkonfirmasi dari sumber' : 'Observasi sumber; belum menjadi posisi terkonfirmasi'} · bukan harga live</span></div>
    <TableRegion label={`Reported holdings snapshot ${snapshot.id}`}><table><thead><tr><th>Aset</th><th className="numeric">Reported quantity</th><th>Unit</th><th>As-of</th><th>Sumber</th></tr></thead><tbody>{snapshot.items.map(item => <tr key={item.id}><td><strong>{item.symbol}</strong></td><td className="numeric">{number(item.quantity)}</td><td>{item.unit === 'UNKNOWN' ? 'Unit belum diketahui' : item.unit}</td><td>{date(snapshot.as_of_date)}</td><td><SourceLabel snapshot={snapshot}/></td></tr>)}</tbody></table></TableRegion>
    {!snapshot.items.length && <EmptyState compact title={snapshot.authoritative_reported && snapshot.coverage === 'FULL' ? 'Tidak ada posisi menurut snapshot terkonfirmasi' : 'Snapshot tanpa baris posisi'}>Cakupan posisi {snapshot.coverage}; cakupan aktivitas tetap {snapshot.activity_coverage}.</EmptyState>}
  </Panel>)}</>;
}

function CalculatedPositions({ calculated, asOf }) {
  return <Panel title="Calculated holdings" subtitle={`Proyeksi dari opening snapshot dan transaksi diterima · target ${date(asOf)}`} action={<Badge status={calculated.status}/>}>
    <ReasonList reasons={calculated.reasons}/>
    {calculated.items.length ? <TableRegion label="Calculated holdings"><table><thead><tr><th>Aset</th><th className="numeric">Opening</th><th className="numeric">BUY diterima</th><th className="numeric">SELL diterima</th><th className="numeric">Calculated quantity</th><th>Unit</th><th>Kelengkapan</th><th>Dasar ledger</th></tr></thead><tbody>{calculated.items.map(item => <tr key={`${item.symbol}-${item.unit}`}><td><strong>{item.symbol}</strong></td><td className="numeric">{number(item.opening_quantity)}</td><td className="numeric">{number(item.buy_quantity)}</td><td className="numeric">{number(item.sell_quantity)}</td><td className="numeric"><strong>{number(item.quantity)}</strong></td><td>{item.unit === 'UNKNOWN' ? 'Belum diketahui' : item.unit}</td><td><Badge status={item.status}/><details><summary>Alasan status</summary><ReasonList reasons={item.reasons}/></details></td><td>{item.transaction_ids.length ? <details><summary>{item.transaction_ids.length} transaksi</summary><p>{item.transaction_ids.map(id => `#${id}`).join(', ')}</p></details> : 'Tanpa transaksi diterima'}</td></tr>)}</tbody></table></TableRegion> : <EmptyState compact icon="portfolio" title={calculated.status === 'COMPLETE' ? 'Tidak ada posisi dari baseline terkonfirmasi' : 'Proyeksi belum tersedia'}>Baseline yang belum dipilih, unit ambigu, dan konflik tidak diubah menjadi saldo nol.</EmptyState>}
    <div className="holdings-evidence"><details><summary>Dasar perhitungan dan versi input</summary><p>Opening snapshot: {calculated.baseline ? `#${calculated.baseline.id} · ${date(calculated.baseline.as_of_date)}` : 'Belum dipilih'}</p><p>Interval tanggal: setelah baseline sampai tanggal tujuan, inklusif pada tujuan.</p><p>Batas timestamp: {calculated.window.timezone ? `${calculated.window.timezone} · ${calculated.window.cutoff}` : 'Belum ditetapkan; timestamp ambigu tidak dihitung'}</p><p>Event / bukti ditahan: {calculated.excluded_events.length}. Penghitungan ulang dilakukan setiap permintaan.</p><p className="batch-reference">Versi input: <code>{calculated.input_version}</code></p></details></div>
    <p className="panel-footnote">Reported dan calculated belum direkonsiliasi. Status rekonsiliasi tetap NOT_RUN. Quantity proyeksi dengan cakupan INCOMPLETE bukan jaminan posisi aktual lengkap.</p>
  </Panel>;
}

function PortfolioWorkspace() {
  const { accounts, filters, setFilters } = useWorkspace();
  const [asOf, setAsOf] = useState(() => {
    const parts = new Intl.DateTimeFormat('en', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
  });
  const scope = `${filters.accountId}:${asOf}`;
  const [selection, setSelection] = useState({ scope: null, id: '' });
  const [pageState, setPageState] = useState({ scope: null, page: 1 });
  const [review, setReview] = useState({ scope: null, id: '' });
  const [timezone, setTimezone] = useState('');
  const [cutoff, setCutoff] = useState('');
  const [boundaries, setBoundaries] = useState({ timezone: '', cutoff: '' });
  const [revision, setRevision] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const baselineId = selection.scope === scope ? selection.id : '';
  const page = pageState.scope === scope ? pageState.page : 1;
  const selectedAccount = accounts.data.find(account => String(account.id) === String(filters.accountId));
  const base = selectedAccount && asOf ? `/api/investment-accounts/${selectedAccount.id}` : null;
  const params = new URLSearchParams({ as_of: asOf });
  if (baselineId) params.set('baseline_snapshot_id', baselineId);
  if (boundaries.accountId === filters.accountId && boundaries.timezone && boundaries.cutoff) { params.set('timezone', boundaries.timezone); params.set('cutoff', boundaries.cutoff); }
  const positions = useApiData(base ? `${base}/holdings?${params}` : null, revision);
  const snapshots = useApiData(base ? `${base}/portfolio-snapshots?as_of=${asOf}&page=${page}` : null, revision);
  const choices = accounts.data.filter(account => filters.provider === 'all' || account.platform_code === filters.provider);
  const reviewing = snapshots.data?.data.find(snapshot => String(snapshot.id) === (review.scope === scope ? review.id : ''));
  const refresh = () => { setRevision(value => value + 1); setConfirmed(false); };
  const changePage = next => { setPageState({ scope, page: next }); setReview({ scope, id: '' }); setSelection({ scope, id: '' }); };
  return <>
    <PageHeading eyebrow="REPORTED & LEDGER-DERIVED POSITIONS" title="My Portfolio" description="Lihat posisi statement dan proyeksi ledger dengan sumber, tanggal, dan kelengkapan yang jelas." action={<Link to="/documents" className="btn btn-primary"><Icon name="upload" size={17}/>Impor laporan</Link>}/>
    <div className="scope-toolbar"><div className="filter-fields"><label>Provider<select value={filters.provider} onChange={event => setFilters({ provider: event.target.value })}><option value="all">Semua provider</option><option value="stockbit">Stockbit</option><option value="bions">BIONS</option><option value="pluang">Pluang Crypto</option></select></label><label>Akun investasi<select value={filters.accountId} disabled={accounts.status !== 'ready'} onChange={event => { setFilters({ accountId: event.target.value }); setConfirmed(false); }}><option value="all">Pilih satu akun</option>{choices.map(account => <option key={account.id} value={account.id}>{account.account_name || account.platform_name}</option>)}</select></label><label>Tanggal posisi<input type="date" value={asOf} required onChange={event => { setAsOf(event.target.value); setConfirmed(false); }}/></label></div><button className="btn btn-secondary" onClick={refresh} disabled={!base}>Muat ulang posisi</button></div>
    {accounts.status === 'loading' && <LoadingState label="Akun sedang dimuat"/>}
    {accounts.status === 'error' && <EmptyState title="Akun belum dapat dimuat" action={<button className="btn btn-secondary" onClick={accounts.retry}>Coba lagi</button>}/>}
    {!base && accounts.status === 'ready' && <EmptyState icon="portfolio" title="Pilih akun dan tanggal posisi">Setiap proyeksi dibatasi pada satu akun. Aset antar-provider tidak digabung.</EmptyState>}
    {confirmed === scope && base && <Notice tone="success">Konfirmasi snapshot tersimpan bersama audit trail. Pilih snapshot sebagai baseline untuk proyeksi.</Notice>}
    {base && <>
      <Notice>Monthly Statement-Based Update tetap menampilkan reported holdings tanpa Trade Confirmation. Selisih snapshot tidak dibuat menjadi transaksi.</Notice>
      {snapshots.status === 'loading' ? <LoadingState label="Snapshot sedang dimuat"/> : snapshots.status === 'error' ? <EmptyState title="Daftar snapshot belum dapat dimuat" action={<button className="btn btn-secondary" onClick={snapshots.retry}>Coba lagi</button>}/> : snapshots.data && <Panel title="Opening snapshot & review" subtitle="Baseline dipilih secara eksplisit; snapshot terbaru tidak otomatis menjadi posisi awal.">
        <div className="baseline-controls"><label className="form-group">Opening snapshot<select value={baselineId} onChange={event => setSelection({ scope, id: event.target.value })}><option value="">Belum dipilih</option>{snapshots.data.data.map(snapshot => <option key={snapshot.id} value={snapshot.id} disabled={snapshot.baseline_issues.length > 0}>#{snapshot.id} · {date(snapshot.as_of_date)} · {snapshot.coverage} · {snapshot.review_status}</option>)}</select></label><label className="form-group">Snapshot untuk ditinjau<select value={review.scope === scope ? review.id : ''} onChange={event => setReview({ scope, id: event.target.value })}><option value="">Pilih snapshot</option>{snapshots.data.data.map(snapshot => <option key={snapshot.id} value={snapshot.id}>#{snapshot.id} · {date(snapshot.as_of_date)} · {snapshot.review_status}</option>)}</select></label></div>
        {!snapshots.data.data.length && <EmptyState compact title="Belum ada snapshot tersimpan">Impor laporan bulanan untuk membuat reported holdings terlebih dahulu.</EmptyState>}
        {snapshots.data.meta.last_page > 1 && <div className="pagination"><button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => changePage(page - 1)}>Snapshot lebih baru</button><span>Halaman {page} / {snapshots.data.meta.last_page}</span><button className="btn btn-secondary btn-sm" disabled={page >= snapshots.data.meta.last_page} onClick={() => changePage(page + 1)}>Snapshot lebih lama</button></div>}
        {reviewing && <SnapshotConfirmation key={`${scope}:${reviewing.fingerprint}`} snapshot={{ ...reviewing, accountId: selectedAccount.id }} provider={selectedAccount.platform_code.toUpperCase()} onConfirmed={() => { setRevision(value => value + 1); setReview({ scope, id: '' }); setConfirmed(scope); }}/>}
        <details className="timestamp-controls"><summary>Batas waktu untuk transaksi TIMESTAMP</summary><form onSubmit={event => { event.preventDefault(); setBoundaries({ accountId: filters.accountId, timezone: timezone.trim(), cutoff }); }}><label className="form-group">Timezone sumber yang diverifikasi<input value={timezone} onChange={event => setTimezone(event.target.value)} placeholder="Contoh: Asia/Jakarta" required/></label><label className="form-group">Cutoff harian<input type="time" step="1" value={cutoff} onChange={event => setCutoff(event.target.value.length === 5 ? event.target.value + ':00' : event.target.value)} required/></label><button className="btn btn-secondary">Terapkan batas waktu</button><button type="button" className="btn btn-secondary" onClick={() => { setBoundaries({ timezone: '', cutoff: '' }); setTimezone(''); setCutoff(''); }}>Hapus batas waktu</button></form><p>DATE menggunakan tanggal kalender. TIMESTAMP disimpan UTC oleh kontrak ledger; timezone dan cutoff hanya menentukan batas periode. Jangan menebak timezone broker.</p></details>
      </Panel>}
      {positions.status === 'loading' ? <LoadingState label="Holdings sedang dimuat"/> : positions.status === 'error' ? <EmptyState icon="portfolio" title="Holdings belum dapat dimuat" action={<button className="btn btn-secondary" onClick={positions.retry}>Coba lagi</button>}>Periksa koneksi, akses akun, serta timezone/cutoff jika digunakan. Kegagalan bukan saldo kosong.</EmptyState> : positions.data && <><ReportedPositions reported={positions.data.reported} account={positions.data.account}/><CalculatedPositions calculated={positions.data.calculated} asOf={positions.data.as_of}/></>}
    </>}
  </>;
}

export default function Portfolio() {
  const { preview } = useWorkspace();
  return preview ? <><PageHeading eyebrow="DEMO DATA" title="My Portfolio" description="Preview terisolasi; reported holdings aktual hanya tersedia setelah login."/><EmptyState icon="portfolio" title="Preview ini tidak mengakses data akun">Gunakan workspace terautentikasi untuk meninjau snapshot dan proyeksi holdings.</EmptyState></> : <PortfolioWorkspace/>;
}
