import React, { useState, useEffect } from 'react';
import axios from '../api/axios';
import { PdfExtractor } from '../lib/document-processing/PdfExtractor';
import { ProviderDetection } from '../lib/document-processing/ProviderDetection';
import StockbitParser from '../lib/document-processing/parsers/StockbitParser';
import PluangParser from '../lib/document-processing/parsers/PluangParser';
import BionsParser from '../lib/document-processing/parsers/BionsParser';
import { ValidationAndConfidence } from '../lib/document-processing/ValidationAndConfidence';
import './DocumentProcessing.css';

const DocumentProcessing = () => {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  
  const [file, setFile] = useState(null);
  const [processingState, setProcessingState] = useState('IDLE'); // IDLE, EXTRACTING, PARSING, DONE, ERROR
  const [errorMessage, setErrorMessage] = useState('');
  
  const [provider, setProvider] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [selectedRows, setSelectedRows] = useState(new Set());
  
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const res = await axios.get('/api/investment-accounts');
      setAccounts(res.data.data);
    } catch (err) {
      console.error('Failed to load accounts', err);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      resetState();
    }
  };

  const resetState = () => {
    setProcessingState('IDLE');
    setErrorMessage('');
    setProvider(null);
    setPreviewData([]);
    setSelectedRows(new Set());
    setImportResult(null);
  };

  const processDocument = async () => {
    if (!file) return;
    resetState();
    setProcessingState('EXTRACTING');
    
    try {
      const text = await PdfExtractor.extractTextFromFile(file);
      
      setProcessingState('PARSING');
      const detectedProvider = ProviderDetection.detect(text);
      if (!detectedProvider) {
        throw new Error('Unknown Provider: Cannot identify Stockbit, Pluang, or BIONS from document text.');
      }
      
      setProvider(detectedProvider);
      
      let parser = null;
      if (detectedProvider === 'Stockbit') parser = new StockbitParser();
      else if (detectedProvider === 'Pluang') parser = new PluangParser();
      else if (detectedProvider === 'BIONS') parser = new BionsParser();

      const parsedData = parser.parse(text);
      if (parsedData.length === 0) {
        throw new Error(`No transactions found matching the ${detectedProvider} format.`);
      }

      const normalized = parser.normalize(parsedData);
      
      const evaluated = normalized.map((tx, index) => {
        const evalResult = ValidationAndConfidence.evaluate(tx);
        return {
          id: index, // temporary id for table
          transaction: tx,
          score: evalResult.score,
          status: evalResult.status,
          errors: evalResult.errors,
          isHardValidationPass: evalResult.isHardValidationPass
        };
      });

      setPreviewData(evaluated);
      
      // Auto-select AUTO ACCEPT rows
      const defaultSelected = new Set();
      evaluated.forEach(row => {
        if (row.status === 'AUTO ACCEPT') {
          defaultSelected.add(row.id);
        }
      });
      setSelectedRows(defaultSelected);
      
      setProcessingState('DONE');

    } catch (err) {
      console.error(err);
      setProcessingState('ERROR');
      if (err.message === 'PasswordProtected') {
        setErrorMessage('PDF is password protected. Password-protected PDFs are not fully supported in this prototype yet.');
      } else {
        setErrorMessage(err.message || 'An error occurred during processing.');
      }
    }
  };

  const toggleRow = (id) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedRows(newSelected);
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
    
    // Add investment_account_id to each transaction payload
    const payload = rowsToImport.map(row => ({
      ...row.transaction,
      investment_account_id: selectedAccountId
    }));

    try {
      const res = await axios.post('/api/transactions/bulk', { transactions: payload });
      setImportResult({
        success: true,
        successfulCount: res.data.successful.length,
        failedCount: res.data.failed.length,
        failedDetails: res.data.failed
      });
    } catch (err) {
      setImportResult({
        success: false,
        message: err.response?.data?.message || 'Failed to import transactions.'
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
            value={selectedAccountId} 
            onChange={(e) => setSelectedAccountId(e.target.value)}
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
          <input type="file" accept="application/pdf" onChange={handleFileChange} className="input-field" />
        </div>

        <button 
          className="btn btn-primary mt-3" 
          onClick={processDocument} 
          disabled={!file || processingState === 'EXTRACTING' || processingState === 'PARSING'}
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
            <span className="provider-badge">Detected Provider: <strong>{provider}</strong></span>
          </div>

          <div className="table-responsive">
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
                  const tx = row.transaction;
                  return (
                    <tr key={row.id} className={!row.isHardValidationPass ? 'row-invalid' : ''}>
                      <td>
                        <input 
                          type="checkbox" 
                          checked={selectedRows.has(row.id)}
                          onChange={() => toggleRow(row.id)}
                          disabled={row.status === 'REJECT'}
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
                  <p><strong>Import Complete</strong></p>
                  <p>Successfully inserted: {importResult.successfulCount}</p>
                  <p>Failed / Duplicates: {importResult.failedCount}</p>
                  {importResult.failedDetails && importResult.failedDetails.length > 0 && (
                    <ul>
                      {importResult.failedDetails.map((f, i) => (
                        <li key={i}>{f.transaction.symbol} ({f.transaction.transaction_date}): {f.reason}</li>
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
