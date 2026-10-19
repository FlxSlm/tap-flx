import axios from 'axios';

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
    withCredentials: true, // Required for Sanctum cookie-based auth
    withXSRFToken: true,   // Required for Axios 1.x to send XSRF-TOKEN on cross-origin requests
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    }
});

export default axiosInstance;
