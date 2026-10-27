// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from '../../api/axios';
import Portfolio from '../../pages/PortfolioHoldings';
import { WorkspaceProvider } from '../WorkspaceContext';

vi.mock('../../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const accounts = [{ id: 901, account_name: 'DEMO Stockbit', platform_code: 'stockbit', platform_name: 'Stockbit' }, { id: 902, account_name: 'DEMO Crypto', platform_code: 'pluang', platform_name: 'Pluang' }];
const baseline = { id: 11, as_of_date: '2020-01-31', provider: 'STOCKBIT', coverage: 'FULL', coverage_confirmed: true, activity_coverage: 'UNKNOWN', review_status: 'CONFIRMED', fingerprint: 'a'.repeat(64), baseline_issues: [], authoritative_reported: true, source: null, items: [{ id: 12, symbol: 'TSTA', unit: 'SHARE', quantity: '100' }] };
const calculated = { status: 'INCOMPLETE', reasons: ['ACTIVITY_COVERAGE_UNKNOWN'], baseline, window: {}, input_version: 'b'.repeat(64), excluded_events: [], items: [{ symbol: 'TSTA', unit: 'SHARE', opening_quantity: '100', buy_quantity: '30', sell_quantity: '10', quantity: '120', status: 'INCOMPLETE', reasons: ['ACTIVITY_COVERAGE_UNKNOWN'], transaction_ids: [31, 32] }] };
const positions = { account: { id: 901, account_name: 'DEMO Stockbit', provider: 'STOCKBIT' }, as_of: '2020-02-29', reported: { status: 'REPORTED', snapshots: [{ ...baseline, id: 21, as_of_date: '2020-02-29', items: [{ id: 22, symbol: 'TSTA', unit: 'SHARE', quantity: '250' }] }] }, calculated };
let snapshots;
beforeEach(() => {
  snapshots = [baseline];
  axios.get.mockImplementation(url => {
    if (url === '/api/investment-accounts') return Promise.resolve({ data: { data: accounts } });
    if (url.includes('/portfolio-snapshots?')) return Promise.resolve({ data: { data: snapshots, meta: { current_page: 1, last_page: 1 } } });
    return Promise.resolve({ data: positions });
  });
});
function mount() { return render(<MemoryRouter><WorkspaceProvider profile={{ name: 'DEMO' }}><Portfolio/></WorkspaceProvider></MemoryRouter>); }
it('opens an imported account/date from the URL and repeats the same persisted read after a full remount', async () => {
  const open = () => render(<MemoryRouter initialEntries={['/portfolio?account=901&as_of=2020-02-29']}><WorkspaceProvider profile={{ name: 'DEMO' }}><Portfolio/></WorkspaceProvider></MemoryRouter>);
  let page = open();
  await screen.findByRole('region', { name: 'Reported holdings snapshot 21' });
  expect(screen.getByLabelText('Akun investasi').value).toBe('901');
  expect(screen.getByLabelText('Tanggal posisi').value).toBe('2020-02-29');
  page.unmount(); page = open();
  await screen.findByRole('region', { name: 'Reported holdings snapshot 21' });
  expect(screen.getByLabelText('Akun investasi').value).toBe('901');
  expect(axios.get.mock.calls.filter(([url]) => url.includes('/holdings?')).every(([url]) => url.includes('as_of=2020-02-29'))).toBe(true);
  page.unmount();
});
async function chooseAccount(id = '901') {
  await waitFor(() => expect(screen.getByLabelText('Akun investasi').disabled).toBe(false));
  fireEvent.change(screen.getByLabelText('Akun investasi'), { target: { value: id } });
}

it('requires one account before fetching positions and never combines providers', async () => {
  mount();
  await screen.findByText('Pilih akun dan tanggal posisi');
  expect(axios.get.mock.calls.map(([url]) => url)).toEqual(['/api/investment-accounts']);
  await chooseAccount();
  await screen.findByRole('region', { name: 'Calculated holdings' });
  expect(axios.get.mock.calls.filter(([url]) => url.includes('/holdings?')).every(([url]) => url.startsWith('/api/investment-accounts/901/'))).toBe(true);
});

it('separates monthly reported quantity from conditional calculated quantity without deriving reconciliation', async () => {
  mount(); await chooseAccount();
  const reported = await screen.findByRole('region', { name: 'Reported holdings snapshot 21' });
  expect(within(reported).getByText('250')).toBeTruthy();
  expect(within(screen.getByRole('region', { name: 'Calculated holdings' })).getByText('120')).toBeTruthy();
  expect(screen.getAllByText(/Kelengkapan transaksi sepanjang periode belum terbukti/)).toHaveLength(2);
  expect(screen.getByText(/Status rekonsiliasi tetap NOT_RUN/)).toBeTruthy();
  expect(screen.queryByText('Posisi sesuai')).toBeNull();
  expect(screen.queryByText('Posisi berbeda')).toBeNull();
  expect(axios.post).not.toHaveBeenCalled();
});

it('passes only an explicitly selected baseline and resets it when the target date changes', async () => {
  mount(); await chooseAccount();
  await screen.findByLabelText('Opening snapshot');
  expect(axios.get.mock.calls.filter(([url]) => url.includes('/holdings?')).every(([url]) => !url.includes('baseline_snapshot_id'))).toBe(true);
  fireEvent.change(screen.getByLabelText('Opening snapshot'), { target: { value: '11' } });
  await waitFor(() => expect(axios.get.mock.calls.some(([url]) => url.includes('baseline_snapshot_id=11'))).toBe(true));
  fireEvent.change(screen.getByLabelText('Tanggal posisi'), { target: { value: '2020-02-29' } });
  await waitFor(() => expect(screen.getByLabelText('Opening snapshot').value).toBe(''));
});

it('confirms metadata only after unit review and attestation, keeping source quantity out of the POST', async () => {
  snapshots = [{ ...baseline, review_status: 'REQUIRED', coverage: 'UNKNOWN', baseline_issues: ['SNAPSHOT_NOT_CONFIRMED', 'UNKNOWN_OR_INVALID_SNAPSHOT_UNIT'], items: [{ ...baseline.items[0], unit: 'UNKNOWN' }] }];
  axios.post.mockResolvedValue({ data: { data: baseline } });
  mount(); await chooseAccount();
  await screen.findByLabelText('Snapshot untuk ditinjau');
  fireEvent.change(screen.getByLabelText('Snapshot untuk ditinjau'), { target: { value: '11' } });
  expect(screen.getByRole('button', { name: 'Konfirmasi snapshot' }).disabled).toBe(true);
  expect(axios.post).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Unit TSTA'), { target: { value: 'SHARE' } });
  fireEvent.change(screen.getByLabelText('Cakupan posisi'), { target: { value: 'PARTIAL' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /Saya telah memeriksa/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Konfirmasi snapshot' }));
  await screen.findByText(/Konfirmasi snapshot tersimpan bersama audit trail/);
  expect(axios.post).toHaveBeenCalledExactlyOnceWith('/api/investment-accounts/901/portfolio-snapshots/11/confirm', { confirmed: true, expected_fingerprint: baseline.fingerprint, coverage: 'PARTIAL', items: [{ id: 12, unit: 'SHARE' }] });
  expect(JSON.stringify(axios.post.mock.calls[0][1])).not.toContain('quantity');
});

it('shows same-date conflict review without offering an automatic confirmation or adjustment', async () => {
  snapshots = [{ ...baseline, baseline_issues: ['SAME_DATE_SNAPSHOT_CONFLICT'] }];
  mount(); await chooseAccount();
  await screen.findByLabelText('Snapshot untuk ditinjau');
  fireEvent.change(screen.getByLabelText('Snapshot untuk ditinjau'), { target: { value: '11' } });
  expect(screen.getByText(/Snapshot ini belum dapat dikonfirmasi sebagai baseline/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Konfirmasi snapshot' })).toBeNull();
  expect(axios.post).not.toHaveBeenCalled();
});

it('does not interpret a failed request as empty positions or display server exceptions', async () => {
  axios.get.mockImplementation(url => url === '/api/investment-accounts' ? Promise.resolve({ data: { data: accounts } }) : Promise.reject(new Error('PRIVATE SQL')));
  mount(); await chooseAccount();
  await screen.findByText('Holdings belum dapat dimuat');
  expect(screen.queryByText('Belum ada snapshot untuk tanggal ini')).toBeNull();
  expect(document.body.textContent).not.toContain('PRIVATE SQL');
});

it('does not reuse explicit timestamp boundaries when switching to a different account', async () => {
  mount(); await chooseAccount();
  await screen.findByLabelText('Timezone sumber yang diverifikasi');
  fireEvent.change(screen.getByLabelText('Timezone sumber yang diverifikasi'), { target: { value: 'Asia/Jakarta' } });
  fireEvent.change(screen.getByLabelText('Cutoff harian'), { target: { value: '23:59:59' } });
  fireEvent.click(screen.getByRole('button', { name: 'Terapkan batas waktu' }));
  await waitFor(() => expect(axios.get.mock.calls.some(([url]) => url.includes('timezone=Asia%2FJakarta'))).toBe(true));
  await chooseAccount('902');
  await waitFor(() => expect(axios.get.mock.calls.some(([url]) => url.startsWith('/api/investment-accounts/902/holdings?'))).toBe(true));
  expect(axios.get.mock.calls.filter(([url]) => url.startsWith('/api/investment-accounts/902/holdings?')).every(([url]) => !url.includes('timezone='))).toBe(true);
});

it('keeps unknown calculated quantity as unavailable rather than zero', async () => {
  axios.get.mockImplementation(url => {
    if (url === '/api/investment-accounts') return Promise.resolve({ data: { data: accounts } });
    if (url.includes('portfolio-snapshots')) return Promise.resolve({ data: { data: [], meta: { current_page: 1, last_page: 1 } } });
    return Promise.resolve({ data: { ...positions, calculated: { ...calculated, items: [{ ...calculated.items[0], quantity: null, reasons: ['TRANSACTION_REQUIRES_REVIEW'] }] } } });
  });
  mount(); await chooseAccount();
  const table = await screen.findByRole('region', { name: 'Calculated holdings' });
  const cells = within(table).getAllByRole('cell');
  expect(cells[4].textContent).toBe('—');
  expect(screen.getByText('Transaksi masih menunggu review.')).toBeTruthy();
});
