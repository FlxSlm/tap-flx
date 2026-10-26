import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import AuthLayout from '../ui/AuthLayout';
import { Notice } from '../ui/components';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const submit = async event => {
    event.preventDefault(); setPending(true); setError('');
    try {
      await login(email.trim(), password);
      const target = location.state?.from;
      navigate(typeof target === 'string' && target.startsWith('/') && !target.startsWith('//') ? target : '/', { replace: true });
    } catch (err) {
      setError(err.response?.status === 401 ? 'Email atau password tidak cocok.' : 'Belum dapat masuk. Periksa koneksi dan coba kembali.');
    } finally { setPending(false); }
  };
  return <AuthLayout title="Masuk ke workspace" description="Kelola transaksi dan dokumen portofolio Anda.">
    {error && <Notice tone="danger" role="alert">{error}</Notice>}
    <form onSubmit={submit} className="auth-form"><div className="form-group"><label htmlFor="login-email">Email</label><input id="login-email" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required/></div><div className="form-group"><label htmlFor="login-password">Password</label><input id="login-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required/></div><button className="btn btn-primary" type="submit" disabled={pending}>{pending ? 'Memeriksa akun...' : 'Masuk'}</button></form><p className="auth-alternative">Belum punya akun? <Link to="/register">Daftar akun</Link></p>
  </AuthLayout>;
}
