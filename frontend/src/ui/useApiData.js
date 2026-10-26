import { useEffect, useState } from 'react';
import axios from '../api/axios';

export default function useApiData(url, revision = 0) {
  const [result, setResult] = useState({ key: null, status: 'idle', data: null });
  const [retryIndex, setRetryIndex] = useState(0);
  const key = `${url}:${revision}:${retryIndex}`;
  useEffect(() => {
    if (!url) return;
    let active = true;
    const controller = new AbortController();
    axios.get(url, { signal: controller.signal }).then(response => {
      if (active) setResult({ key, status: 'ready', data: response.data });
    }).catch(() => {
      if (active) setResult({ key, status: 'error', data: null });
    });
    return () => { active = false; controller.abort(); };
  }, [url, key]);
  const state = !url ? { status: 'idle', data: null } : result.key === key ? result : { status: 'loading', data: null };
  return { ...state, retry: () => setRetryIndex(value => value + 1) };
}
