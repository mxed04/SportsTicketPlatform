import axios from 'axios';

// Creating a dedicated instance of Axios
const api = axios.create({
  baseURL: 'http://localhost:8000/api', // FastAPI backend URL
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor for automatically injecting token into all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;