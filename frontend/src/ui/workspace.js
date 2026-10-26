import { createContext, useContext, useEffect, useState } from 'react';
import axios from '../api/axios';

export const WorkspaceContext = createContext(null);

export function useApiList(url, previewData = null) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({ key: null, status: 'loading', data: [], meta: null });
  const key = `${url}:${revision}`;
  useEffect(() => {
    if (!url) return;
    let active = true;
    const controller = new AbortController();
    axios.get(url, { signal: controller.signal }).then(res => {
      if (active) setResult({ key, status: 'ready', data: res.data.data ?? [], meta: res.data.meta ?? null });
    }).catch(() => {
      if (active) setResult({ key, status: 'error', data: [], meta: null });
    });
    return () => { active = false; controller.abort(); };
  }, [url, key]);
  const resource = !url ? { status: 'ready', data: previewData ?? [], meta: null }
    : result.key === key ? result : { status: 'loading', data: [], meta: null };
  return { ...resource, retry: () => setRevision(value => value + 1) };
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('Workspace provider is required.');
  return context;
}

export function useOptionalWorkspace() { return useContext(WorkspaceContext); }

export function useTransactionFeed() {
  const { filters, accounts, preview } = useWorkspace();
  const accountQuery = filters.accountId === 'all' ? '' : `?investment_account_id=${encodeURIComponent(filters.accountId)}`;
  const source = useApiList(preview ? null : `/api/transactions${accountQuery}`, preview?.transactions);
  const rows = source.data.filter(tx => {
    const account = accounts.data.find(item => String(item.id) === String(tx.investment_account_id));
    return (filters.accountId === 'all' || String(tx.investment_account_id) === String(filters.accountId))
      && (filters.provider === 'all' || account?.platform_code === filters.provider)
      && (!filters.period || String(tx.transaction_date).startsWith(filters.period));
  });
  return { ...source, rows };
}
