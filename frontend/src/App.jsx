import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import DocumentProcessing from './pages/DocumentProcessing';
import Reconciliation from './pages/Reconciliation';
import { Analytics, Portfolio, Settings } from './pages/WorkspacePages';
import AutomaticConnections from './pages/AutomaticConnections';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './ui/AppShell';
import { WorkspaceProvider } from './ui/WorkspaceContext';
import { LoadingState } from './ui/components';

const DesignPreview = import.meta.env.DEV ? lazy(() => import('./design/DesignPreview')) : null;

function AuthenticatedWorkspace() {
  const { user, logout } = useAuth();
  return <WorkspaceProvider profile={user} onLogout={logout}><AppShell/></WorkspaceProvider>;
}

export function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="auth-loading"><LoadingState label="Sesi sedang diperiksa"/></div>;
  return <Routes>
    <Route path="/login" element={user ? <Navigate to="/" replace/> : <Login/>}/>
    <Route path="/register" element={user ? <Navigate to="/" replace/> : <Register/>}/>
    <Route element={<ProtectedRoute><AuthenticatedWorkspace/></ProtectedRoute>}>
      <Route index element={<Dashboard/>}/>
      <Route path="portfolio" element={<Portfolio/>}/>
      <Route path="transactions" element={<Transactions/>}/>
      <Route path="reconciliation" element={<Reconciliation/>}/>
      <Route path="documents" element={<DocumentProcessing/>}/>
      <Route path="process-document" element={<Navigate to="/documents" replace/>}/>
      <Route path="analytics" element={<Analytics/>}/>
      <Route path="connections" element={<AutomaticConnections/>}/>
      <Route path="settings" element={<Settings/>}/>
      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Route>
  </Routes>;
}

export default function App() {
  if (import.meta.env.DEV && window.location.pathname.startsWith('/__design-preview') && DesignPreview) {
    return <Suspense fallback={<LoadingState label="Pratinjau sedang dimuat"/>}><DesignPreview/></Suspense>;
  }
  return <AuthProvider><BrowserRouter><AppRoutes/></BrowserRouter></AuthProvider>;
}
