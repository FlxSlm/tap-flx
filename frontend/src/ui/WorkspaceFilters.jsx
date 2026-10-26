import React from 'react';
import { useWorkspace } from './workspace';
import Icon from './Icon';
import { Notice } from './components';

export default function WorkspaceFilters() {
  const { accounts, filters, setFilters } = useWorkspace();
  const choices = accounts.data.filter(account => filters.provider === 'all' || account.platform_code === filters.provider);
  return <><div className="scope-toolbar"><div className="filter-fields"><label>Periode<input type="month" value={filters.period} onChange={event => setFilters({ period: event.target.value })}/></label><label>Provider<select value={filters.provider} onChange={event => setFilters({ provider: event.target.value })}><option value="all">Semua provider</option><option value="stockbit">Stockbit</option><option value="bions">BIONS</option><option value="pluang">Pluang Crypto</option></select></label><label>Akun investasi<select value={filters.accountId} onChange={event => setFilters({ accountId: event.target.value })} disabled={accounts.status !== 'ready'}><option value="all">Semua akun</option>{choices.map(account => <option key={account.id} value={String(account.id)}>{account.account_name || account.platform_name}</option>)}</select></label></div><span className="data-updated"><Icon name="clock" size={15}/>Pembaruan data belum tersedia</span></div>{accounts.status === 'error' && <Notice tone="warning">Daftar akun belum dapat dimuat. <button className="btn btn-secondary btn-sm" onClick={accounts.retry}>Muat ulang akun</button></Notice>}</>;
}
