import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';

export default function AuthLayout({ title, description, children }) {
  useEffect(() => { document.title = `${title} · tap.flx`; }, [title]);
  return <div className="auth-layout"><aside className="auth-aside"><Link to="/login" className="brand"><span className="brand-mark"><span/><span/></span><span>tap<span className="brand-suffix">.flx</span><small>PORTFOLIO WORKSPACE</small></span></Link><div className="auth-context"><p className="eyebrow">PERSONAL FINANCIAL WORKSPACE</p><h2>Portofolio yang<br/>dapat ditelusuri.</h2><p>Satu tempat untuk mengelola transaksi, laporan bulanan, dan kualitas data portofolio Anda.</p><div className="auth-integrity"><Icon name="reconcile" size={26}/><div><strong>Portfolio reconciliation</strong><span>Fokus pada konsistensi posisi dan bukti sumber.</span></div></div></div><div className="auth-aside-foot"><Icon name="shield" size={18}/><p>Privacy Mode<br/><span>PDF diproses lokal di perangkat Anda.</span></p></div></aside><main className="auth-main"><div className="auth-form-container"><p className="eyebrow">WELCOME TO TAP.FLX</p><h1>{title}</h1><p className="page-description">{description}</p>{children}<p className="auth-provider-note">Stockbit · BIONS · Pluang Crypto</p></div></main></div>;
}
