// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axios from '../../../api/axios';
import DocumentProcessing from '../../../pages/DocumentProcessing';
import { PdfExtractor } from '../PdfExtractor';
import { monthlyLines } from './syntheticPdf';
import { assertPrivacyOrigin } from '../../../api/privacyOrigin';

vi.mock('../../../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../PdfExtractor', () => ({ PdfExtractor: { extractDocument: vi.fn() } }));
const account = { id: 91, platform_code: 'stockbit', platform_name: 'Stockbit', account_name: 'Synthetic Portfolio' };
const document = { documentHash: 'd'.repeat(64), text: monthlyLines.join('\n') + '\nSYNTHETIC_PRIVATE_TEXT' };
beforeEach(() => { axios.get.mockResolvedValue({ data: { data: [account] } }); PdfExtractor.extractDocument.mockResolvedValue(document); });
afterEach(() => { cleanup(); vi.resetAllMocks(); });
async function selectFile() { const input = screen.getByLabelText('2. Select Local Document (PDF)'); fireEvent.change(input, { target: { files: [new File(['SYNTHETIC_PRIVATE_BYTES'], 'SYNTHETIC_PRIVATE_FILE.pdf', { type: 'application/pdf' })] } }); }
async function process() { await selectFile(); fireEvent.click(screen.getByText('Process Document')); await screen.findByText('Import Selected (4)'); }
async function selectAccount() { await screen.findByText('Stockbit — Synthetic Portfolio'); fireEvent.change(screen.getByLabelText('1. Select Investment Account *'), { target: { value: '91' } }); }

it('distinguishes an empty account list and creates/selects an account immediately without refresh', async () => {
  axios.get.mockResolvedValue({ data: { data: [] } });
  axios.post.mockResolvedValue({ data: { data: account, already_exists: false } });
  render(<DocumentProcessing/>);
  await screen.findAllByText('Create an investment account to continue.');
  const form = screen.getByRole('form', { name: 'Create Investment Account' });
  fireEvent.change(within(form).getByLabelText('Label akun'), { target: { value: 'Synthetic Portfolio' } });
  fireEvent.submit(form); fireEvent.submit(form);
  await waitFor(() => expect(screen.getByLabelText('1. Select Investment Account *').value).toBe('91'));
  expect(axios.post).toHaveBeenCalledExactlyOnceWith('/api/investment-accounts', { provider: 'stockbit', account_name: 'Synthetic Portfolio' });
  expect(screen.queryByLabelText(/RDN|SID|nomor rekening/i)).toBeNull();
});

it('distinguishes failed account loading and supports retry', async () => {
  axios.get.mockRejectedValueOnce(new Error('SYNTHETIC_PRIVATE_ERROR'));
  render(<DocumentProcessing/>);
  await screen.findByRole('button', { name: 'Muat ulang akun' });
  expect(screen.queryByText('SYNTHETIC_PRIVATE_ERROR')).toBeNull();
  fireEvent.click(screen.getByText('Muat ulang akun'));
  await screen.findByText('Stockbit — Synthetic Portfolio');
});

it('explains no account selection and blocks wrong provider before any import POST', async () => {
  axios.get.mockResolvedValue({ data: { data: [{ ...account, platform_code: 'bions' }] } });
  render(<DocumentProcessing/>); await process();
  expect(screen.getByText('Please select an investment account before importing.')).toBeTruthy();
  expect(screen.getByText('Import Selected (4)').disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('1. Select Investment Account *'), { target: { value: '91' } });
  expect(screen.getByText(/PDF STOCKBIT hanya dapat diimpor/)).toBeTruthy();
  expect(screen.getByText('Import Selected (4)').disabled).toBe(true);
  expect(axios.post).not.toHaveBeenCalled();
});

it('imports exactly four snapshot items, retries the same key and prevents double click without raw fields', async () => {
  let finish;
  axios.post.mockRejectedValueOnce({ response: { status: 503 } }).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<DocumentProcessing/>); await selectAccount(); await process();
  expect(axios.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Import Selected (4)'));
  await screen.findByText(/Impor belum dapat disimpan/);
  fireEvent.click(screen.getByText('Import Selected (4)')); fireEvent.click(screen.getByText('Importing...'));
  expect(axios.post).toHaveBeenCalledTimes(2);
  const payload = axios.post.mock.calls[0][1];
  expect(axios.post.mock.calls[1][1]).toEqual(payload);
  expect(payload.transactions).toEqual([]);
  expect(payload.snapshot).toMatchObject({ as_of_date: '2020-01-31', coverage: 'UNKNOWN', coverage_confirmed: false, parsed_item_count: 4 });
  expect(payload.snapshot.items).toHaveLength(4);
  expect(payload.snapshot.items[0]).toMatchObject({ quantity: '1', unit: 'UNKNOWN', average_price: '100.00', market_value: '1100.00' });
  expect(JSON.stringify(payload)).not.toMatch(/SYNTHETIC_PRIVATE/);
  finish({ data: { batch_id: 'synthetic-batch', results: [{ status: 'CREATED', snapshot_id: 1 }] } });
  expect(await screen.findByRole('link', { name: 'View in My Portfolio' })).toHaveProperty('href', expect.stringContaining('/portfolio?account=91&as_of=2020-01-31'));
});

