import axios from 'axios';

// ایجاد یک نمونه (Instance) از اکسیاس با تنظیمات پایه
const api = axios.create({
  // آدرس پایه بک‌اند شما (FastAPI معمولاً روی پورت 8000 داکر بالا می‌آید)
  baseURL: 'http://localhost:8000/api', 
  headers: {
    'Content-Type': 'application/json',
  },
});

// 🛡️ Request Interceptor: تزریق خودکار توکن امنیتی به تمام درخواست‌ها
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      // اضافه کردن توکن JWT به هدر Authorization
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 🛡️ Response Interceptor: مدیریت خطاهای سراسری (مثل منقضی شدن توکن)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // اگر سرور خطای 401 (عدم دسترسی / توکن نامعتبر) داد
    if (error.response && error.response.status === 401) {
      // توکن منقضی شده است؛ پاکسازی حافظه و هدایت به صفحه ورود
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      
      // جلوگیری از ریدایرکت‌های بی‌نهایت در صفحه اصلی
      if (window.location.pathname !== '/') {
        window.location.href = '/'; 
      }
    }
    return Promise.reject(error);
  }
);

export default api;