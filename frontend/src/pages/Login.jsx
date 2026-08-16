import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api';

export default function Login() {
  // Modes: 'login', 'signup', 'forgot'
  const [authMode, setAuthMode] = useState('login');
  const [loading, setLoading] = useState(false);

  // Shared States
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  
  // Signup Specific States
  const [step, setStep] = useState(1); // Step 1: Phone, Step 2: Details/OTP
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');

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

  // --- Handlers ---

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append('username', phone);
      formData.append('password', password);

      const res = await api.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      const token = res.data.access_token;
      if (token) {
        localStorage.setItem('token', token);
        toast.success('ورود موفقیت‌آمیز بود!');
        window.location.href = '/dashboard';
      } else {
        toast.error('توکن دریافت نشد.');
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'شماره تماس یا رمز عبور اشتباه است.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSignupRequestOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/users/request-otp', { phone_number: phone });
      toast.success('کد تایید ارسال شد. لطفاً فرم را تکمیل کنید.');
      setStep(2);
    } catch (err) {
      toast.error(getErrorMessage(err, 'خطا در ارسال کد تایید'));
    } finally {
      setLoading(false);
    }
  };

  const handleSignupComplete = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/users/register', {
        phone_number: phone,
        otp_code: otp,
        first_name: firstName,
        last_name: lastName,
        email: email,
        city: city,
        password: password,
      });
      toast.success('ثبت‌نام با موفقیت انجام شد! حالا وارد شوید.');
      setAuthMode('login');
      setStep(1);
    } catch (err) {
      toast.error(getErrorMessage(err, 'خطا در تکمیل ثبت‌نام'));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotRequestOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/users/request-otp', { phone_number: phone });
      toast.success('کد بازیابی ارسال شد.');
      setStep(2);
    } catch (err) {
      toast.error(getErrorMessage(err, 'خطا در ارسال کد بازیابی'));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotComplete = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Assuming a standard reset password endpoint
      await api.post('/users/reset-password', {
        phone_number: phone,
        otp_code: otp,
        new_password: password,
      });
      toast.success('رمز عبور با موفقیت تغییر کرد! حالا وارد شوید.');
      setAuthMode('login');
      setStep(1);
      setPassword('');
    } catch (err) {
      toast.error(getErrorMessage(err, 'خطا در تغییر رمز عبور'));
    } finally {
      setLoading(false);
    }
  };

  // --- Render Helpers ---

  const inputClass = "w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm";
  const btnPrimary = "w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-md disabled:opacity-50 text-sm";

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4" dir="rtl">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
        
        {/* Header Tabs */}
        <div className="flex border-b border-gray-100 text-sm font-bold">
          <button
            className={`flex-1 py-4 text-center transition-colors ${authMode === 'login' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
            onClick={() => { setAuthMode('login'); setStep(1); setPassword(''); }}
          >
            ورود
          </button>
          <button
            className={`flex-1 py-4 text-center transition-colors ${authMode === 'signup' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
            onClick={() => { setAuthMode('signup'); setStep(1); setPassword(''); }}
          >
            ثبت‌نام
          </button>
        </div>

        <div className="p-8">
          <div className="text-center mb-8">
            <span className="text-4xl block mb-3">🎟️</span>
            <h2 className="text-2xl font-black text-gray-800">سامانه بلیت‌فروشی</h2>
            <p className="text-xs text-gray-500 mt-2 font-medium">سریع‌ترین راه برای حضور در ورزشگاه</p>
          </div>

          {/* LOGIN FORM */}
          {authMode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">شماره موبایل</label>
                <input type="tel" dir="ltr" placeholder="09120000000" className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">رمز عبور</label>
                <input type="password" dir="ltr" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div className="flex justify-start">
                <button 
                  type="button" 
                  onClick={() => { setAuthMode('forgot'); setStep(1); setPassword(''); }}
                  className="text-xs text-blue-600 font-bold hover:underline"
                >
                  رمز عبور خود را فراموش کرده‌اید؟
                </button>
              </div>
              <button type="submit" disabled={loading} className={btnPrimary}>
                {loading ? 'در حال بررسی...' : 'ورود به حساب کاربری'}
              </button>
            </form>
          )}

          {/* SIGNUP FORM */}
          {authMode === 'signup' && (
            <form onSubmit={step === 1 ? handleSignupRequestOtp : handleSignupComplete} className="space-y-4">
              {step === 1 ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">شماره موبایل</label>
                    <input type="tel" dir="ltr" placeholder="09120000000" className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} required />
                  </div>
                  <button type="submit" disabled={loading} className={btnPrimary}>
                    {loading ? 'در حال ارسال...' : 'دریافت کد تایید'}
                  </button>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">کد تایید (OTP)</label>
                      <input type="text" dir="ltr" placeholder="1234" className={inputClass} value={otp} onChange={(e) => setOtp(e.target.value)} required />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">رمز عبور جدید</label>
                      <input type="password" dir="ltr" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">نام</label>
                      <input type="text" className={inputClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">نام خانوادگی</label>
                      <input type="text" className={inputClass} value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">ایمیل</label>
                      <input type="email" dir="ltr" placeholder="test@email.com" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">شهر</label>
                      <input type="text" placeholder="تهران" className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} required />
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className={`${btnPrimary} bg-green-600 hover:bg-green-700`}>
                    {loading ? 'در حال ثبت...' : 'تکمیل ثبت‌نام'}
                  </button>
                </>
              )}
            </form>
          )}

          {/* FORGOT PASSWORD FORM */}
          {authMode === 'forgot' && (
            <form onSubmit={step === 1 ? handleForgotRequestOtp : handleForgotComplete} className="space-y-4">
              <div className="bg-yellow-50 text-yellow-800 p-3 rounded-xl text-xs font-medium mb-4">
                برای بازیابی رمز عبور، ابتدا شماره موبایل خود را وارد کنید تا کد تایید برای شما ارسال شود.
              </div>
              
              {step === 1 ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">شماره موبایل ثبت‌شده</label>
                    <input type="tel" dir="ltr" placeholder="09120000000" className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} required />
                  </div>
                  <button type="submit" disabled={loading} className={btnPrimary}>
                    {loading ? 'در حال ارسال...' : 'ارسال کد بازیابی'}
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">کد بازیابی (OTP)</label>
                    <input type="text" dir="ltr" placeholder="1234" className={inputClass} value={otp} onChange={(e) => setOtp(e.target.value)} required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">رمز عبور جدید</label>
                    <input type="password" dir="ltr" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
                  </div>
                  <button type="submit" disabled={loading} className={`${btnPrimary} bg-green-600 hover:bg-green-700`}>
                    {loading ? 'در حال ثبت...' : 'تغییر رمز عبور'}
                  </button>
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}