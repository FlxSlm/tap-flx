// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from '../../api/axios';
import Reconciliation from '../../pages/Reconciliation';
import { WorkspaceProvider } from '../WorkspaceContext';

vi.mock('../../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const accounts = [{ id: 901, account_name: 'DEMO Stocks', platform_code: 'stockbit', platform_name: 'Stockbit' }, { id: 902, account_name: 'DEMO Crypto', platform_code: 'pluang', platform_name: 'Pluang' }];
const sources = [{ id: '11111111-2222-4333-8444-555555555555', provider: 'STOCKBIT', document_type: 'SOA', parser_version: 'synthetic@1' }, { id: '11111111-2222-4333-8444-666666666666', provider: 'STOCKBIT', document_type: 'TC', parser_version: 'synthetic@1' }];
const opening = { id: 11, as_of_date: '2020-01-31', coverage: 'FULL', review_status: 'CONFIRMED', baseline_issues: [], source_indicator: 'SOURCE_DOCUMENT' };
const closing = { ...opening, id: 12, as_of_date: '2020-02-29' };
const initial = {
  account: { id: 901, account_name: 'DEMO Stocks', provider: 'STOCKBIT' },
  parameters: { opening_snapshot_id: 11, closing_snapshot_id: 12, timezone: null, cutoff: null },
  window: { opening_exclusive: '2020-01-31', as_of_inclusive: '2020-02-29' },
  status: 'INCOMPLETE', counts: { MATCHED: 0, MISMATCH: 0, INCOMPLETE: 1, PENDING_REVIEW: 0 },
  reasons: ['ACTIVITY_COVERAGE_UNKNOWN'], coverage: { confirmed: false, status: 'UNKNOWN', source_ids: [] },
  input_version: 'a'.repeat(64), rule_version: 'reconciliation-v1', quantity_tolerance: '0', calculated_at: '2020-03-01T00:00:00Z',
  evidence: { snapshots: { opening, closing }, sources, excluded_events: [] },
  items: [{ symbol: 'TSTA', unit: 'SHARE', opening_quantity: '100', accepted_buy_quantity: '20', accepted_sell_quantity: '0', calculated_quantity: '120', reported_quantity: '120', difference: '0', observed_position_change: '20', numerical_comparison: 'EQUAL', status: 'INCOMPLETE', reasons: ['ACTIVITY_COVERAGE_UNKNOWN'], diagnostics: ['NUMERICALLY_EQUAL_BUT_COVERAGE_UNVERIFIED'], transaction_ids: [31], transaction_evidence: [] }],
};
function matched() {
  return { ...initial, status: 'MATCHED', reasons: [], counts: { MATCHED: 1, MISMATCH: 0, INCOMPLETE: 0, PENDING_REVIEW: 0 }, coverage: { confirmed: true, status: 'FULL', input_version: initial.input_version, source_ids: sources.map(source => source.id) }, items: [{ ...initial.items[0], status: 'MATCHED', reasons: [], diagnostics: [] }] };
}
beforeEach(() => {
  axios.get.mockImplementation(url => {
    if (url === '/api/investment-accounts') return Promise.resolve({ data: { data: accounts } });
    if (url.includes('/portfolio-snapshots?')) return Promise.resolve({ data: { data: [closing, opening], meta: { current_page: 1, last_page: 1 } } });
    return Promise.resolve({ data: { available: true, data: [], meta: { current_page: 1, last_page: 1 } } });
  });
  axios.post.mockImplementation((url, payload) => Promise.resolve({ data: { data: payload.coverage ? matched() : initial, history_available: true } }));
});
function mount() { render(<MemoryRouter><WorkspaceProvider profile={{ name: 'DEMO' }}><Reconciliation/></WorkspaceProvider></MemoryRouter>); }
async function select() {
  await waitFor(() => expect(screen.getByLabelText('Akun rekonsiliasi').disabled).toBe(false));
  fireEvent.change(screen.getByLabelText('Akun rekonsiliasi'), { target: { value: '901' } });
  await screen.findByLabelText('Opening snapshot');
  fireEvent.change(screen.getByLabelText('Opening snapshot'), { target: { value: '11' } });
  fireEvent.change(screen.getByLabelText('Closing Monthly Statement'), { target: { value: '12' } });
}
async function compare() { await select(); fireEvent.click(screen.getByRole('button', { name: 'Bandingkan posisi' })); await screen.findByRole('region', { name: 'Tabel rekonsiliasi' }); }

it('starts NOT_RUN and sends no comparison or confirmation before explicit selection and action', async () => {
  mount();
  expect(screen.getByText('Belum dihitung')).toBeTruthy();
  await select();
  expect(axios.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Bandingkan posisi' }));
  await screen.findByRole('region', { name: 'Tabel rekonsiliasi' });
  expect(axios.post.mock.calls[0][0]).toBe('/api/investment-accounts/901/reconciliation');
  expect(axios.post.mock.calls[0][1]).toEqual({ opening_snapshot_id: 11, closing_snapshot_id: 12 });
});

it('keeps numerical equality distinct from verified MATCHED when coverage is unknown', async () => {
  mount(); await compare();
  const table = screen.getByRole('region', { name: 'Tabel rekonsiliasi' });
  expect(within(table).getByText('Angka sama')).toBeTruthy();
  expect(within(table).queryByText('Posisi sesuai')).toBeNull();
  expect(within(table).getByText('NUMERICALLY_EQUAL_BUT_COVERAGE_UNVERIFIED')).toBeTruthy();
  expect(screen.getByText(/Coverage aktivitas belum terkonfirmasi/)).toBeTruthy();
});

it('binds a deliberate coverage confirmation to the server input version and all evidence references', async () => {
  mount(); await compare();
  fireEvent.click(screen.getByRole('checkbox', { name: /Saya telah meninjau seluruh sumber/ }));
  await waitFor(() => expect(screen.getByRole('checkbox', { name: /Saya telah meninjau seluruh sumber/ }).checked).toBe(true));
  const payload = axios.post.mock.calls[1][1];
  expect(payload.coverage).toEqual({ confirmed: true, input_version: initial.input_version, source_ids: sources.map(source => source.id) });
  expect(axios.post.mock.calls.filter(([url]) => url.endsWith('/reconciliation-runs'))).toHaveLength(0);
  expect(screen.getAllByText(/Ini attestation pengguna/)).toHaveLength(2);
});

it('drops stale coverage when recalculation returns a changed input version', async () => {
  mount(); await compare();
  fireEvent.click(screen.getByRole('checkbox', { name: /Saya telah meninjau seluruh sumber/ }));
  await waitFor(() => expect(screen.getByRole('checkbox', { name: /Saya telah meninjau seluruh sumber/ }).checked).toBe(true));
  axios.post.mockResolvedValue({ data: { data: { ...initial, input_version: 'b'.repeat(64), previous_input_stale: true, reasons: ['ACTIVITY_COVERAGE_UNKNOWN', 'COVERAGE_CONFIRMATION_STALE'] }, history_available: true } });
  fireEvent.click(screen.getByRole('button', { name: 'Hitung ulang' }));
  await screen.findByText(/Versi input berubah dari evaluasi sebelumnya/);
  expect(screen.getByRole('checkbox', { name: /Saya telah meninjau seluruh sumber/ }).checked).toBe(false);
  expect(axios.post.mock.calls[2][1].coverage.input_version).toBe(initial.input_version);
  expect(screen.getByText('COVERAGE_CONFIRMATION_STALE')).toBeTruthy();
});

it('keeps comparison usable while history migration is pending and never offers a fake save', async () => {
  axios.post.mockResolvedValue({ data: { data: initial, history_available: false } });
  mount(); await compare();
  expect(screen.getByRole('button', { name: 'Simpan hasil ke histori' }).disabled).toBe(true);
  expect(screen.getByText(/migration Gate 3 menunggu penerapan manual/)).toBeTruthy();
  expect(axios.post).toHaveBeenCalledOnce();
});

it('shows null quantity differences as unavailable rather than zero or a locally calculated delta', async () => {
  axios.post.mockResolvedValue({ data: { data: { ...initial, items: [{ ...initial.items[0], calculated_quantity: null, difference: null, numerical_comparison: 'NOT_COMPARABLE' }] }, history_available: true } });
  mount(); await compare();
  const cells = within(screen.getByRole('region', { name: 'Tabel rekonsiliasi' })).getAllByRole('cell');
  expect(cells[4].textContent).toBe('—');
  expect(cells[6].textContent).toContain('—');
  expect(cells[6].textContent).not.toContain('120');
});

it('does not display private server exception messages after failure', async () => {
  axios.post.mockRejectedValue({ response: { status: 500, data: { message: 'PRIVATE SQL AND PDF TEXT' } } });
  mount(); await select();
  fireEvent.click(screen.getByRole('button', { name: 'Bandingkan posisi' }));
  await screen.findByRole('alert');
  expect(document.body.textContent).not.toContain('PRIVATE SQL');
  expect(screen.queryByRole('region', { name: 'Tabel rekonsiliasi' })).toBeNull();
});

it('sends optimistic save preconditions and hides an outdated current result when saving conflicts', async () => {
  mount(); await compare();
  axios.post.mockRejectedValue({ response: { status: 409 } });
  fireEvent.click(screen.getByRole('button', { name: 'Simpan hasil ke histori' }));
  await screen.findByText(/Input berubah sebelum penyimpanan/);
  expect(axios.post.mock.calls[1][1].expected_input_version).toBe(initial.input_version);
  expect(screen.queryByRole('region', { name: 'Tabel rekonsiliasi' })).toBeNull();
});

it('labels stored stale MATCHED results as historical and never presents them as current evaluation', async () => {
  const runId = '11111111-2222-4333-8444-777777777777';
  const historical = { run_id: runId, saved_at: '2020-03-01T00:00:00Z', is_current: false, freshness: 'STALE', result: matched() };
  axios.get.mockImplementation(url => {
    if (url === '/api/investment-accounts') return Promise.resolve({ data: { data: accounts } });
    if (url.includes('/portfolio-snapshots?')) return Promise.resolve({ data: { data: [closing, opening], meta: { current_page: 1, last_page: 1 } } });
    if (url.endsWith(runId)) return Promise.resolve({ data: historical });
    return Promise.resolve({ data: { available: true, data: [historical], meta: { current_page: 1, last_page: 1 } } });
  });
  mount(); await select();
  fireEvent.click(await screen.findByRole('button', { name: 'Lihat hasil' }));
  await screen.findByText(/Hasil historis STALE/);
  expect(screen.getByRole('region', { name: 'Tabel rekonsiliasi historis' })).toBeTruthy();
  expect(screen.queryByRole('region', { name: 'Tabel rekonsiliasi' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Gunakan pilihan histori untuk hitung ulang' }));
  expect(axios.post).not.toHaveBeenCalled();
});

it('clears a previous accounts cutoff when entering timestamp settings for another account', async () => {
  mount(); await select();
  fireEvent.change(screen.getByLabelText('Timezone batas periode'), { target: { value: 'Asia/Jakarta' } });
  fireEvent.change(screen.getByLabelText('Cutoff harian'), { target: { value: '23:59:59' } });
  fireEvent.change(screen.getByLabelText('Akun rekonsiliasi'), { target: { value: '902' } });
  expect(screen.getByLabelText('Timezone batas periode').value).toBe('');
  fireEvent.change(screen.getByLabelText('Timezone batas periode'), { target: { value: 'UTC' } });
  expect(screen.getByLabelText('Cutoff harian').value).toBe('');
});
