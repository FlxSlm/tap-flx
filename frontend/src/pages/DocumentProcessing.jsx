import React, { useState, useEffect } from 'react';
import axios from '../api/axios';
import { PdfExtractor } from '../lib/document-processing/PdfExtractor';
import { ProviderDetection } from '../lib/document-processing/ProviderDetection';
import { ValidationAndConfidence } from '../lib/document-processing/ValidationAndConfidence';

import { sourceParser, buildSourceImport } from '../lib/document-processing/SourceContract';
import './DocumentProcessing.css';

const DocumentProcessing = () => {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  
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

  useEffect(() => {
    let active = true;
    axios.get('/api/investment-accounts').then(res => {
      if (active) setAccounts(res.data.data);
    }).catch(() => {
      if (active) setErrorMessage('Failed to load investment accounts.');
    });
    return () => { active = false; };
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      resetState();
    }
  };

  const resetState = () => {
    setProcessingState('IDLE');
    setDocumentHash(null);
    setBatchKey(null);
    setErrorMessage('');
    setDetectedProvider(null);
    setPreviewData([]);
    setSelectedRows(new Set());
    setImportResult(null);
  };

  const processDocument = async () => {
    if (!file) return;
    resetState();
    setProcessingState('EXTRACTING');
    
    try {
      const { text, documentHash: hash } = await PdfExtractor.extractDocument(file);
      setDocumentHash(hash);
      
      setProcessingState('PARSING');
      const detection = ProviderDetection.detect(text);
      if (detection.provider === 'UNKNOWN') {
        throw new Error('Unknown Provider: Cannot identify the document from text.');
      }
      
      setDetectedProvider(detection);
      
      const { parser } = sourceParser(detection.provider, detection.type);
      const profile = detection.type === 'SOA' ? 'snapshot' : 'transaction';

      const parsedData = parser.parse(text);
      if (parsedData.length === 0) {
        throw new Error(`No data found matching the ${detection.provider} ${detection.type} format.`);
      }

      const normalized = parser.normalize(parsedData);
      
      const evaluated = normalized.map((item, index) => {
        const evalResult = ValidationAndConfidence.evaluate(item, profile);
        return {
          id: index,
          data: item,
          score: evalResult.score,
          status: evalResult.status,
          errors: evalResult.errors,
          isHardValidationPass: evalResult.isHardValidationPass
        };
      });

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
      setProcessingState('ERROR');
      if (err.message === 'PasswordProtected') {
        setErrorMessage('PDF is password protected. Password-protected PDFs are not fully supported in this prototype yet.');
      } else {
        setErrorMessage('Document processing failed. Check the format and supported source.');
      }
    }
  };

  const toggleRow = (id) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedRows(newSelected);
    setBatchKey(null);
    setImportResult(null);
  };

  const handleImport = async () => {
    if (!selectedAccountId) {
      alert('Please select an Investment Account to import into.');
      return;
    }
    
    const rowsToImport = previewData.filter(row => selectedRows.has(row.id));
    if (rowsToImport.length === 0) return;

    setImporting(true);
    setImportResult(null);

    try {
      const account = accounts.find(a => String(a.id) === String(selectedAccountId));
      if (account?.platform_code?.toUpperCase() !== detectedProvider.provider) {
        throw new Error('Selected account does not match the document provider.');
      }
      const key = batchKey ?? crypto.randomUUID();
      setBatchKey(key);
      const payload = buildSourceImport({ accountId: selectedAccountId, detection: detectedProvider, documentHash, batchKey: key, previewData, selectedRows });
      const res = await axios.post('/api/source-imports', payload);
      const results = res.data.results;
      setImportResult({
        success: true,
        successfulCount: results.filter(r => ['CREATED', 'LINKED_EXISTING', 'REPLAYED'].includes(r.status)).length,
        failedCount: results.filter(r => ['PENDING_REVIEW', 'SOURCE_CONFLICT'].includes(r.status)).length,
        failedDetails: results.filter(r => ['PENDING_REVIEW', 'SOURCE_CONFLICT'].includes(r.status)).map(r => ({ reason: r.status })),
        replayed: res.data.replayed,
      });
    } catch (err) {
      setImportResult({
        success: false,
        message: err.response?.data?.message || err.message || 'Failed to import data.'
      });
    } finally {
      setImporting(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    if (status === 'AUTO ACCEPT') return 'badge badge-success';
    if (status === 'REVIEW') return 'badge badge-warning';
    return 'badge badge-danger';
  };

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
                  type="checkbox" 
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
              <td>{tx.quantity}</td>
              <td>{tx.price}</td>
              <td>{tx.total_amount}</td>
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
                  type="checkbox" 
                  checked={selectedRows.has(row.id)}
                  onChange={() => toggleRow(row.id)}
                  disabled={row.status === 'REJECT' || importing}
                />
              </td>
              <td><span className={getStatusBadgeClass(row.status)}>{row.status}</span></td>
              <td><strong>{row.score}/100</strong></td>
              <td>{item.as_of_date}</td>
              <td>{item.symbol}</td>
              <td>{item.quantity}</td>
              <td>{item.average_price}</td>
              <td>{item.market_value}</td>
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
        <h1>Document Processing (Privacy Mode)</h1>
        <p className="subtitle">Process PDF statements locally in your browser. Raw PDFs are never sent to the server.</p>
      </div>

      <div className="card processing-controls">
        <div className="form-group">
          <label>1. Select Investment Account *</label>
          <select 
            disabled={importing || processingState === 'EXTRACTING' || processingState === 'PARSING'}
            value={selectedAccountId} 
            onChange={(e) => { setSelectedAccountId(e.target.value); setBatchKey(null); setImportResult(null); }}
            className="input-field"
          >
            <option value="">-- Choose Account --</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.platform_name} — {a.account_name}</option>
            ))}
          </select>
        </div>
        
        <div className="form-group mt-3">
          <label>2. Upload Document (PDF)</label>
          <input type="file" accept="application/pdf" disabled={importing || processingState === 'EXTRACTING' || processingState === 'PARSING'} onChange={handleFileChange} className="input-field" />
        </div>

        <button 
          className="btn btn-primary mt-3" 
          onClick={processDocument} 
          disabled={!file || importing || processingState === 'EXTRACTING' || processingState === 'PARSING'}
        >
          {processingState === 'EXTRACTING' ? 'Extracting Text...' : 
           processingState === 'PARSING' ? 'Parsing Data...' : 'Process Document'}
        </button>
      </div>

      {processingState === 'ERROR' && (
        <div className="error-box mt-3">
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

          <p>Snapshot coverage remains UNKNOWN; selecting only some positions marks it PARTIAL. Missing amounts remain unavailable.</p>
          <div className="table-responsive">
            {detectedProvider.type === 'SOA' ? renderSnapshotTable() : renderTransactionTable()}
          </div>

          <div className="import-actions mt-4">
            <button 
              className="btn btn-success" 
              onClick={handleImport} 
              disabled={selectedRows.size === 0 || importing || !selectedAccountId}
            >
              {importing ? 'Importing...' : `Import Selected (${selectedRows.size})`}
            </button>
          </div>

          {importResult && (
            <div className={`mt-3 ${importResult.success ? 'success-box' : 'error-box'}`}>
              {importResult.success ? (
                <>
                  <p><strong>{importResult.replayed ? 'Import already recorded' : 'Import processed'}</strong></p>
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
    </div>
  );
};

export default DocumentProcessing;
