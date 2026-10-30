import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import Icon from './Icon';
import { Notice } from './components';
import { useWorkspace } from './workspace';

const navigation = [
  ['/', 'Overview', 'overview'], ['/portfolio', 'My Portfolio', 'portfolio'], ['/transactions', 'Transactions', 'transactions'],
  ['/reconciliation', 'Reconciliation', 'reconcile'], ['/documents', 'Document Center', 'document'], ['/analytics', 'Analytics', 'analytics'],
  ['/connections', 'Connections', 'connections'], ['/settings', 'Settings', 'settings'],
];

export default function AppShell() {
  const { profile, onLogout, preview } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef(null);
  const sidebarRef = useRef(null);
  const mainRef = useRef(null);
  const location = useLocation();
  const current = navigation.find(([url]) => url === location.pathname)?.[1] ?? 'Workspace';
  useEffect(() => { document.title = `${current} · tap-flx`; mainRef.current?.focus({ preventScroll: true }); }, [current]);
  useEffect(() => { if (open) sidebarRef.current?.querySelector('a')?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  useEffect(() => {
    const media = window.matchMedia?.('(min-width: 761px)');
    const resize = event => { if (event.matches) setOpen(false); };
    media?.addEventListener('change', resize);
    return () => media?.removeEventListener('change', resize);
  }, []);
  const close = () => { setOpen(false); menuRef.current?.focus(); };
  const trapNavigation = event => {
    if (!open) return;
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key !== 'Tab') return;
    const elements = [...sidebarRef.current.querySelectorAll('a, button:not(:disabled)')].filter(element => element.getClientRects().length);
    if (!elements.length) return;
    if (event.shiftKey && document.activeElement === elements[0]) { event.preventDefault(); elements[elements.length - 1].focus(); }
    else if (!event.shiftKey && document.activeElement === elements[elements.length - 1]) { event.preventDefault(); elements[0].focus(); }
  };
  const logout = async () => {
    setSigningOut(true); setLogoutError(false);
    try { await onLogout(); } catch { setLogoutError(true); } finally { setSigningOut(false); }
  };
  const initial = profile?.name?.trim().slice(0, 1).toUpperCase() || 'U';
  return <div className="app-shell">
    <a href="#workspace-content" className="skip-link">Lewati ke konten</a>
    {open && <button className="nav-scrim" aria-label="Tutup navigasi" onClick={close}/>}
    <aside className={`sidebar ${open ? 'is-open' : ''}`} id="workspace-navigation" ref={sidebarRef} onKeyDown={trapNavigation} role={open ? 'dialog' : undefined} aria-modal={open || undefined} aria-label="Navigasi workspace">
      <button className="icon-button sidebar-close" onClick={close} aria-label="Tutup menu"><Icon name="close"/></button>
      <Link className="brand" to="/" onClick={() => { if (open) close(); }} aria-label="tap-flx Overview"><span className="brand-mark"><span/><span/></span><span>tap<span className="brand-suffix">.flx</span><small>PORTFOLIO WORKSPACE</small></span></Link>
      <p className="nav-section-label">WORKSPACE</p>
      <nav aria-label="Menu utama">{navigation.map(([to, label, icon], index) => <NavLink key={to} end={to === '/'} to={to} onClick={() => { if (open) close(); }} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''} ${index === 6 ? 'nav-separator' : ''}`}><Icon name={icon} size={19}/><span>{label}</span>{to === '/reconciliation' && <span className="nav-feature-mark" aria-label="Fokus penelitian"/>}</NavLink>)}</nav>
      <div className="sidebar-bottom"><div className="privacy-note"><Icon name="shield" size={20}/><div><strong>Privasi dokumen</strong><p>Privacy Mode memproses PDF di browser. Automatic Mode memakai server lokal.</p><Link to="/documents" onClick={() => { if (open) close(); }}>Kelola dokumen <Icon name="arrow" size={14}/></Link></div></div>
      <div className="sidebar-profile"><Link to="/settings" className="profile-link" onClick={() => { if (open) close(); }}><span className="avatar">{initial}</span><span><strong>{profile?.name ?? 'Pengguna'}</strong><small>Personal workspace</small></span></Link><button className="icon-button sidebar-logout" onClick={logout} disabled={signingOut || !!preview} aria-label="Keluar dari akun"><Icon name="logout" size={18}/></button></div></div>
    </aside>
    <div className="workspace-frame" inert={open}>
      {preview && <div className="demo-banner">DEMO DATA · Pratinjau komponen terisolasi. Bukan data investasi pengguna.</div>}
      <header className="workspace-topbar"><div className="topbar-location"><button className="icon-button menu-toggle" ref={menuRef} onClick={() => setOpen(value => !value)} aria-controls="workspace-navigation" aria-expanded={open} aria-label="Buka navigasi"><Icon name="menu"/></button><span className="breadcrumb-root">Workspace</span><span className="breadcrumb-divider">/</span><strong>{current}</strong></div><div className="topbar-tools"><span className="local-indicator"><Icon name="shield" size={15}/>Private workspace</span><Link to="/settings" className="avatar topbar-avatar" aria-label="Profil dan pengaturan">{initial}</Link></div></header>
      <main className="workspace-content" id="workspace-content" ref={mainRef} tabIndex={-1}>{logoutError && <Notice tone="danger" role="alert">Sesi belum dapat diakhiri. Silakan coba kembali.</Notice>}<Outlet/></main>
      <footer className="workspace-footer"><span>tap.flx · Portfolio integrity workspace</span><span>Stockbit · BIONS · Pluang Crypto</span></footer>
    </div>
  </div>;
}
