import React, { useRef, useState } from 'react';
import axios from '../api/axios';
import { Notice } from './components';
import { safeError } from './format';

export default function InvestmentAccountForm({ onCreated, disabled = false }) {
  const [provider, setProvider] = useState('stockbit');
  const [label, setLabel] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const submit = async event => {
    event.preventDefault();
    if (disabled || busy.current) return;
    busy.current = true; setPending(true); setError('');
    try {
      const response = await axios.post('/api/investment-accounts', { provider, account_name: label.trim() });
      onCreated(response.data.data, response.data.already_exists);
      setLabel('');
    } catch (err) {
      setError(err.response?.status === 422 ? 'Pilih provider dan isi label 1–80 karakter dengan huruf. Hindari markup, baris baru, serta nomor rekening atau identitas finansial.' : safeError(err, 'Akun belum dapat dibuat. Periksa koneksi lalu coba kembali.'));
    } finally { busy.current = false; setPending(false); }
  };
  return <form className="account-onboarding" aria-label="Create Investment Account" onSubmit={submit}>
    <h3>Create Investment Account</h3>
    <p>Gunakan label pilihan Anda. Tidak memerlukan nomor rekening, RDN, SID, atau email broker.</p>
    {error && <Notice tone="danger" role="alert">{error}</Notice>}
    <div className="baseline-controls"><label className="form-group" htmlFor="new-account-provider">Provider akun baru<select id="new-account-provider" value={provider} onChange={event => setProvider(event.target.value)} disabled={disabled || pending}><option value="stockbit">Stockbit</option><option value="bions">BIONS</option><option value="pluang">Pluang</option></select></label><label className="form-group" htmlFor="new-account-label">Label akun<input id="new-account-label" value={label} onChange={event => setLabel(event.target.value)} maxLength={80} required autoComplete="off" placeholder="Contoh: Portofolio pribadi" disabled={disabled || pending}/></label></div>
    <button className="btn btn-secondary" disabled={disabled || pending || !label.trim()}>{pending ? 'Membuat akun...' : 'Create Investment Account'}</button>
  </form>;
}
