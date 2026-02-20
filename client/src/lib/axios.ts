import axios from 'axios';

const axiosInstance = axios.create({
//   baseURL: 'http://localhost:3000/api',
  baseURL: import.meta.env.VITE_API_URL ,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Request interceptor — attach JWT from sessionStorage ─────────────────────
axiosInstance.interceptors.request.use(
  (config) => {
    const stored = sessionStorage.getItem('nexus_user');
    if (stored) {
      try {
        const user = JSON.parse(stored);
        if (user?.token) {
          config.headers.Authorization = `Bearer ${user.token}`;
        }
      } catch {
        // Corrupted storage — ignore
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response interceptor — handle 401 globally ───────────────────────────────
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear stale session and redirect to login
      sessionStorage.removeItem('nexus_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;