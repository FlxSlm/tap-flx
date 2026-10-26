// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from '../../api/axios';
import { WorkspaceProvider } from '../WorkspaceContext';
import { useApiList } from '../workspace';
import Dashboard from '../../pages/Dashboard';
import Reconciliation from '../../pages/Reconciliation';
import WorkspaceFilters from '../WorkspaceFilters';
import { Metric } from '../components';
import PerformanceChart from '../PerformanceChart';
import ImportHistory from '../ImportHistory';
import { money, number, date, safeError, currentPeriod } from '../format';
import DesignPreview from '../../design/DesignPreview';
import Transactions from '../../pages/Transactions';

vi.mock('../../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../../lib/document-processing/PdfExtractor', () => ({ PdfExtractor: { extractDocument: vi.fn() } }));
beforeEach(() => { axios.get.mockResolvedValue({ data: { data: [] } }); });
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const accounts = [
  { id: 901, account_name: 'DEMO Stockbit', platform_code: 'stockbit', platform_name: 'Stockbit' },
  { id: 902, account_name: 'DEMO Pluang', platform_code: 'pluang', platform_name: 'Pluang' },
];
const wrap = (children, preview = { accounts, transactions: [] }) => render(<MemoryRouter><WorkspaceProvider profile={{ name: 'DEMO Investor' }} preview={preview}>{children}</WorkspaceProvider></MemoryRouter>);

it('keeps unknown financial values distinct from confirmed zero and fractional coin quantities', () => {
  const { container } = render(<><Metric label="Unknown"/><Metric label="Zero" value="0"/></>);
  const metrics = container.querySelectorAll('.metric');
  expect(metrics[0].textContent).toContain('Belum tersedia');
  expect(metrics[0].textContent).toContain('NOT_AVAILABLE');
  expect(metrics[1].textContent).toContain(money('0'));
  expect(metrics[1].textContent).not.toContain('NOT_AVAILABLE');
  expect(number('0.00000001')).toBe('0,00000001');
  expect(number(null)).toBe('—');
  expect(money('UNKNOWN')).toBe('Belum tersedia');
  expect(date('invalid')).toBe('Belum tersedia');
});

it('never displays a raw server error in the shared error formatter', () => {
  expect(safeError({ response: { status: 500, data: { message: 'SQL private content' } } })).not.toContain('SQL');
});

it('renders honest dashboard states without requesting nonexistent financial endpoints', async () => {
  wrap(<Dashboard/>, null);
  await screen.findByText('Belum ada aktivitas yang dapat ditampilkan');
  expect(screen.getByText('Posisi aset belum tersedia')).toBeTruthy();
  expect(screen.getByText('Hasil belum dimuat di Overview.')).toBeTruthy();
  expect(screen.getAllByText('NOT_AVAILABLE')).toHaveLength(4);
  expect(axios.get.mock.calls.map(([url]) => url).sort()).toEqual(['/api/investment-accounts', '/api/transactions']);
  expect(axios.post).not.toHaveBeenCalled();
});

it('distinguishes a failed transaction request from an empty ledger and supports retry', async () => {
  axios.get.mockImplementation(url => url.includes('transactions') ? Promise.reject(new Error('private')) : Promise.resolve({ data: { data: accounts } }));
  wrap(<Dashboard/>, null);
  await screen.findByText('Aktivitas belum dapat dimuat');
  expect(screen.queryByText('Belum ada aktivitas yang dapat ditampilkan')).toBeNull();
  axios.get.mockResolvedValue({ data: { data: [] } });
  fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
  await screen.findByText('Belum ada aktivitas yang dapat ditampilkan');
});

it('filters the loaded activity page by provider and period without implying monthly totals', () => {
  wrap(<Dashboard/>, { accounts, transactions: [
    { id: 1, investment_account_id: 901, symbol: 'DEMO-STOCK', type: 'BUY', transaction_date: `${currentPeriod()}-01`, quantity: '0', review_status: 'CONFIRMED' },
    { id: 2, investment_account_id: 902, symbol: 'DEMO-COIN', type: 'BUY', transaction_date: `${currentPeriod()}-01`, quantity: '0.1' },
  ] });
  fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'pluang' } });
  expect(screen.queryByText('DEMO-STOCK')).toBeNull();
  expect(screen.getByText('DEMO-COIN')).toBeTruthy();
  expect(screen.getByText(/Bukan total aktivitas bulanan/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Periode'), { target: { value: '2000-01' } });
  expect(screen.queryByText('DEMO-COIN')).toBeNull();
});

it('resets incompatible account selection when changing provider', () => {
  wrap(<WorkspaceFilters/>);
  fireEvent.change(screen.getByLabelText('Akun investasi'), { target: { value: '901' } });
  fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'pluang' } });
  expect(screen.getByLabelText('Akun investasi').value).toBe('all');
  expect(within(screen.getByLabelText('Akun investasi')).queryByText('DEMO Stockbit')).toBeNull();
});

