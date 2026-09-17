import axios from 'axios';

const axiosInstance = axios.create({
    baseURL: 'http://localhost:8000',
    withCredentials: true, // Required for Sanctum cookie-based auth
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    }
});

export default axiosInstance;
