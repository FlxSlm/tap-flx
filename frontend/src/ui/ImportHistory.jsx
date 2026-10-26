import React, { useState } from 'react';
import axios from '../api/axios';
import { Badge, EmptyState, Notice, Panel } from './components';
import { date } from './format';
import { useOptionalWorkspace } from './workspace';

export default function ImportHistory() {
  const workspace = useOptionalWorkspace();
  const entries = workspace?.imports ?? [];
  const [batchId, setBatchId] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const load = async id => {
    setError(''); setReceipt(null);
    if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id)) {
      setError('Masukkan ID batch impor yang valid.'); return;
    }
    setPending(true);
    try { const response = await axios.get(`/api/source-imports/${encodeURIComponent(id)}`); setReceipt(response.data); }
    catch { setError('Riwayat ini tidak dapat dimuat. Periksa ID batch dan akses akun Anda.'); }
    finally { setPending(false); }
  };
  return <Panel title="Source & import history" subtitle="Riwayat sesi dan penelusuran bukti impor">
    {entries.length ? <ul className="import-session-list">{entries.map(entry => <li key={entry.batchId}><div><strong>{entry.provider} · {entry.documentType}</strong><small>Dikonfirmasi pada sesi ini · {date(entry.recordedAt, true)}</small><small className="batch-reference">ID batch: <code>{entry.batchId}</code></small></div><button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => { setBatchId(entry.batchId); load(entry.batchId); }}>Lihat detail</button></li>)}</ul> : <EmptyState compact icon="document" title="Belum ada impor di sesi ini">Daftar sesi bukan riwayat lengkap akun. Gunakan ID batch untuk menelusuri impor yang sudah tersimpan.</EmptyState>}
    <div className="receipt-lookup"><form onSubmit={event => { event.preventDefault(); load(batchId.trim()); }}><label className="form-group" htmlFor="receipt-batch-id">ID batch impor<input id="receipt-batch-id" value={batchId} onChange={event => setBatchId(event.target.value)} placeholder="ID dari konfirmasi impor" disabled={pending || !!workspace?.preview} autoComplete="off"/></label><button type="submit" className="btn btn-secondary" disabled={pending || !!workspace?.preview}>{pending ? 'Memuat…' : 'Telusuri impor'}</button></form>{error && <Notice tone="danger" role="alert">{error}</Notice>}{receipt && <div className="receipt-result" role="status"><h3>{receipt.source.provider} · {receipt.source.document_type}</h3><p className="receipt-meta">Diimpor {date(receipt.source.imported_at, true)} · {receipt.source.parser_version}</p><ul>{receipt.current_observations.map(observation => <li key={observation.id}><span>{observation.kind} · {observation.row_key}<small className="cell-subline">Integritas: {observation.status} / Validasi: {observation.validation_status} · Confidence client: {observation.confidence == null ? 'belum tersedia' : `${observation.confidence}/100`}</small></span><Badge status={observation.review_status}/></li>)}</ul><p className="receipt-meta">Status bukti terkini dapat berbeda dari receipt konfirmasi awal. Confidence client bukan jaminan kelengkapan sumber.</p></div>}</div>
  </Panel>;
}
