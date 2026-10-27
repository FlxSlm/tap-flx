import React, { useState } from 'react';
import { currentPeriod } from './format';
import { WorkspaceContext, useApiList } from './workspace';

export function WorkspaceProvider({ children, profile, onLogout, preview = null }) {
  const accounts = useApiList(preview ? null : '/api/investment-accounts', preview?.accounts);
  const [filters, setFilterState] = useState({ period: currentPeriod(), provider: 'all', accountId: 'all' });
  const [imports, setImports] = useState([]);
  const value = {
    profile, onLogout, preview, accounts, filters, imports,
    setFilters: patch => setFilterState(previous => ({ ...previous, ...patch, ...('provider' in patch && !('accountId' in patch) ? { accountId: 'all' } : {}) })),
    recordImport: entry => setImports(previous => [entry, ...previous.filter(item => item.batchId !== entry.batchId)].slice(0, 20)),
  };
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

