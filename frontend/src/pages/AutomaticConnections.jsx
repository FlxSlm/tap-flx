import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { Badge, EmptyState, LoadingState, Notice, PageHeading, Panel, TableRegion } from '../ui/components';
import { date, safeError } from '../ui/format';
import './AutomaticConnections.css';

const hints = {
  AUTOMATIC_NOT_CONFIGURED: 'Konfigurasi OAuth Google belum tersedia. Ikuti panduan setup lokal.',
  AUTOMATIC_SCHEMA_PENDING: 'Migration Automatic Mode belum diterapkan oleh pemilik.',
  SOURCE_FILTER_REQUIRED: 'Label Gmail dan daftar alamat pengirim perlu dikonfigurasi oleh pemilik.',
  RECONNECT_REQUIRED: 'Izin Gmail berakhir. Hubungkan ulang Gmail melalui tombol Connect Gmail.',
  SYNC_PAUSED: 'Sinkronisasi dijeda atau pengaturan akun berubah. Muat ulang daftar dan sinkronkan kembali.',
  SYNC_BUSY: 'Sinkronisasi sebelumnya masih berjalan.',
  GOOGLE_UNAVAILABLE: 'Gmail belum dapat dihubungi. Periksa koneksi, quota, dan izin lalu coba kembali.',
};

