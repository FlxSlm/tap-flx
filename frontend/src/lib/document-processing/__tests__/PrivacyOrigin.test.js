// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import client from '../../../api/axios';

it('blocks a remote absolute request before the axios adapter can transmit it', async () => {
  const adapter = vi.fn();
  await expect(client.post('https://remote.example.test/api/source-imports', { snapshot: 'SYNTHETIC_PRIVATE_MARKER' }, { adapter })).rejects.toMatchObject({ code: 'API_ORIGIN_BLOCKED' });
  expect(adapter).not.toHaveBeenCalled();
});

it('allows a loopback API request with credentials and XSRF enabled', async () => {
  const adapter = vi.fn(async config => ({ data: { safe: true }, status: 200, statusText: 'OK', headers: {}, config }));
  await expect(client.get('/api/user', { baseURL: 'http://localhost:8026', adapter })).resolves.toMatchObject({ data: { safe: true } });
  expect(adapter).toHaveBeenCalledOnce();
  expect(adapter.mock.calls[0][0]).toMatchObject({ withCredentials: true, withXSRFToken: true });
});
