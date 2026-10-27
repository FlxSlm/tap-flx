import axios from 'axios';
import { assertPrivacyOrigin } from './privacyOrigin';

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
    withCredentials: true, // Required for Sanctum cookie-based auth
    withXSRFToken: true,   // Required for Axios 1.x to send XSRF-TOKEN on cross-origin requests
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    }
});

axiosInstance.interceptors.request.use(config => {
    if (typeof window !== 'undefined') {
        try {
            const base = new URL(config.baseURL || window.location.origin, window.location.href);
            assertPrivacyOrigin(new URL(config.url || '', base).href, window.location.href);
        } catch {
            const blocked = new Error('API origin is not permitted for this local workspace.');
            blocked.code = 'API_ORIGIN_BLOCKED';
            throw blocked;
        }
    }
    return config;
});

export default axiosInstance;