export default function AutomaticConnections() {
  const [params] = useSearchParams();
  const [data, setData] = useState(null), [reviews, setReviews] = useState([]), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [selected, setSelected] = useState({});
  const [consent, setConsent] = useState(false), [preview, setPreview] = useState(null), [password, setPassword] = useState('');
  async function load() {
    const response = await api.get('/api/automatic'); setData(response.data);
    if (response.data.enabled && response.data.schema_ready) setReviews((await api.get('/api/automatic/reviews')).data.data);
  }
  useEffect(() => { let current = true; api.get('/api/automatic').then(async response => {
    if (!current) return; setData(response.data);
    if (response.data.enabled && response.data.schema_ready) {
      const result = await api.get('/api/automatic/reviews'); if (current) setReviews(result.data.data);
    }
  }).catch(error => { if (current) setError(safeError(error)); }); return () => { current = false; }; }, []);
  async function act(work) {
    setBusy(true); setError(''); setNotice('');
    try { await work(); await load(); } catch (error) { setError(hints[error.response?.data?.code] ?? safeError(error)); }
    finally { setBusy(false); setPassword(''); }
  }
  const ready = data?.enabled && data?.configured && data?.schema_ready;
  const choice = account => {
    const id = selected[account.id] ?? account.email_connection_id;
    return data?.connections.some(connection => connection.is_active && connection.id === Number(id)) ? String(id) : '';
  };
  const rows = preview?.payload?.snapshot?.items ?? preview?.payload?.transactions ?? [];
  return <div className="automatic-page">
    <PageHeading eyebrow="SOURCES & ACCOUNTS" title="Connections" description="Pilih cara memperoleh data per investment account. Riwayat portofolio tetap tersimpan saat mode berubah."/>
    {params.has('gmail') && <Notice tone={params.get('gmail') === 'CONNECTED' ? 'info' : 'warning'}>{params.get('gmail') === 'CONNECTED' ? 'Gmail berhasil dihubungkan. Pilih koneksi untuk investment account Anda.' : 'Koneksi Gmail belum berhasil. Periksa konfigurasi lokal dan sesi, kemudian mulai Connect Gmail kembali.'}</Notice>}
    {error && <Notice tone="danger" role="alert">{error} <button className="text-link" onClick={() => act(async () => {})}>Coba lagi</button></Notice>}
    {notice && <Notice>{notice}</Notice>}
    {!data && !error && <LoadingState label="Koneksi sedang dimuat"/>}
    {data && <>
      {!ready && <Notice tone="warning">{!data.schema_ready ? hints.AUTOMATIC_SCHEMA_PENDING : hints.AUTOMATIC_NOT_CONFIGURED} Privacy Mode tetap tersedia melalui <Link to="/documents">Document Center</Link>.</Notice>}
      <Panel title="Gmail connections" subtitle="Akses baca email membutuhkan persetujuan Google terpisah.">
        <button className="btn btn-primary" disabled={!ready || busy} onClick={() => act(async () => {
          const result = await api.post('/api/automatic/gmail/connect');
          const target = new URL(result.data.authorization_url);
          if (target.origin !== 'https://accounts.google.com' || target.pathname !== '/o/oauth2/v2/auth') throw new Error('Invalid OAuth destination');
          window.location.assign(target.href);
        })}>Connect Gmail</button>
        {data.connections.map(connection => <div className="connection-row" key={connection.id}><div><strong>{connection.email_address}</strong><p>{connection.is_active ? 'Terhubung' : 'Perlu reconnect'} · Sinkron terakhir: {date(connection.last_sync_at, true)}</p></div><button className="btn btn-secondary" disabled={busy} onClick={() => act(async () => {
          const result = await api.post(`/api/automatic/gmail/${connection.id}/disconnect`);
          setPreview(null); setNotice(result.data.revocation_confirmed ? 'Koneksi diputus; akun terkait kembali ke Privacy Mode.' : 'Akses lokal dihentikan. Pencabutan izin Google belum terkonfirmasi; hapus akses aplikasi melalui pengaturan akun Google.');
        })}>Disconnect</button></div>)}
        {!data.connections.length && <p className="panel-footnote">Belum ada Gmail yang terhubung. Anda dapat menghubungkan lebih dari satu Gmail.</p>}
      </Panel>
      <Panel title="Acquisition mode" subtitle="Privacy Mode menjeda sinkronisasi. Automatic Mode memproses lampiran pada server lokal.">
        <label className="check-label"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)}/> Saya menyetujui pengambilan email berlabel impor serta pemrosesan PDF di server lokal. Hasil tetap perlu saya tinjau.</label>
        {data.accounts.map(account => <div className="connection-row" key={account.id}><div><h3>{account.account_name}</h3><Badge>{account.acquisition_mode}</Badge><p>{account.sync_status} · {date(account.automatic_last_sync_at, true)}</p></div><div className="connection-action">
          <label>Gmail untuk {account.account_name}<select aria-label={`Gmail untuk ${account.account_name}`} value={choice(account)} onChange={event => setSelected({ ...selected, [account.id]: event.target.value })}><option value="">Pilih Gmail</option>{data.connections.filter(item => item.is_active).map(item => <option key={item.id} value={item.id}>{item.email_address}</option>)}</select></label>
          <button className="btn btn-secondary" disabled={busy || !ready || !consent || !choice(account)} onClick={() => act(async () => {
            await api.put(`/api/automatic/accounts/${account.id}/mode`, { mode: 'AUTOMATIC', connection_id: Number(choice(account)), consent: true }); setPreview(null); setNotice('Automatic Mode aktif. Sinkronisasi mengambil email berlabel dalam jendela 90 hari. Cakupan aktivitas belum dinyatakan lengkap.');
          })}>Aktifkan Automatic</button>
          <button className="btn btn-secondary" disabled={busy || !data.schema_ready || account.acquisition_mode === 'PRIVACY'} onClick={() => act(async () => {
            await api.put(`/api/automatic/accounts/${account.id}/mode`, { mode: 'PRIVACY' }); setPreview(null); setNotice('Sinkronisasi dijeda. Transaksi, snapshot, dan receipt tetap tersimpan.');
          })}>Privacy Mode</button>
          <button className="btn btn-primary" disabled={busy || !ready || account.acquisition_mode !== 'AUTOMATIC'} onClick={() => act(async () => {
            const result = await api.post(`/api/automatic/accounts/${account.id}/sync`); setNotice(`${result.data.status}: ${result.data.reviewed} dokumen masuk antrean, ${result.data.replayed} sudah diperiksa. Cakupan aktivitas UNKNOWN.`);
          })}>Sync now</button>
        </div></div>)}
        {!data.accounts.length && <EmptyState compact title="Belum ada investment account"><Link to="/documents">Buat akun di Document Center</Link></EmptyState>}
      </Panel>
      <Panel title="Review queue" subtitle="Pengirim belum dibuktikan autentik. Periksa sumber, akun, tanggal, dan seluruh nominal sebelum impor.">
        {reviews.map(item => <div className="connection-row" key={item.public_id}><div><strong>{data.accounts.find(account => account.id === item.investment_account_id)?.account_name ?? 'Investment account'}</strong><p>{item.status} · {date(item.created_at, true)}</p></div><button className="btn btn-secondary" disabled={busy || item.status === 'IMPORTED'} onClick={() => act(async () => { setPassword(''); setPreview({ ...(await api.get(`/api/automatic/reviews/${item.public_id}`)).data, id: item.public_id }); })}>Tinjau</button></div>)}
        {!reviews.length && <p className="panel-footnote">Belum ada hasil sinkronisasi. Parser email Stockbit dividend dan Pluang transaction menunggu sampel tersanitasi; status UNSUPPORTED_EMAIL membutuhkan penanganan manual.</p>}
      </Panel>
      {preview && <Panel title="Konfirmasi dokumen" subtitle={preview.status}>
        {['PASSWORD_REQUIRED', 'WRONG_PASSWORD', 'DECRYPTION_FAILED'].includes(preview.status) && <form onSubmit={event => { event.preventDefault(); act(async () => {
          const result = await api.post(`/api/automatic/reviews/${preview.id}/unlock`, { password });
          setPreview({ ...(await api.get(`/api/automatic/reviews/${preview.id}`)).data, id: preview.id }); setNotice(result.data.status);
        }); }}><Notice>Password PDF dikirim langsung ke server lokal untuk proses ini, tanpa disimpan. Gunakan Privacy Mode jika PDF dan password harus tetap di browser.</Notice><label>Password PDF<input autoComplete="off" type="password" maxLength={256} value={password} onChange={event => setPassword(event.target.value)}/></label><button className="btn btn-primary" disabled={busy || !password}>Buka lampiran</button></form>}
        {rows.length > 0 && <>
          <p>Tanggal sumber: {preview.payload.snapshot?.as_of_date ?? 'Lihat baris transaksi'} · {preview.payload.source.provider} · {preview.payload.source.document_type}</p>
          <Notice tone="warning">Unit UNKNOWN dan cakupan snapshot UNKNOWN tetap memerlukan review lanjutan. Impor tidak mengonfirmasi kelengkapan rekonsiliasi.</Notice>
          <TableRegion label="Pratinjau hasil email"><table className="data-table"><thead><tr><th>Aset</th><th>Tanggal / jenis</th><th>Quantity</th><th>Unit</th><th>Harga</th><th>Gross</th><th>Fee / Tax</th><th>Net / Nilai pasar</th><th>Basis</th></tr></thead><tbody>{rows.map((row, i) => <tr key={i}><td>{row.symbol}</td><td>{row.transaction_date ?? preview.payload.snapshot?.as_of_date} {row.type}</td><td>{row.quantity ?? 'UNKNOWN'}</td><td>{row.unit}</td><td>{row.price ?? row.average_price ?? 'UNKNOWN'}</td><td>{row.gross_amount ?? 'UNKNOWN'}</td><td>{row.fee_amount ?? 'UNKNOWN'} / {row.tax_amount ?? 'UNKNOWN'}</td><td>{row.net_amount ?? row.market_value ?? 'UNKNOWN'} {row.currency}</td><td>{row.amount_semantics ?? 'SNAPSHOT'}</td></tr>)}</tbody></table></TableRegion>
          <button className="btn btn-primary" disabled={busy || preview.status !== 'READY_FOR_REVIEW'} onClick={() => act(async () => {
            const result = await api.post(`/api/automatic/reviews/${preview.id}/confirm`, { confirmed: true }); setPreview(null); setNotice(`Receipt ${result.data.batch_id}. ${result.data.replayed ? 'Impor sudah pernah diproses.' : 'Data tersimpan; periksa status review pada portofolio/transaksi.'}`);
          })}>Konfirmasi & Import</button>
        </>}
        <button className="btn btn-secondary" onClick={() => { setPreview(null); setPassword(''); }}>Tutup</button>
      </Panel>}
    </>}
  </div>;
}
