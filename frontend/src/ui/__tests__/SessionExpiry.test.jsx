// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, act } from '@testing-library/react';
import client from '../../api/axios';
import { AuthProvider, useAuth } from '../../context/AuthContext';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function State() { const { user, loading } = useAuth(); return <div>{loading ? 'loading' : user ? 'signed in' : 'signed out'}</div>; }
it('clears stale React authentication when a protected request returns 401', async () => {
  vi.spyOn(client, 'get').mockResolvedValue({ data: { id: 1 } });
  render(<AuthProvider><State/></AuthProvider>);
  expect(await screen.findByText('signed in')).toBeTruthy();
  await act(async () => {
    await expect(client.request({ method: 'GET', url: '/api/investment-accounts', adapter: async config => {
      throw { config, response: { status: 401 } };
    } })).rejects.toMatchObject({ response: { status: 401 } });
  });
  expect(screen.getByText('signed out')).toBeTruthy();
});
