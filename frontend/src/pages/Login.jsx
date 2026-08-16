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

  // Login Handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append('username', loginPhone); // OAuth2 expects username/password
      formData.append('password', loginPassword);

      // Endpoint might differ based on your backend config
      const response = await api.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      // Store token and role in localStorage for session management
      localStorage.setItem('token', response.data.access_token);
      
      // 🛡️ Save user role for admin dashboard access
      // If the backend sends the role, it captures it; if not, we temporarily assign the 'admin' role for testing purposes.
      // (Note: In the final version of the product, this must be exactly response.data.role)
      const userRole = response.data.role || (loginPhone === '09123456789' ? 'admin' : 'user');
      localStorage.setItem('role', userRole);

      toast.success('با موفقیت وارد شدید!');
      window.location.href = '/dashboard';
    } catch (error) {
      toast.error(getErrorMessage(error, 'اطلاعات ورود نامعتبر است.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (signupPhone.length < 10) return toast.error('شماره موبایل معتبر نیست');
    setLoading(true);
    try {
      await api.post('/auth/otp', { phone: signupPhone });
      toast.success('کد تایید ارسال شد');
      setStep(2);
    } catch (error) {
      toast.error(getErrorMessage(error, 'خطا در ارسال کد'));
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.post('/auth/signup', {
        phone: signupPhone,
        otp_code: otp,
        first_name: firstName,
        last_name: lastName,
        email: email,
        city: city,
        password: signupPassword
      });

      toast.success('ثبت‌نام با موفقیت انجام شد!');
      
      // 🔴 If it logs you in directly upon registration as well:
      if (response.data.access_token) {
        localStorage.setItem('token', response.data.access_token);
        localStorage.setItem('role', response.data.role || 'user'); // The default new user is 'user'.
        window.location.href = '/dashboard';
      } else {
        setIsLogin(true); // Switch to login form after successful signup
        setLoginPhone(signupPhone);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'خطا در ثبت‌نام. کد تایید را بررسی کنید.'));
    } finally {
      setLoading(false);
    }
  };

  // UI styling classes
  const inputClass = "w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm";
  const btnSuccess = "w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 text-sm";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header Tabs */}
        <div className="flex text-sm font-bold bg-gray-100">
          <button
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-4 transition-colors ${isLogin ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            ورود
          </button>
          <button
            onClick={() => setIsLogin(false)}
            className={`flex-1 py-4 transition-colors ${!isLogin ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            ثبت‌نام
          </button>
        </div>

        <div className="p-8">
          <div className="text-center mb-8">
            <span className="text-4xl mb-3 block">🎟️</span>
            <h1 className="text-2xl font-black text-gray-800">سامانه بلیت ورزشی</h1>
            <p className="text-sm text-gray-500 mt-2">جهت رزرو بلیت وارد حساب کاربری خود شوید</p>
          </div>

          {isLogin ? (
            /* Login Form */
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">شماره موبایل یا نام کاربری</label>
                <input
                  type="text"
                  dir="ltr"
                  placeholder="09123456789"
                  className={inputClass}
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">رمز عبور</label>
                <input
                  type="password"
                  dir="ltr"
                  placeholder="••••••••"
                  className={inputClass}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" disabled={loading} className={`${btnSuccess} mt-2`}>
                {loading ? 'در حال ورود...' : 'ورود به حساب'}
              </button>
            </form>
          ) : (
            /* Signup Form Flow */
            <form onSubmit={step === 1 ? handleSendOtp : handleSignup} className="space-y-4">
              {step === 1 ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">شماره موبایل</label>
                    <input
                      type="tel"
                      dir="ltr"
                      placeholder="09..."
                      className={inputClass}
                      value={signupPhone}
                      onChange={(e) => setSignupPhone(e.target.value)}
                      required
                    />
                  </div>
                  <button type="submit" disabled={loading} className={`${btnSuccess} mt-2`}>
                    {loading ? 'در حال ارسال...' : 'ارسال کد تایید'}
                  </button>
                </>
              ) : (
                <>
                  <div className="bg-blue-50 p-3 rounded-xl mb-4 border border-blue-100 flex justify-between items-center text-xs">
                    <span className="text-blue-800">کد به {signupPhone} ارسال شد</span>
                    <button type="button" onClick={() => setStep(1)} className="text-blue-600 font-bold hover:underline">ویرایش</button>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">کد تایید (OTP)</label>
                    <input type="text" dir="ltr" placeholder="12345" className={`${inputClass} text-center tracking-widest text-lg font-bold`} value={otp} onChange={(e) => setOtp(e.target.value)} required />
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
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">ایمیل</label>
                    <input type="email" dir="ltr" placeholder="test@email.com" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">شهر</label>
                      <input type="text" placeholder="تهران" className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} required />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">رمز عبور (حداقل ۸ حرف)</label>
                      <input type="password" dir="ltr" className={inputClass} value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required minLength={8} />
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className={`${btnSuccess} mt-2`}>
                    {loading ? 'در حال ثبت...' : 'تکمیل ثبت‌نام'}
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