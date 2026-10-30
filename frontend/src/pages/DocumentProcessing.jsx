import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from '../api/axios';
import { PdfExtractor } from '../lib/document-processing/PdfExtractor';
import { parseDocument } from '../lib/document-processing/DocumentPipeline';

import { buildSourceImport } from '../lib/document-processing/SourceContract';
import './DocumentProcessing.css';
import Icon from '../ui/Icon';
import { Badge, Notice } from '../ui/components';
import ImportHistory from '../ui/ImportHistory';
import { useOptionalWorkspace } from '../ui/workspace';
import { number, safeError } from '../ui/format';
import InvestmentAccountForm from '../ui/InvestmentAccountForm';

const DocumentProcessing = () => {
  const workspace = useOptionalWorkspace();
  const previewOnly = !!workspace?.preview;
  const previewAccounts = workspace?.preview?.accounts;
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [accountStatus, setAccountStatus] = useState('loading');
  const [accountError, setAccountError] = useState('');
  const [accountMessage, setAccountMessage] = useState('');
  const accountSequence = useRef(0);

  const [file, setFile] = useState(null);
  const [documentHash, setDocumentHash] = useState(null);
  const [batchKey, setBatchKey] = useState(null);
  const [processingState, setProcessingState] = useState('IDLE'); // IDLE, EXTRACTING, PARSING, DONE, ERROR
  const [errorMessage, setErrorMessage] = useState('');

  const [detectedProvider, setDetectedProvider] = useState(null); // { provider, type }
  const [previewData, setPreviewData] = useState([]);
  const [selectedRows, setSelectedRows] = useState(new Set());

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const passwordInput = useRef(null);
  const bindPasswordInput = useCallback(node => {
    if (!node && passwordInput.current) passwordInput.current.value = '';
    passwordInput.current = node;
  }, []);
  const extraction = useRef({ sequence: 0, controller: null });
  const importBusy = useRef(false);
  const batchKeyRef = useRef(null);
  const selectedAccount = accounts.find(account => String(account.id) === selectedAccountId);
  const processing = ['EXTRACTING', 'PARSING'].includes(processingState);
  const providerMismatch = detectedProvider && selectedAccount && selectedAccount.platform_code?.toUpperCase() !== detectedProvider.provider;
  const importDisabledReason = previewOnly ? 'Preview demo tidak melakukan impor.' : accountStatus === 'loading' ? 'Investment accounts sedang dimuat.' : accountStatus === 'error' ? 'Daftar akun gagal dimuat. Coba muat ulang akun.' : !accounts.length ? 'Create an investment account to continue.' : !selectedAccount ? 'Please select an investment account before importing.' : providerMismatch ? `PDF ${detectedProvider.provider} hanya dapat diimpor ke akun ${detectedProvider.provider}. Pilih akun dengan provider yang sesuai.` : processingState !== 'DONE' ? 'Process PDF dan tinjau hasil sebelum mengimpor.' : !selectedRows.size ? 'Pilih minimal satu baris yang valid untuk diimpor.' : '';

  const loadAccounts = useCallback(async () => {
    const sequence = ++accountSequence.current;
    try {
      const response = await (previewAccounts ? Promise.resolve({ data: { data: previewAccounts } }) : axios.get('/api/investment-accounts'));
      if (sequence !== accountSequence.current) return;
      if (!Array.isArray(response.data.data)) throw new Error('Invalid account response');
      setAccounts(response.data.data); setAccountStatus('ready');
    } catch (error) {
      if (sequence === accountSequence.current) {
        setAccountStatus('error');
        setAccountError(safeError(error, error.code === 'API_ORIGIN_BLOCKED' ? 'Origin API tidak diizinkan. Gunakan alamat lokal yang sesuai.' : 'Daftar akun gagal dimuat. Periksa koneksi API lokal lalu coba kembali.'));
      }
    }
  }, [previewAccounts]);
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled) void loadAccounts(); });
    return () => { cancelled = true; accountSequence.current += 1; };
  }, [loadAccounts]);
  const clearPassword = () => { if (passwordInput.current) passwordInput.current.value = ''; setShowPassword(false); };
  useEffect(() => () => {
    extraction.current.sequence += 1; extraction.current.controller?.abort();
    if (passwordInput.current) passwordInput.current.value = '';
  }, []);
  const createdAccount = (account, existing) => {
    accountSequence.current += 1;
    setAccounts(previous => [...previous.filter(item => item.id !== account.id), account]);
    setAccountStatus('ready'); setSelectedAccountId(String(account.id));
    setAccountMessage(existing ? 'Akun dengan label ini sudah ada dan telah dipilih.' : 'Investment Account dibuat dan langsung dipilih.');
    setImportResult(null); setBatchKey(null); batchKeyRef.current = null;
    workspace?.accounts.retry();
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      extraction.current.sequence += 1; extraction.current.controller?.abort(); clearPassword();
      setFile(e.target.files[0]);
      resetState();
    }
  };

  const resetState = () => {
    setProcessingState('IDLE');
    setDocumentHash(null);
    setBatchKey(null);
    batchKeyRef.current = null;
    setErrorMessage('');
    setDetectedProvider(null);
    setPreviewData([]);
    setSelectedRows(new Set());
    setImportResult(null);
  };

  const processDocument = async (password) => {
    if (!file) return;
    const sequence = ++extraction.current.sequence;
    extraction.current.controller?.abort();
    const controller = new AbortController(); extraction.current.controller = controller;
    clearPassword();
    resetState();
    setProcessingState('EXTRACTING');

    try {
      const resultPromise = PdfExtractor.extractDocument(file, { ...(typeof password === 'string' ? { password } : {}), signal: controller.signal });
      password = null;
      const { text, documentHash: hash } = await resultPromise;
      if (sequence !== extraction.current.sequence) return;
      setDocumentHash(hash);

      setProcessingState('PARSING');
      const { detection, previewData: evaluated } = parseDocument(text);
      setDetectedProvider(detection);

      setPreviewData(evaluated);

      // Auto-select AUTO ACCEPT rows (for transactions) or Snapshot (for snapshots, usually we just import all)
      const defaultSelected = new Set();
      evaluated.forEach(row => {
        if (row.status === 'AUTO ACCEPT') {
          defaultSelected.add(row.id);
        }
      });
      setSelectedRows(defaultSelected);

      setProcessingState('DONE');

    } catch (err) {
      if (sequence !== extraction.current.sequence) return;
      const code = err.code;
      setProcessingState(['PASSWORD_REQUIRED', 'INCORRECT_PASSWORD'].includes(code) ? 'PASSWORD' : code === 'CANCELLED' ? 'IDLE' : 'ERROR');
      setErrorMessage(({ PASSWORD_REQUIRED: 'PDF memerlukan password. Password hanya dipakai di browser.', INCORRECT_PASSWORD: 'Password salah. Coba kembali tanpa memilih file ulang.', UNSUPPORTED_ENCRYPTION: 'Metode enkripsi PDF belum didukung. Gunakan salinan yang disiapkan secara lokal.', CORRUPT_PDF: 'PDF rusak atau bukan PDF yang valid.', UNKNOWN_PROVIDER: 'Provider dokumen belum dikenali. Gunakan sumber yang didukung.', UNSUPPORTED_DOCUMENT: 'Jenis dokumen belum didukung untuk provider ini.', NO_MATCHING_ROWS: 'Dokumen dikenali tetapi baris yang didukung belum terbaca. Periksa layout atau apakah PDF berupa hasil scan.', SOURCE_FORMAT_INVALID: 'Format angka atau tabel sumber tidak sesuai kontrak. Tinjau dokumen sebelum impor.', CANCELLED: '' })[code] ?? 'Document processing failed. Check the format and supported source.');
    } finally {
      password = null;
    }
  };
  const cancelProcessing = () => {
    extraction.current.sequence += 1; extraction.current.controller?.abort(); clearPassword(); resetState();
  };

  const toggleRow = (id) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedRows(newSelected);
    setBatchKey(null);
    batchKeyRef.current = null;
    setImportResult(null);
  };

  const handleImport = async () => {
    if (importDisabledReason || importBusy.current) return;

    const rowsToImport = previewData.filter(row => selectedRows.has(row.id));
    if (rowsToImport.length === 0) return;

    importBusy.current = true; setImporting(true);
    setImportResult(null);

    try {
      const account = accounts.find(a => String(a.id) === String(selectedAccountId));
      if (account?.platform_code?.toUpperCase() !== detectedProvider.provider) {
        throw new Error('Selected account does not match the document provider.');
      }
      const key = batchKeyRef.current ?? batchKey ?? crypto.randomUUID();
      batchKeyRef.current = key;
      setBatchKey(key);
      const payload = buildSourceImport({ accountId: selectedAccountId, detection: detectedProvider, documentHash, batchKey: key, previewData, selectedRows });
      const res = await axios.post('/api/source-imports', payload);
      const results = res.data.results;
      if (res.data.batch_id) workspace?.recordImport({ batchId: res.data.batch_id, provider: detectedProvider.provider, documentType: detectedProvider.type, results, recordedAt: new Date().toISOString() });
      setImportResult({
        success: true,
        batchId: res.data.batch_id,
        successfulCount: results.filter(r => ['CREATED', 'LINKED_EXISTING', 'REPLAYED'].includes(r.status)).length,
        failedCount: results.filter(r => r.review_status === 'REQUIRED' || ['PENDING_REVIEW', 'SOURCE_CONFLICT'].includes(r.status)).length,
        failedDetails: results.filter(r => r.review_status === 'REQUIRED' || ['PENDING_REVIEW', 'SOURCE_CONFLICT'].includes(r.status)).map(r => ({ reason: r.review_status === 'REQUIRED' ? 'REQUIRED — tinjau unit, coverage dan sumber' : r.status })),
        replayed: res.data.replayed,
        accountId: selectedAccountId,
        asOf: detectedProvider.type === 'SOA' ? rowsToImport[0].data.as_of_date : null,
      });
    } catch (err) {
      setImportResult({
        success: false,
        message: safeError(err, 'Impor belum dapat disimpan. Hasil pemeriksaan tetap tersedia di browser; silakan coba lagi.')
      });
    } finally {
      importBusy.current = false; setImporting(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    if (status === 'AUTO ACCEPT') return 'badge badge-success';
    if (status === 'REVIEW') return 'badge badge-warning';
    return 'badge badge-danger';
  };

  const viewNumber = (data, key) => number(data.exact_values && Object.hasOwn(data.exact_values, key) ? data.exact_values[key] : data[key]);

  const renderTransactionTable = () => (
    <table className="tx-table mt-3">
      <thead>
        <tr>
          <th>Import</th>
          <th>Status</th>
          <th>Score</th>
          <th>Date</th>
          <th>Type</th>
          <th>Symbol</th>
          <th>Unit terverifikasi</th>
          <th>Qty</th>
          <th>Price</th>
          <th>Total</th>
          <th>Issues</th>
        </tr>
      </thead>
      <tbody>
        {previewData.map(row => {
          const tx = row.data;
          return (
            <tr key={row.id} className={!row.isHardValidationPass ? 'row-invalid' : ''}>
              <td>
                <input
                  type="checkbox" aria-label={`Impor baris ${row.id + 1}`}
                  checked={selectedRows.has(row.id)}
                  onChange={() => toggleRow(row.id)}
                  disabled={row.status === 'REJECT' || importing}
                />
              </td>
              <td><span className={getStatusBadgeClass(row.status)}>{row.status}</span></td>
              <td><strong>{row.score}/100</strong></td>
              <td>{tx.transaction_date}</td>
              <td>{tx.type}</td>
              <td>{tx.symbol}</td>
              <td>{['BUY', 'SELL'].includes(tx.type) ? <select aria-label={`Unit baris ${row.id + 1}`} value={tx.unit ?? 'UNKNOWN'} disabled={importing || row.status === 'REJECT'} onChange={event => {
                const unit = event.target.value;
                setPreviewData(previous => previous.map(item => item.id === row.id ? { ...item, data: { ...item.data, unit } } : item));
                setBatchKey(null); batchKeyRef.current = null; setImportResult(null);
              }}><option value="UNKNOWN">UNKNOWN — belum diverifikasi</option><option value="SHARE">SHARE</option><option value="LOT">LOT</option></select> : 'Tidak mengubah posisi'}</td>
              <td className="numeric">{viewNumber(tx, 'quantity')}{tx.reference_quantity != null && <small className="cell-subline">Referensi: {number(tx.reference_quantity)}</small>}</td>
              <td className="numeric">{viewNumber(tx, 'price')}</td>
              <td className="numeric">{viewNumber(tx, 'total_amount')}<small className="cell-subline">{tx.currency} · {tx.amount_semantics ?? 'UNKNOWN'}</small></td>
              <td>
                {row.errors.length > 0 ? (
                  <ul className="error-list">
                    {row.errors.map((e, idx) => <li key={idx}>{e}</li>)}
                  </ul>
                ) : (
                  <span className="text-muted">None</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  const renderSnapshotTable = () => (
    <table className="tx-table mt-3">
      <thead>
        <tr>
          <th>Import</th>
          <th>Status</th>
          <th>Score</th>
          <th>As Of Date</th>
          <th>Symbol</th>
          <th>Qty</th>
          <th>Avg Price</th>
          <th>Market Value</th>
          <th>Issues</th>
        </tr>
      </thead>
      <tbody>
        {previewData.map(row => {
          const item = row.data;
          return (
            <tr key={row.id} className={!row.isHardValidationPass ? 'row-invalid' : ''}>
              <td>
                <input
                  type="checkbox" aria-label={`Impor baris ${row.id + 1}`}
                  checked={selectedRows.has(row.id)}
                  onChange={() => toggleRow(row.id)}
                  disabled={row.status === 'REJECT' || importing}
                />
              </td>
              <td><span className={getStatusBadgeClass(row.status)}>{row.status}</span></td>
              <td><strong>{row.score}/100</strong></td>
              <td>{item.as_of_date}</td>
              <td>{item.symbol}</td>
              <td className="numeric">{viewNumber(item, 'quantity')}</td>
              <td className="numeric">{viewNumber(item, 'average_price')}</td>
              <td className="numeric">{viewNumber(item, 'market_value')}</td>
              <td>
                {row.errors.length > 0 ? (
                  <ul className="error-list">
                    {row.errors.map((e, idx) => <li key={idx}>{e}</li>)}
                  </ul>
                ) : (
                  <span className="text-muted">None</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <div className="document-processing-page">
      <div className="page-header">
        <div><p className="eyebrow">LOCAL PROCESSING · TRACEABLE IMPORTS</p><h1>Document Center</h1>
        <p className="subtitle">Periksa dokumen, tinjau data, lalu konfirmasikan impor. File PDF tetap di perangkat Anda.</p></div><Badge tone="info"><Icon name="shield" size={12}/>Privacy Mode</Badge>
      </div>

      <div className="document-intro"><div className="document-pattern"><Icon name="transactions"/><div><strong>Transaction-Based Update</strong><p>Mulai dari snapshot awal, lalu tambahkan Trade Confirmation atau Cash Dividend.</p></div></div><div className="document-pattern"><Icon name="document"/><div><strong>Monthly Statement-Based Update</strong><p>Perbarui posisi dari laporan bulanan. Aktivitas yang tidak tersedia tetap UNKNOWN.</p></div></div></div>
      <div className="document-step-status" role="status" aria-live="polite"><strong>{processingState === 'IDLE' ? '01 · Pilih / buat akun dan dokumen' : processingState === 'PASSWORD' ? '02 · Unlock PDF secara lokal' : processingState === 'EXTRACTING' ? '03 · Ekstraksi lokal' : processingState === 'PARSING' ? '03 · Validasi data' : processingState === 'DONE' ? '04 · Tinjau & konfirmasi' : 'Pemeriksaan memerlukan perhatian'}</strong><span>PDF lokal → data terstruktur → konfirmasi Anda</span></div>
      {accountMessage && <Notice tone="success">{accountMessage}</Notice>}
      <div className="card processing-controls">
        <div className="form-group">
          <label htmlFor="document-account">1. Select Investment Account *</label>
          <select id="document-account"
            disabled={previewOnly || importing || processing || accountStatus !== 'ready'}
            value={selectedAccountId}
            onChange={(e) => { setSelectedAccountId(e.target.value); setBatchKey(null); batchKeyRef.current = null; setImportResult(null); }}
            className="input-field"
          >
            <option value="">-- Choose Account --</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.platform_name} — {a.account_name}</option>
            ))}
          </select>
        </div>
        {accountStatus === 'loading' && <p role="status">Investment accounts sedang dimuat...</p>}
        {accountStatus === 'error' && <Notice tone="danger" role="alert">{accountError} <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setAccountStatus('loading'); loadAccounts(); }} disabled={importing || processing}>Muat ulang akun</button><a className="text-link" href="/login">Masuk kembali</a></Notice>}
        {accountStatus === 'ready' && !accounts.length && <Notice>Create an investment account to continue.</Notice>}
        {!previewOnly && <InvestmentAccountForm onCreated={createdAccount} disabled={importing || processing || accountStatus !== 'ready'}/>}

        <div className="form-group mt-3">
          <label htmlFor="document-file">2. Select Local Document (PDF)</label>
          <input id="document-file" type="file" accept="application/pdf" disabled={previewOnly || importing || processing} onChange={handleFileChange} className="input-field" />
        </div>

        <button
          className="btn btn-primary mt-3"
          onClick={() => processDocument()}
          disabled={previewOnly || !file || importing || processing || processingState === 'PASSWORD'}
        >
          {processingState === 'EXTRACTING' ? 'Extracting Text...' :
           processingState === 'PARSING' ? 'Parsing Data...' : 'Process Document'}
        </button>
        {(processing || processingState === 'PASSWORD') && <button type="button" className="btn btn-secondary" onClick={cancelProcessing}>Cancel processing</button>}
        {processingState === 'PASSWORD' && <form className="pdf-password-form" aria-label="Unlock PDF lokal" onSubmit={event => { event.preventDefault(); let secret = passwordInput.current?.value; if (!secret) return; clearPassword(); const attempt = processDocument(secret); secret = null; void attempt; }}>
          <Notice tone="warning">{errorMessage}</Notice>
          <label className="form-group" htmlFor="local-pdf-password">Password PDF<input id="local-pdf-password" ref={bindPasswordInput} type={showPassword ? 'text' : 'password'} autoComplete="off" required spellCheck={false}/></label>
          <div className="reconciliation-actions"><button type="button" className="btn btn-secondary" aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? 'Hide Password' : 'Show Password'}</button><button className="btn btn-primary">Unlock & Process</button></div>
          <p>Password tidak dikirim atau disimpan. Input dikosongkan setiap percobaan; file dapat digunakan kembali untuk retry.</p>
        </form>}
        {importDisabledReason && <p id="document-import-reason" role="status">{importDisabledReason}</p>}
      </div>

      {processingState === 'ERROR' && (
        <div className="error-box mt-3" role="alert">
          <strong>Error: </strong> {errorMessage}
        </div>
      )}

      {processingState === 'DONE' && (
        <div className="results-container mt-4">
          <div className="results-header">
            <h3>Processing Result</h3>
            <span className="provider-badge">
              Detected: <strong>{detectedProvider.provider} {detectedProvider.type}</strong>
            </span>
          </div>

          <p>Snapshot coverage remains UNKNOWN; selecting only some positions marks it PARTIAL. Missing amounts remain unavailable. Validation and confidence scores are client checks, not proof of complete activity. Verifikasi unit BUY/SELL dari sumber sebelum impor; UNKNOWN tidak akan dihitung sebagai holdings. LOT dan SHARE tidak dikonversi otomatis.</p>
          <div className="table-responsive" role="region" aria-label="Pratinjau data dokumen" tabIndex={0}>
            {detectedProvider.type === 'SOA' ? renderSnapshotTable() : renderTransactionTable()}
          </div>

          <div className="import-actions mt-4">
            <button
              className="btn btn-success"
              onClick={handleImport}
              disabled={!!importDisabledReason || importing}
              aria-describedby="document-import-reason"
            >
              {importing ? 'Importing...' : `Import Selected (${selectedRows.size})`}
            </button>
          </div>

          {importResult && (
            <div className={`mt-3 ${importResult.success ? 'success-box' : 'error-box'}`}>
              {importResult.success ? (
                <>
                  <p><strong>{importResult.replayed ? 'Import already recorded' : 'Import processed'}</strong></p>
                  {importResult.batchId && <p className="batch-reference">ID batch: <code>{importResult.batchId}</code></p>}
                  {importResult.asOf && <p><a className="btn btn-primary" href={`/portfolio?account=${encodeURIComponent(importResult.accountId)}&as_of=${encodeURIComponent(importResult.asOf)}`}>View in My Portfolio</a></p>}
                  <p>Created / linked / replayed observations: {importResult.successfulCount}</p>
                  <p>Needs review / conflicting observations: {importResult.failedCount}</p>
                  {importResult.failedDetails && importResult.failedDetails.length > 0 && (
                    <ul>
                      {importResult.failedDetails.map((f, i) => (
                        <li key={i}>{f.reason}</li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <p>{importResult.message}</p>
              )}
            </div>
          )}
        </div>
      )}
      <ImportHistory/>
    </div>
  );
};

export default DocumentProcessing;