it('shows unavailable chart state without drawing fabricated series', () => {
  const { container } = render(<PerformanceChart/>);
  expect(screen.getByText('Kinerja belum dapat ditampilkan')).toBeTruthy();
  expect(container.querySelector('polyline')).toBeNull();
  expect(screen.queryByRole('slider')).toBeNull();
});

it('supports dated range filtering and keyboard chart selection using only supplied values', () => {
  const series = [{ date: '2026-01-01', value: '100' }, { date: '2026-10-01', value: '200' }, { date: '2026-10-20', value: '300' }];
  const { rerender, container } = render(<PerformanceChart series={series} range="1M"/>);
  expect(screen.getByRole('slider').max).toBe('1');
  fireEvent.change(screen.getByRole('slider'), { target: { value: '1' } });
  expect(container.querySelector('output').textContent).toContain(money('300'));
  rerender(<PerformanceChart series={series} range="ALL"/>);
  expect(screen.getByRole('slider').max).toBe('2');
});

it('does not recalculate supplied reconciliation deltas or invent adjustment controls', () => {
  wrap(<Reconciliation presentation={{ items: [{ accountId: 901, symbol: 'DEMO', accountName: 'DEMO', unit: 'SHARE', opening: null, ledgerClosing: '10', statementClosing: '12', delta: null, status: 'INCOMPLETE', evidence: [{ id: 'demo', label: 'DEMO evidence' }] }] }}/>);
  const table = screen.getByRole('table');
  const cells = within(table).getAllByRole('cell');
  expect(cells[4].textContent).toBe('—');
  expect(cells[5].textContent).toContain('Data tidak lengkap');
  expect(screen.getByText(/FULL tidak otomatis/)).toBeTruthy();
  expect(screen.getByText('DEMO evidence')).toBeTruthy();
  expect(axios.post).not.toHaveBeenCalled();
  expect(axios.get).not.toHaveBeenCalled();
});

it('looks up a confirmed import by UUID and hides private error responses', async () => {
  render(<ImportHistory/>);
  fireEvent.change(screen.getByLabelText('ID batch impor'), { target: { value: 'bad-id' } });
  fireEvent.click(screen.getByRole('button', { name: 'Telusuri impor' }));
  expect(axios.get).not.toHaveBeenCalled();
  expect(screen.getByRole('alert').textContent).toContain('valid');
  axios.get.mockRejectedValue({ response: { data: { message: 'PRIVATE SQL' } } });
  fireEvent.change(screen.getByLabelText('ID batch impor'), { target: { value: '11111111-2222-4333-8444-555555555555' } });
  fireEvent.click(screen.getByRole('button', { name: 'Telusuri impor' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('tidak dapat dimuat'));
  expect(axios.get).toHaveBeenCalledWith('/api/source-imports/11111111-2222-4333-8444-555555555555');
  expect(document.body.textContent).not.toContain('PRIVATE SQL');
});

it('ignores late responses from a previous account scope', async () => {
  let resolveFirst;
  axios.get.mockImplementation(url => url === '/first' ? new Promise(resolve => { resolveFirst = resolve; }) : Promise.resolve({ data: { data: [{ id: 'CURRENT' }] } }));
  function Probe({ url }) { const resource = useApiList(url); return <div>{resource.status}:{resource.data.map(item => item.id).join(',')}</div>; }
  const { rerender } = render(<Probe url="/first"/>);
  rerender(<Probe url="/second"/>);
  await screen.findByText('ready:CURRENT');
  resolveFirst({ data: { data: [{ id: 'STALE' }] } });
  await waitFor(() => expect(screen.getByText('ready:CURRENT')).toBeTruthy());
  expect(screen.queryByText(/STALE/)).toBeNull();
});

it('keeps the isolated preview labeled and prevents API calls and document writes', async () => {
  render(<DesignPreview/>);
  expect(screen.getByText(/DEMO DATA.*Pratinjau komponen/)).toBeTruthy();
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Menu utama' })).getByRole('link', { name: 'Document Center' }));
  await screen.findByRole('heading', { name: 'Document Center' });
  expect(screen.getByLabelText('2. Select Local Document (PDF)').disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Process Document' }).disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Telusuri impor' }).disabled).toBe(true);
  expect(axios.get).not.toHaveBeenCalled();
  expect(axios.post).not.toHaveBeenCalled();
});

it('does not treat a failed ledger request as a verified empty ledger', async () => {
  axios.get.mockRejectedValue(new Error('private connection details'));
  render(<Transactions/>);
  await screen.findByText('Daftar transaksi belum tersedia');
  expect(screen.queryByText('No transactions found. Click "+ New Transaction" to add one.')).toBeNull();
  expect(screen.getByText('Daftar akun belum dapat dimuat.')).toBeTruthy();
  expect(document.body.textContent).not.toContain('private connection');
});
