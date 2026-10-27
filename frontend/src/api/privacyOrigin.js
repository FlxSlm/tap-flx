const loopback = host => ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);

export function assertPrivacyOrigin(target, page) {
  try {
    const origin = new URL(page);
    const api = new URL(target, origin);
    if (!['http:', 'https:'].includes(api.protocol) || api.username || api.password || (loopback(origin.hostname) && !loopback(api.hostname))) throw new Error();
  } catch {
    const error = new Error('API origin is not permitted for this local workspace.');
    error.code = 'API_ORIGIN_BLOCKED';
    throw error;
  }
}
