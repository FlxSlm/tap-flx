import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AppShell from '../ui/AppShell';
import { WorkspaceProvider } from '../ui/WorkspaceContext';
import Dashboard from '../pages/Dashboard';
import Reconciliation from '../pages/Reconciliation';
import DocumentProcessing from '../pages/DocumentProcessing';
import { Analytics, Connections, Portfolio, Settings } from '../pages/WorkspacePages';
import { Badge, PageHeading, Panel, TableRegion } from '../ui/components';

// DEMO DATA: invented, isolated presentation fixtures; never used by authenticated production routes.
const preview = {
  accounts: [{ id: 901, account_name: 'DEMO Stockbit', platform_name: 'Stockbit', platform_code: 'stockbit' }, { id: 902, account_name: 'DEMO BIONS', platform_name: 'BIONS', platform_code: 'bions' }, { id: 903, account_name: 'DEMO Pluang', platform_name: 'Pluang', platform_code: 'pluang' }],
  transactions: [
    { id: 901, investment_account_id: 901, symbol: 'TSTA', type: 'BUY', quantity: '1000', transaction_date: '2026-10-17', review_status: 'CONFIRMED' },
    { id: 902, investment_account_id: 903, symbol: 'TSTC', type: 'BUY', quantity: '0.5', transaction_date: '2026-10-16', review_status: 'REQUIRED' },
    { id: 903, investment_account_id: 902, symbol: 'TSTB', type: 'DIVIDEND', quantity: null, transaction_date: '2026-10-15', review_status: 'CONFIRMED' },
  ],
};
const presentation = {
  summary: { value: '128500000', costBasis: '115000000', unrealized: '13500000', realized: '2750000' },
  series: [115.2, 116.4, 116, 118.1, 120, 118.9, 122.3, 124, 123.2, 126.6, 128.5].map((value, i) => ({ date: `2026-10-${String(i * 2 + 1).padStart(2, '0')}`, value: String(Math.round(value * 1000000)) })),
  allocations: [{ label: 'Saham', percent: 66.8, providerLabel: 'DEMO Stockbit' }, { label: 'Crypto', percent: 33.2, providerLabel: 'DEMO Pluang' }],
  holdings: [
    { accountId: 901, symbol: 'TSTA', assetName: 'DEMO Synthetic Equity', provider: 'Stockbit', quantity: '1000', unit: 'SHARE', averageCost: '75000', marketValue: '85800000', pnl: '10800000', currency: 'IDR' },
    { accountId: 903, symbol: 'TSTC', assetName: 'DEMO Synthetic Crypto', provider: 'Pluang', quantity: '0.5', unit: 'COIN', averageCost: '80000000', marketValue: '42700000', pnl: '2700000', currency: 'IDR' },
  ],
};
const comparison = {
  period: '2026-10', status: 'PENDING_REVIEW', items: [
    { accountId: 901, accountName: 'DEMO Stockbit', symbol: 'TSTA', unit: 'SHARE', opening: '800', ledgerClosing: '1000', statementClosing: '1000', delta: '0', status: 'MATCHED', evidence: [{ id: 'demo-1', label: 'DEMO TC · bukti sintetis' }, { id: 'demo-2', label: 'DEMO SOA · bukti sintetis' }] },
    { accountId: 902, accountName: 'DEMO BIONS', symbol: 'TSTB', unit: 'SHARE', opening: '500', ledgerClosing: '500', statementClosing: '400', delta: '-100', status: 'MISMATCH', evidence: [] },
    { accountId: 903, accountName: 'DEMO Pluang', symbol: 'TSTC', unit: 'COIN', opening: null, ledgerClosing: null, statementClosing: '0.5', delta: null, status: 'INCOMPLETE', evidence: [] },
  ],
};

function PreviewTransactions() {
  return <><PageHeading title="Transactions" eyebrow="DEMO DATA" description="Pratinjau tabel; tidak ada operasi tulis dalam preview."/><Panel title="Canonical ledger"><TableRegion label="DEMO transactions"><table><thead><tr><th>Aset</th><th>Jenis</th><th>Kuantitas</th><th>Review</th></tr></thead><tbody>{preview.transactions.map(tx => <tr key={tx.id}><td>{tx.symbol}</td><td>{tx.type}</td><td>{tx.quantity ?? '—'}</td><td><Badge status={tx.review_status}/></td></tr>)}</tbody></table></TableRegion></Panel></>;
}

export default function DesignPreview() {
  if (!import.meta.env.DEV) return null;
  const query = new URLSearchParams(window.location.search);
  if (query.get('viewport') === 'mobile' && !query.has('embedded')) {
    const page = encodeURIComponent(query.get('page') ?? 'overview');
    return <div style={{ background: '#dfe5ed', minHeight: '100vh', padding: 20 }}><iframe title="DEMO DATA · 390px mobile viewport" src={`/__design-preview?embedded=1&page=${page}`} style={{ width: 390, height: 844, maxWidth: '100%', border: '1px solid #bfc9d8', display: 'block', margin: 'auto', background: 'white' }}/></div>;
  }
  const allowed = ['portfolio', 'transactions', 'reconciliation', 'documents', 'analytics', 'connections', 'settings'];
  const selected = query.get('page');
  const initial = allowed.includes(selected) ? `/${selected}` : '/';
  return <MemoryRouter initialEntries={[initial]}><WorkspaceProvider profile={{ name: 'DEMO Investor', email: 'demo@example.test' }} preview={preview} onLogout={null}><Routes><Route element={<AppShell/>}><Route index element={<Dashboard presentation={presentation}/>}/><Route path="portfolio" element={<Portfolio/>}/><Route path="transactions" element={<PreviewTransactions/>}/><Route path="reconciliation" element={<Reconciliation presentation={comparison}/>}/><Route path="documents" element={<DocumentProcessing/>}/><Route path="analytics" element={<Analytics/>}/><Route path="connections" element={<Connections/>}/><Route path="settings" element={<Settings/>}/></Route></Routes></WorkspaceProvider></MemoryRouter>;
}
