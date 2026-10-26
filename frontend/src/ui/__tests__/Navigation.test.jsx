// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../../App';
import { useAuth } from '../../context/AuthContext';
import axios from '../../api/axios';

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn(), AuthProvider: ({ children }) => children }));
vi.mock('../../api/axios', () => ({ default: { get: vi.fn() } }));
vi.mock('../../lib/document-processing/PdfExtractor', () => ({ PdfExtractor: { extractDocument: vi.fn() } }));
beforeEach(() => { axios.get.mockResolvedValue({ data: { data: [] } }); });
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it('guards authenticated pages and preserves the requested destination after login', async () => {
  const login = vi.fn().mockResolvedValue(undefined);
  useAuth.mockReturnValue({ user: null, loading: false, login });
  render(<MemoryRouter initialEntries={['/reconciliation']}><AppRoutes/></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'Masuk ke workspace' })).toBeTruthy();
  expect(axios.get).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'demo@example.test' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: '  meaningful spaces  ' } });
  useAuth.mockReturnValue({ user: { name: 'DEMO' }, loading: false });
  fireEvent.click(screen.getByRole('button', { name: 'Masuk' }));
  await screen.findByRole('heading', { name: 'Reconciliation' });
  expect(login).toHaveBeenCalledWith('demo@example.test', '  meaningful spaces  ');
});

it('keeps the existing document URL working and exposes all eight navigation destinations', async () => {
  useAuth.mockReturnValue({ user: { name: 'DEMO' }, loading: false });
  render(<MemoryRouter initialEntries={['/process-document']}><AppRoutes/></MemoryRouter>);
  await screen.findByRole('heading', { name: 'Document Center' });
  const nav = screen.getByRole('navigation', { name: 'Menu utama' });
  expect(nav.querySelectorAll('a')).toHaveLength(8);
  expect(nav.querySelector('[aria-current="page"]').getAttribute('href')).toBe('/documents');
  fireEvent.click(screen.getByRole('link', { name: 'Analytics' }));
  await screen.findByRole('heading', { name: 'Analytics' });
  expect(screen.getAllByText('INCOMPLETE')).toHaveLength(8);
});

it('supports mobile drawer dismissal and restores focus to its trigger', () => {
  useAuth.mockReturnValue({ user: { name: 'DEMO' }, loading: false });
  render(<MemoryRouter initialEntries={['/settings']}><AppRoutes/></MemoryRouter>);
  const trigger = screen.getByRole('button', { name: 'Buka navigasi' });
  fireEvent.click(trigger);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  fireEvent.keyDown(screen.getByLabelText('Navigasi workspace'), { key: 'Escape' });
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(trigger);
});

it('keeps logout actionable and does not leak logout failure details', async () => {
  const logout = vi.fn().mockRejectedValue(new Error('PRIVATE session details'));
  useAuth.mockReturnValue({ user: { name: 'DEMO' }, loading: false, logout });
  render(<MemoryRouter initialEntries={['/settings']}><AppRoutes/></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Keluar dari akun' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Sesi belum dapat diakhiri'));
  expect(logout).toHaveBeenCalledOnce();
  expect(document.body.textContent).not.toContain('PRIVATE session');
});
