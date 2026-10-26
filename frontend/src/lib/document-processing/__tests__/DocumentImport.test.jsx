// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from '../../../api/axios';
import DocumentProcessing from '../../../pages/DocumentProcessing';
import { PdfExtractor } from '../PdfExtractor';

vi.mock('../../../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../PdfExtractor', () => ({ PdfExtractor: { extractDocument: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('Privacy Mode structured import confirmation', () => {
  it('sends no raw file, filename or extracted text and waits for the import click', async () => {
    axios.get.mockResolvedValue({ data: { data: [{ id: 1, platform_code: 'stockbit', platform_name: 'Stockbit', account_name: 'Synthetic' }] } });
    axios.post.mockResolvedValue({ data: { replayed: false, results: [{ status: 'CREATED' }] } });
    PdfExtractor.extractDocument.mockResolvedValue({ documentHash: 'a'.repeat(64), text: 'STOCKBIT TRADE CONFIRMATION\nTransaction Date 02/01/2020\n9000001 RG TSTA Synthetic Asset 1 100.00 100.00 10,000.00 0.00\nSYNTHETIC_PRIVATE_TEXT' });
    const { container } = render(<DocumentProcessing />);
    await screen.findByText('Stockbit — Synthetic');
    fireEvent.change(container.querySelector('select'), { target: { value: '1' } });
    const file = new File(['SYNTHETIC_PRIVATE_BYTES'], 'SYNTHETIC_PRIVATE_FILENAME.pdf', { type: 'application/pdf' });
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });
    fireEvent.click(screen.getByText('Process Document'));
    await screen.findByText('Import Selected (1)');
    expect(axios.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Import Selected (1)'));
    await waitFor(() => expect(axios.post).toHaveBeenCalledOnce());
    const [route, payload] = axios.post.mock.calls[0];
    expect(route).toBe('/api/source-imports');
    expect(JSON.stringify(payload)).not.toMatch(/SYNTHETIC_PRIVATE/);
    expect(payload.transactions[0].fee_amount).toBeNull();
    expect(payload.transactions[0].unit).toBe('UNKNOWN');
    expect(payload.source.document_hash).toBe('a'.repeat(64));
  });

  it('uses a unit explicitly reviewed by the user without inferring or converting the parsed quantity', async () => {
    axios.get.mockResolvedValue({ data: { data: [{ id: 1, platform_code: 'stockbit', platform_name: 'Stockbit', account_name: 'Synthetic' }] } });
    axios.post.mockResolvedValue({ data: { replayed: false, results: [{ status: 'CREATED' }] } });
    PdfExtractor.extractDocument.mockResolvedValue({ documentHash: 'b'.repeat(64), text: 'STOCKBIT TRADE CONFIRMATION\nTransaction Date 02/01/2020\n9000001 RG TSTA Synthetic Asset 1 100.00 100.00 10,000.00 0.00' });
    const { container } = render(<DocumentProcessing/>);
    await screen.findByText('Stockbit — Synthetic');
    fireEvent.change(screen.getByLabelText('1. Select Investment Account *'), { target: { value: '1' } });
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [new File(['synthetic'], 'synthetic.pdf', { type: 'application/pdf' })] } });
    fireEvent.click(screen.getByText('Process Document'));
    await screen.findByText('Import Selected (1)');
    expect(screen.getByLabelText('Unit baris 1').value).toBe('UNKNOWN');
    fireEvent.change(screen.getByLabelText('Unit baris 1'), { target: { value: 'SHARE' } });
    expect(axios.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Import Selected (1)'));
    await waitFor(() => expect(axios.post).toHaveBeenCalledOnce());
    expect(axios.post.mock.calls[0][1].transactions[0]).toMatchObject({ unit: 'SHARE', quantity: '100.00' });
  });
});