it('supports password-required/wrong/correct retries with no secret in storage or API JSON', async () => {
  const storage = vi.spyOn(Storage.prototype, 'setItem');
  PdfExtractor.extractDocument.mockRejectedValueOnce({ code: 'PASSWORD_REQUIRED' }).mockRejectedValueOnce({ code: 'INCORRECT_PASSWORD' }).mockResolvedValue(document);
  axios.post.mockResolvedValue({ data: { results: [{ status: 'CREATED' }] } });
  render(<DocumentProcessing/>); await selectAccount(); await selectFile(); fireEvent.click(screen.getByText('Process Document'));
  const password = await screen.findByLabelText('Password PDF'); expect(password.type).toBe('password');
  fireEvent.change(password, { target: { value: 'SYNTHETIC_PRIVATE_PASSWORD_WRONG' } });
  fireEvent.click(screen.getByText('Show Password')); expect(password.type).toBe('text');
  fireEvent.click(screen.getByText('Hide Password')); expect(password.type).toBe('password');
  fireEvent.click(screen.getByText('Unlock & Process'));
  await screen.findByText(/Password salah/);
  expect(screen.getByLabelText('Password PDF').value).toBe('');
  fireEvent.change(screen.getByLabelText('Password PDF'), { target: { value: 'SYNTHETIC_PRIVATE_PASSWORD_CORRECT' } });
  fireEvent.click(screen.getByText('Unlock & Process'));
  await screen.findByText('Import Selected (4)');
  expect(screen.queryByLabelText('Password PDF')).toBeNull();
  fireEvent.click(screen.getByText('Import Selected (4)'));
  await waitFor(() => expect(axios.post).toHaveBeenCalledOnce());
  expect(JSON.stringify(axios.post.mock.calls)).not.toMatch(/SYNTHETIC_PRIVATE/);
  expect(storage).not.toHaveBeenCalled(); storage.mockRestore();
});

it('cancel/replace clears password and discards an extraction result arriving after cancellation', async () => {
  PdfExtractor.extractDocument.mockRejectedValueOnce({ code: 'PASSWORD_REQUIRED' });
  render(<DocumentProcessing/>); await selectFile(); fireEvent.click(screen.getByText('Process Document'));
  fireEvent.change(await screen.findByLabelText('Password PDF'), { target: { value: 'SYNTHETIC_PRIVATE_PASSWORD' } });
  fireEvent.click(screen.getByText('Cancel processing'));
  expect(screen.queryByLabelText('Password PDF')).toBeNull();
  let complete; let options;
  PdfExtractor.extractDocument.mockImplementationOnce((file, next) => { options = next; return new Promise(resolve => { complete = resolve; }); });
  fireEvent.click(screen.getByText('Process Document'));
  fireEvent.click(screen.getByText('Cancel processing'));
  expect(options.signal.aborted).toBe(true);
  complete(document);
  await waitFor(() => expect(screen.queryByText('Import Selected (4)')).toBeNull());
  await selectFile(); fireEvent.click(screen.getByText('Process Document'));
  await screen.findByText('Import Selected (4)');
  expect(PdfExtractor.extractDocument.mock.calls.at(-1)[1]).not.toHaveProperty('password');
});

it('rejects remote, credential-bearing and non-HTTP API destinations from localhost', () => {
  expect(() => assertPrivacyOrigin('https://remote.example.test/api/source-imports', 'http://localhost:5173')).toThrow();
  expect(() => assertPrivacyOrigin('http://user:secret@localhost:8000', 'http://localhost:5173')).toThrow();
  expect(() => assertPrivacyOrigin('file:///tmp', 'http://localhost:5173')).toThrow();
  expect(() => assertPrivacyOrigin('http://127.0.0.1:8000/api/source-imports', 'http://localhost:5173')).not.toThrow();
});

it('clears the password input on replacement and unmount', async () => {
  PdfExtractor.extractDocument.mockRejectedValue({ code: 'PASSWORD_REQUIRED' });
  const page = render(<DocumentProcessing/>);
  await selectFile(); fireEvent.click(screen.getByText('Process Document'));
  let input = await screen.findByLabelText('Password PDF');
  fireEvent.change(input, { target: { value: 'SYNTHETIC_PRIVATE_PASSWORD' } });
  await selectFile();
  expect(input.value).toBe(''); expect(screen.queryByLabelText('Password PDF')).toBeNull();
  fireEvent.click(screen.getByText('Process Document'));
  input = await screen.findByLabelText('Password PDF');
  fireEvent.change(input, { target: { value: 'SYNTHETIC_PRIVATE_PASSWORD' } });
  page.unmount(); expect(input.value).toBe('');
});
