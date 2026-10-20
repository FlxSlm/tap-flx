// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from '../../../api/axios';
import Transactions from '../../../pages/Transactions';

vi.mock('../../../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('manual cash events keep unavailable quantity, price and fee null', async () => {
  axios.get.mockImplementation(url => Promise.resolve({ data: url.includes('investment-accounts')
    ? { data: [{ id: 1, platform_name: 'Synthetic', platform_code: 'stockbit', account_name: 'Synthetic' }] }
    : { data: [], meta: { current_page: 1, last_page: 1 } } }));
  axios.post.mockResolvedValue({ data: {} });
  const { container } = render(<Transactions />);
  await screen.findByText('No transactions found. Click "+ New Transaction" to add one.');
  fireEvent.click(screen.getByText('+ New Transaction'));
  const set = (name, value) => fireEvent.change(container.querySelector(`[name="${name}"]`), { target: { name, value } });
  set('investment_account_id', '1');
  set('type', 'DIVIDEND');
  set('symbol', 'TSTA');
  set('transaction_date', '2020-01-02T00:00');
  set('total_amount', '50');
  fireEvent.submit(container.querySelector('form'));
  await waitFor(() => expect(axios.post).toHaveBeenCalledOnce());
  expect(axios.post.mock.calls[0][1]).toMatchObject({ quantity: null, price: null, fee_amount: null, total_amount: '50' });
});
