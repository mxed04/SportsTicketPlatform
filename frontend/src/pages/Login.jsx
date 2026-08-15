import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  // Login States
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup States
  const [step, setStep] = useState(1);
  const [signupPhone, setSignupPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  // Safe Error Handler
  const getErrorMessage = (err, fallback) => {
    const detail = err.response?.data?.detail;
    if (!detail) return fallback;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail.map((e) => e.msg || e.type).join(' | ');
    }
    return fallback;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append('username', loginPhone);
      formData.append('password', loginPassword);

      const response = await api.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      localStorage.setItem('token', response.data.access_token);
      toast.success('ورود با موفقیت انجام شد!');
      window.location.href = '/dashboard';
    } catch (error) {
      toast.error(getErrorMessage(error, 'شماره موبایل یا رمز عبور اشتباه است'));
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (signupPhone.length < 10) return toast.error('شماره موبایل معتبر نیست');
    setLoading(true);
    try {
      await api.post('/auth/otp', { phone_number: signupPhone });
      toast.success('کد تایید ارسال شد (کنسول داکر را ببینید)');
      setStep(2);
    } catch (error) {
      toast.error(getErrorMessage(error, 'خطا در ارسال کد تایید'));
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (signupPassword.length < 8) {
      return toast.error('رمز عبور باید حداقل ۸ کاراکتر باشد');
    }
    setLoading(true);
    try {
      // ارسال دقیق ۷ متغیری که Pydantic بک‌اند نیاز دارد
      await api.post('/auth/signup', {
        phone_number: signupPhone,
        otp_code: otp,
        first_name: firstName,
        last_name: lastName,
        email: email,
        city: city,
        password: signupPassword,
      });
      toast.success('ثبت‌نام انجام شد! حالا وارد شوید.');
      setIsLogin(true);
      setLoginPhone(signupPhone);
      setStep(1);
    } catch (error) {
      toast.error(getErrorMessage(error, 'خطا در ثبت‌نام'));
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full px-4 py-3 rounded-lg bg-gray-50 border ' +
    'border-gray-200 focus:bg-white focus:ring-2 ' +
    'focus:ring-blue-500 outline-none transition-all text-sm';

  const btnPrimary =
    'w-full bg-blue-600 text-white font-bold py-3.5 ' +
    'rounded-lg hover:bg-blue-700 transition-colors mt-2 shadow-md';

  const btnSuccess =
    'w-full bg-green-600 text-white font-bold py-3.5 ' +
    'rounded-lg hover:bg-green-700 transition-colors mt-2 shadow-md';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 font-sans py-10">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-extrabold text-blue-600 mb-6">سامانه بلیت</h2>
          <div className="flex justify-center space-x-4 space-x-reverse border-b border-gray-200">
            <button
              className={`pb-3 px-4 font-bold text-lg transition-all ${
                isLogin ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400'
              }`}
              onClick={() => setIsLogin(true)}
            >
              ورود
            </button>
            <button
              className={`pb-3 px-4 font-bold text-lg transition-all ${
                !isLogin ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400'
              }`}
              onClick={() => setIsLogin(false)}
            >
              ثبت‌نام
            </button>
          </div>
        </div>

        {isLogin ? (
          <form onSubmit={handleLogin} className="space-y-4 mt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">موبایل</label>
              <input type="text" dir="ltr" placeholder="09123456789" className={inputClass} value={loginPhone} onChange={(e) => setLoginPhone(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">رمز عبور</label>
              <input type="password" dir="ltr" placeholder="••••••••" className={inputClass} value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
            </div>
            <button type="submit" disabled={loading} className={btnPrimary}>
              {loading ? 'در حال ورود...' : 'ورود'}
            </button>
          </form>
        ) : step === 1 ? (
          <form onSubmit={handleRequestOtp} className="space-y-4 mt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">شماره موبایل جدید</label>
              <input type="text" dir="ltr" placeholder="09123456789" className={inputClass} value={signupPhone} onChange={(e) => setSignupPhone(e.target.value)} required />
            </div>
            <button type="submit" disabled={loading} className={btnPrimary}>
              {loading ? 'ارسال...' : 'دریافت کد تایید'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignup} className="space-y-4 mt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">کد تایید (پیامک شده)</label>
              <input type="text" dir="ltr" placeholder="123456" className={`${inputClass} text-center tracking-widest text-xl bg-blue-50`} value={otp} onChange={(e) => setOtp(e.target.value)} required />
            </div>
            {/* چیدمان شبکه‌ای برای زیبایی */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">نام</label>
                <input type="text" className={inputClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">نام خانوادگی</label>
                <input type="text" className={inputClass} value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">ایمیل</label>
              <input type="email" dir="ltr" placeholder="test@email.com" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">شهر</label>
                <input type="text" placeholder="تهران" className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">رمز عبور (حداقل ۸)</label>
                <input type="password" dir="ltr" className={inputClass} value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required minLength={8} />
              </div>
            </div>
            <button type="submit" disabled={loading} className={btnSuccess}>
              {loading ? 'کمی صبر کنید...' : 'تکمیل ثبت‌نام'}
            </button>
            <button type="button" onClick={() => setStep(1)} className="w-full text-gray-400 text-xs mt-1 hover:text-gray-600">
              ویرایش شماره
            </button>
          </form>
        )}
      </div>
    </div>
  );
}