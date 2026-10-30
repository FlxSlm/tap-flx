// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Connections from '../../pages/AutomaticConnections';
import api from '../../api/axios';
vi.mock('../../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
afterEach(cleanup);
beforeEach(() => { vi.resetAllMocks(); });
const enabled = { enabled: true, configured: true, schema_ready: true, connections: [{ id: 2, email_address: 'synthetic@example.test', is_active: true }], accounts: [{ id: 1, account_name: 'Synthetic account', acquisition_mode: 'PRIVACY', sync_status: 'PAUSED' }] };
it('keeps Privacy Mode usable when automatic configuration/schema is pending', async () => {
  api.get.mockResolvedValue({ data: { ...enabled, schema_ready: false } });
  render(<MemoryRouter><Connections/></MemoryRouter>);
  expect(await screen.findByText(/Migration Automatic Mode belum diterapkan/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Connect Gmail' }).disabled).toBe(true);
  expect(screen.getByRole('link', { name: 'Document Center' }).getAttribute('href')).toBe('/documents');
});
it('requires consent and a selected Gmail then shows mode/status without a reload', async () => {
  let data = enabled;
  api.get.mockImplementation(async url => ({ data: url.endsWith('/reviews') ? { data: [] } : data }));
  api.put.mockImplementation(async () => { data = { ...enabled, accounts: [{ ...enabled.accounts[0], acquisition_mode: 'AUTOMATIC', email_connection_id: 2, sync_status: 'IDLE' }] }; return { data: {} }; });
  render(<MemoryRouter><Connections/></MemoryRouter>);
  const mode = await screen.findByRole('button', { name: 'Aktifkan Automatic' }); expect(mode.disabled).toBe(true);
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(mode);
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/automatic/accounts/1/mode', { mode: 'AUTOMATIC', connection_id: 2, consent: true }));
  expect(await screen.findByText('AUTOMATIC')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Sync now' }).disabled).toBe(false);
});

it('reports OAuth failure safely and requires reconnect before reusing an inactive Gmail', async () => {
  api.get.mockImplementation(async url => ({ data: url.endsWith('/reviews') ? { data: [] } : { ...enabled, connections: [{ ...enabled.connections[0], is_active: false }], accounts: [{ ...enabled.accounts[0], email_connection_id: 2 }] } }));
  render(<MemoryRouter initialEntries={['/connections?gmail=OAUTH_STATE_INVALID']}><Connections/></MemoryRouter>);
  expect(await screen.findByText(/Koneksi Gmail belum berhasil/)).toBeTruthy();
  await screen.findByRole('combobox');
  fireEvent.click(screen.getByRole('checkbox'));
  expect(screen.getByRole('combobox').value).toBe('');
  expect(screen.getByRole('button', { name: 'Aktifkan Automatic' }).disabled).toBe(true);
});
