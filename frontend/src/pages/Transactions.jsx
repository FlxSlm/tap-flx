import React, { useState, useEffect, useCallback } from 'react';
import axios from '../api/axios';
import './Transactions.css';
import { Badge, EmptyState, LoadingState, Notice } from '../ui/components';
import { number, date, safeError } from '../ui/format';

const TRANSACTION_TYPES = ['BUY', 'SELL', 'DEPOSIT', 'WITHDRAWAL', 'DIVIDEND', 'FEE'];

const emptyForm = {
  investment_account_id: '',
  transaction_date: '',
  type: 'BUY',
  symbol: '',
  asset_name: '',
  quantity: '',
  price: '',
  total_amount: '',
  currency: 'IDR',
  fee_amount: '',
};

const Transactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [accountStatus, setAccountStatus] = useState('loading');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 });
  const [filterAccountId, setFilterAccountId] = useState('');

  const fetchTransactions = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      let url = `/api/transactions?page=${page}`;
      if (filterAccountId) url += `&investment_account_id=${filterAccountId}`;
      const res = await axios.get(url);
      setTransactions(res.data.data);
      if (res.data.meta) {
        setPagination({ current_page: res.data.meta.current_page, last_page: res.data.meta.last_page });
      }
    } catch {
      setError('Failed to load transactions.');
    } finally {
      setLoading(false);
    }
  }, [filterAccountId]);

  const fetchAccounts = useCallback(async () => {
    setAccountStatus('loading');
    try {
      const res = await axios.get('/api/investment-accounts');
      setAccounts(res.data.data);
      setAccountStatus('ready');
    } catch {
      setAccountStatus('error');
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
    fetchTransactions();
  }, [fetchAccounts, fetchTransactions]);

  const clearMessages = () => { setError(''); setSuccess(''); };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const openCreateForm = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setFormErrors({});
    setShowForm(true);
    clearMessages();
  };

  const openEditForm = (tx) => {
    setEditingId(tx.id);
    setForm({
      investment_account_id: tx.investment_account_id,
      transaction_date: tx.transaction_date ? tx.transaction_date.slice(0, 16) : '',
      type: tx.type,
      symbol: tx.symbol || '',
      asset_name: tx.asset_name || '',
      quantity: tx.quantity ?? '',
      price: tx.price ?? '',
      total_amount: tx.total_amount ?? '',
      currency: tx.currency || 'IDR',
      fee_amount: tx.fee_amount ?? '',
    });
    setFormErrors({});
    setShowForm(true);
    clearMessages();
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormErrors({});
    clearMessages();

    const payload = {
      ...form,
      quantity: form.quantity === '' ? null : String(form.quantity),
      price: form.price === '' ? null : String(form.price),
      total_amount: form.total_amount === '' ? null : String(form.total_amount),
      fee_amount: form.fee_amount === '' ? null : String(form.fee_amount),
      asset_name: form.asset_name || null,
    };

    try {
      if (editingId) {
        await axios.put(`/api/transactions/${editingId}`, payload);
        setSuccess('Transaction updated successfully.');
      } else {
        await axios.post('/api/transactions', payload);
        setSuccess('Transaction created successfully.');
      }
      setShowForm(false);
      setEditingId(null);
      fetchTransactions(pagination.current_page);
    } catch (err) {
      if (err.response?.status === 422 && err.response?.data?.errors) {
        setFormErrors(err.response.data.errors);
      } else if (err.response?.status === 409) {
        setError('Duplicate transaction detected. This transaction already exists.');
      } else if (err.response?.status === 403) {
        setError('Unauthorized: you do not own this investment account.');
      } else {
        setError(safeError(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;
    clearMessages();
    try {
      await axios.delete(`/api/transactions/${id}`);
      setSuccess('Transaction deleted.');
      fetchTransactions(pagination.current_page);
    } catch {
      setError('Failed to delete transaction.');
    }
  };

  const getAccountLabel = (accountId) => {
    const acc = accounts.find(a => a.id === accountId);
    return acc ? `${acc.platform_name} — ${acc.account_name || acc.platform_code}` : `Account #${accountId}`;
  };

  const typeBadgeClass = (type) => {
    if (type === 'BUY') return 'badge badge-buy';
    if (type === 'SELL') return 'badge badge-sell';
    return 'badge badge-other';
  };

  const formatNumber = (val) => {
    if (val == null || val === '') return '-';
    return number(val);
  };

  const formatDate = (val) => {
    if (!val) return '-';
    return date(val);
  };

  return (
    <div className="transactions-page">
      <div className="page-header">
        <div><p className="eyebrow">CANONICAL TRANSACTION LEDGER</p><h1>Transactions</h1><p className="subtitle">Tinjau transaksi, dasar nominal, dan status datanya.</p></div>
        <div className="header-actions">
          <select aria-label="Filter akun transaksi" disabled={accountStatus !== 'ready'}
            value={filterAccountId}
            onChange={(e) => setFilterAccountId(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 14 }}
          >
            <option value="">All Accounts</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.platform_name} — {a.account_name || a.platform_code}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={openCreateForm}>+ New Transaction</button>
        </div>
      </div>

      {error && <div className="error-box" role="alert">{error}</div>}
      {accountStatus === 'error' && <Notice tone="warning">Daftar akun belum dapat dimuat. <button className="btn btn-secondary btn-sm" onClick={fetchAccounts}>Muat ulang akun</button></Notice>}
      {success && <div className="success-box" role="status">{success}</div>}

      {showForm && (
        <div className="tx-form">
          <h2>{editingId ? 'Edit Transaction' : 'New Transaction'}</h2>
          {Object.keys(formErrors).length > 0 && <div role="alert">{Object.values(formErrors).flat().join(' ')}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="tx-investment_account_id">Investment Account *</label>
                <select id="tx-investment_account_id" name="investment_account_id" value={form.investment_account_id} onChange={handleChange} required disabled={!!editingId}>
                  <option value="">Select account</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.platform_name} — {a.account_name || a.platform_code}</option>
                  ))}
                </select>
                {formErrors.investment_account_id && <span style={{ color: '#ef4444', fontSize: 12 }}>{formErrors.investment_account_id[0]}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="tx-type">Type *</label>
                <select id="tx-type" name="type" value={form.type} onChange={handleChange} required>
                  {TRANSACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="tx-transaction_date">Date *</label>
                <input type="datetime-local" id="tx-transaction_date" name="transaction_date" value={form.transaction_date} onChange={handleChange} required />
                {formErrors.transaction_date && <span style={{ color: '#ef4444', fontSize: 12 }}>{formErrors.transaction_date[0]}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="tx-symbol">Symbol *</label>
                <input type="text" id="tx-symbol" name="symbol" value={form.symbol} onChange={handleChange} placeholder="e.g. BBCA, BTC" required />
                {formErrors.symbol && <span style={{ color: '#ef4444', fontSize: 12 }}>{formErrors.symbol[0]}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="tx-asset_name">Asset Name</label>
                <input type="text" id="tx-asset_name" name="asset_name" value={form.asset_name} onChange={handleChange} placeholder="e.g. Bank BCA" />
              </div>
              <div className="form-group">
                <label htmlFor="tx-quantity">Quantity *</label>
                <input type="number" id="tx-quantity" name="quantity" value={form.quantity} onChange={handleChange} step="any" required={['BUY', 'SELL'].includes(form.type)} />
                {formErrors.quantity && <span style={{ color: '#ef4444', fontSize: 12 }}>{formErrors.quantity[0]}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="tx-price">Price *</label>
                <input type="number" id="tx-price" name="price" value={form.price} onChange={handleChange} step="any" required={['BUY', 'SELL'].includes(form.type)} />
                {formErrors.price && <span style={{ color: '#ef4444', fontSize: 12 }}>{formErrors.price[0]}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="tx-total_amount">Total Amount *</label>
                <input type="number" id="tx-total_amount" name="total_amount" value={form.total_amount} onChange={handleChange} step="any" required />
                {formErrors.total_amount && <span style={{ color: '#ef4444', fontSize: 12 }}>{formErrors.total_amount[0]}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="tx-currency">Currency *</label>
                <input type="text" id="tx-currency" name="currency" value={form.currency} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label htmlFor="tx-fee_amount">Fee</label>
                <input type="number" id="tx-fee_amount" name="fee_amount" value={form.fee_amount} onChange={handleChange} step="any" />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : (editingId ? 'Update' : 'Create')}
                </button>
                <button type="button" className="btn btn-secondary" onClick={cancelForm}>Cancel</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <LoadingState label="Loading transactions..."/>
      ) : error && transactions.length === 0 ? (
        <EmptyState title="Daftar transaksi belum tersedia" action={<button className="btn btn-secondary" onClick={() => fetchTransactions()}>Coba lagi</button>}>Kegagalan pemuatan tidak dianggap sebagai ledger kosong.</EmptyState>
      ) : transactions.length === 0 ? (
        <div className="status-box">No transactions found. Click "+ New Transaction" to add one.</div>
      ) : (
        <>
          <div className="tx-table-wrap" role="region" aria-label="Daftar transaksi" tabIndex={0}>
            <table className="tx-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Account</th>
                  <th>Type</th>
                  <th>Symbol</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th className="numeric">Total / basis</th>
                  <th>Currency</th><th>Data quality</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(tx => (
                  <tr key={tx.id}>
                    <td>{formatDate(tx.transaction_date)}</td>
                    <td>{getAccountLabel(tx.investment_account_id)}</td>
                    <td><span className={typeBadgeClass(tx.type)}>{tx.type}</span></td>
                    <td><strong>{tx.symbol}</strong></td>
                    <td className="numeric">{formatNumber(tx.quantity)}</td>
                    <td className="numeric">{formatNumber(tx.price)}</td>
                    <td className="numeric">{formatNumber(tx.total_amount)}<small className="cell-subline">{tx.amount_semantics ?? 'UNKNOWN'}</small></td>
                    <td>{tx.currency}</td><td><Badge status={tx.review_status ?? 'UNKNOWN'}/></td>
                    <td>
                      <div className="actions-cell">
                        <button className="btn btn-secondary btn-sm" onClick={() => openEditForm(tx)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(tx.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.last_page > 1 && (
            <div className="pagination">
              <button className="btn btn-secondary btn-sm" disabled={pagination.current_page <= 1} onClick={() => fetchTransactions(pagination.current_page - 1)}>← Prev</button>
              <span>Page {pagination.current_page} of {pagination.last_page}</span>
              <button className="btn btn-secondary btn-sm" disabled={pagination.current_page >= pagination.last_page} onClick={() => fetchTransactions(pagination.current_page + 1)}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Transactions;
