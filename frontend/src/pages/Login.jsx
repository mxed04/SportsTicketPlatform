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
  const [step, setStep] = useState(1);
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
        toast.success('Successfully logged in!');
        window.location.href = '/dashboard';
      } else {
        toast.error('Failed to retrieve token.');
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Invalid phone number or password.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSignupRequestOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/otp', { phone_number: phone });
      toast.success('Verification code sent. Please check your phone.');
      setStep(2);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to send OTP code.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSignupComplete = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/signup', {
        phone_number: phone,
        otp_code: otp,
        first_name: firstName,
        last_name: lastName,
        email: email,
        city: city,
        password: password,
      });
      toast.success('Account created successfully! You can now log in.');
      setAuthMode('login');
      setStep(1);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to complete registration.'));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotRequestOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/otp', { phone_number: phone });
      toast.success('Recovery code sent to your phone.');
      setStep(2);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to send recovery code.'));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotComplete = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        phone_number: phone,
        otp_code: otp,
        new_password: password,
      });
      toast.success('Password updated successfully! Please log in.');
      setAuthMode('login');
      setStep(1);
      setPassword('');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to reset password.'));
    } finally {
      setLoading(false);
    }
  };

  // --- Premium UI Helpers ---
  const inputClass = "w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm text-white placeholder-gray-500";
  const btnPrimary = "w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-500/30 disabled:opacity-50 text-sm";
  const btnSuccess = "w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-500/30 disabled:opacity-50 text-sm";

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background Ambient Glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Glassmorphism Card */}
      <div className="max-w-md w-full bg-white/5 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-white/10 z-10">
        
        {/* Header Tabs */}
        <div className="flex border-b border-white/10 text-sm font-semibold">
          <button
            className={`flex-1 py-4 text-center transition-all duration-300 ${authMode === 'login' ? 'bg-white/5 text-indigo-400 border-b-2 border-indigo-500' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'}`}
            onClick={() => { setAuthMode('login'); setStep(1); setPassword(''); }}
          >
            Sign In
          </button>
          <button
            className={`flex-1 py-4 text-center transition-all duration-300 ${authMode === 'signup' ? 'bg-white/5 text-indigo-400 border-b-2 border-indigo-500' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'}`}
            onClick={() => { setAuthMode('signup'); setStep(1); setPassword(''); }}
          >
            Create Account
          </button>
        </div>

        <div className="p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-blue-500/20 border border-white/10 mb-4">
              <span className="text-3xl">🎟️</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Sports<span className="text-indigo-500">Ticket</span></h2>
            <p className="text-xs text-gray-400 mt-2 font-medium">Premium Event Reservation Platform</p>
          </div>

          {/* LOGIN FORM */}
          {authMode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Phone Number</label>
                <input type="tel" placeholder="e.g. 09120000000" className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
              <div>
                <div className="flex justify-between mb-1.5 items-center">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Password</label>
                  <button type="button" onClick={() => { setAuthMode('forgot'); setStep(1); setPassword(''); }} className="text-xs text-indigo-400 font-medium hover:text-indigo-300 transition-colors">
                    Forgot Password?
                  </button>
                </div>
                <input type="password" placeholder="••••••••" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <button type="submit" disabled={loading} className={`${btnPrimary} mt-6`}>
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>
            </form>
          )}

          {/* SIGNUP FORM */}
          {authMode === 'signup' && (
            <form onSubmit={step === 1 ? handleSignupRequestOtp : handleSignupComplete} className="space-y-4">
              {step === 1 ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Phone Number</label>
                    <input type="tel" placeholder="09120000000" className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} required />
                  </div>
                  <button type="submit" disabled={loading} className={`${btnPrimary} mt-2`}>
                    {loading ? 'Sending Request...' : 'Send Verification Code'}
                  </button>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">OTP Code</label>
                      <input type="text" placeholder="1234" className={inputClass} value={otp} onChange={(e) => setOtp(e.target.value)} required />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Password</label>
                      <input type="password" placeholder="Min. 8 chars" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">First Name</label>
                      <input type="text" placeholder="John" className={inputClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Last Name</label>
                      <input type="text" placeholder="Doe" className={inputClass} value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Email</label>
                      <input type="email" placeholder="john@email.com" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">City</label>
                      <input type="text" placeholder="London" className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} required />
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className={`${btnSuccess} mt-2`}>
                    {loading ? 'Creating Account...' : 'Complete Registration'}
                  </button>
                </>
              )}
            </form>
          )}

          {/* FORGOT PASSWORD FORM */}
          {authMode === 'forgot' && (
            <form onSubmit={step === 1 ? handleForgotRequestOtp : handleForgotComplete} className="space-y-4">
              <div className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 p-4 rounded-xl text-xs font-medium mb-6 leading-relaxed">
                Enter your registered phone number. We will send you a verification code to reset your password.
              </div>
              
              {step === 1 ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Registered Phone</label>
                    <input type="tel" placeholder="09120000000" className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} required />
                  </div>
                  <button type="submit" disabled={loading} className={`${btnPrimary} mt-2`}>
                    {loading ? 'Sending Request...' : 'Send Recovery Code'}
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Recovery OTP</label>
                    <input type="text" placeholder="1234" className={inputClass} value={otp} onChange={(e) => setOtp(e.target.value)} required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">New Password</label>
                    <input type="password" placeholder="Min. 8 chars" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
                  </div>
                  <button type="submit" disabled={loading} className={`${btnSuccess} mt-2`}>
                    {loading ? 'Resetting...' : 'Update Password'}
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