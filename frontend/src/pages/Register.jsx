import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import AuthLayout from '../ui/AuthLayout';
import { Notice } from '../ui/components';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', password_confirmation: '' });
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [pending, setPending] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const submit = async event => {
    event.preventDefault(); setErrors({}); setGeneralError(''); setPending(true);
    try { await register(form.name.trim(), form.email.trim(), form.password, form.password_confirmation); navigate('/'); }
    catch (err) {
      if (err.response?.status === 422 && err.response?.data?.errors) setErrors(err.response.data.errors);
      else setGeneralError('Akun belum dapat dibuat. Silakan coba kembali.');
    } finally { setPending(false); }
  };
  const fields = [['name', 'Nama', 'text', 'name'], ['email', 'Email', 'email', 'email'], ['password', 'Password', 'password', 'new-password'], ['password_confirmation', 'Konfirmasi password', 'password', 'new-password']];
  return <AuthLayout title="Buat akun pribadi" description="Mulai workspace untuk mengelola data portofolio Anda.">{generalError && <Notice tone="danger" role="alert">{generalError}</Notice>}<form onSubmit={submit} className="auth-form">{fields.map(([name, label, type, complete]) => <div className="form-group" key={name}><label htmlFor={'register-' + name}>{label}</label><input id={'register-' + name} type={type} autoComplete={complete} minLength={type === 'password' ? 8 : undefined} value={form[name]} onChange={event => setForm({ ...form, [name]: event.target.value })} required aria-invalid={!!errors[name]} aria-describedby={errors[name] ? name + '-error' : undefined}/>{errors[name] && <span className="field-error" id={name + '-error'}>{errors[name][0]}</span>}</div>)}<button type="submit" className="btn btn-primary" disabled={pending}>{pending ? 'Membuat akun...' : 'Daftar akun'}</button></form><p className="auth-alternative">Sudah punya akun? <Link to="/login">Masuk</Link></p></AuthLayout>;
}
