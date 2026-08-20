import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';

export default function PaymentGateway() {
  const { reservationId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // FIX: Read dynamic price, default to 0 to prevent fake 200000 display
  const finalPrice = location.state?.finalPrice || 0;
  const title = location.state?.title || 'Sports Event Ticket';

  const [processing, setProcessing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15 * 60);

  // Timer logic for 15 minutes limit
  useEffect(() => {
    if (timeLeft <= 0) {
      toast.error('Payment time expired! Your reservation has been cancelled.');
      navigate('/profile');
      return;
    }
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, navigate]);

  // Format seconds to MM:SS
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handlePaymentSubmit = async () => {
    setProcessing(true);
    // Simulate gateway delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      await api.post('/payments', {
        reservation_id: Number(reservationId),
        payment_method: 'online_gateway'
      });
      toast.success('Payment successful! Your e-ticket has been issued.');
      navigate('/profile');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Transaction failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    if(!window.confirm('Are you sure you want to cancel this payment?')) return;
    setProcessing(true);
    try {
      await api.post('/payments/cancel', {
        reservation_id: Number(reservationId)
      });
      toast.success('Reservation cancelled successfully.');
      navigate('/dashboard');
    } catch (err) {
      toast.error('Failed to cancel the reservation.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 font-sans flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-[150px] pointer-events-none"></div>

      <div className="max-w-md w-full relative z-10">
        
        {/* Fake Gateway Header */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center justify-center gap-2">
            <span className="text-emerald-500">Secure</span> Pay
          </h2>
          <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider font-medium">Test Payment Gateway</p>
        </div>

        {/* Glassmorphism Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          
          {/* Card Visualization */}
          <div className="bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-2xl p-5 mb-8 shadow-lg shadow-emerald-500/20 relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
            <div className="absolute -left-10 -bottom-10 w-24 h-24 bg-black/10 rounded-full blur-lg"></div>
            
            <div className="relative z-10">
              <div className="flex justify-between items-center mb-6">
                <span className="text-xl">💳</span>
                <span className="text-xs font-bold bg-black/20 px-3 py-1 rounded-full text-emerald-100">
                  {formatTime(timeLeft)}
                </span>
              </div>
              <div className="text-sm text-emerald-100 mb-1 opacity-80">Total Amount</div>
              <div className="text-3xl font-black text-white tracking-tight">
                {Number(finalPrice).toLocaleString()} <span className="text-lg font-medium opacity-80">Toman</span>
              </div>
            </div>
          </div>

          {/* Invoice Summary */}
          <div className="bg-black/30 rounded-2xl p-5 border border-white/5 text-xs text-gray-300 space-y-3 mb-8">
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <span className="text-gray-500">Reservation ID:</span>
              <span className="font-bold text-white uppercase">#{reservationId}</span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-gray-500">Event Detail:</span>
              <span className="font-bold text-gray-200">{title}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handlePaymentSubmit}
              disabled={processing || finalPrice === 0 || timeLeft <= 0}
              className={`w-full py-4 rounded-xl text-xs uppercase tracking-wider font-bold transition-all shadow-xl flex items-center justify-center gap-2 ${
                processing || finalPrice === 0 || timeLeft <= 0
                  ? 'bg-white/5 text-gray-500 border border-white/10 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
              }`}
            >
              {processing ? (
                <>
                  <span className="animate-spin text-lg">⏳</span> Processing...
                </>
              ) : (
                'Pay & Issue Ticket'
              )}
            </button>
            
            <button
              onClick={handleCancel}
              disabled={processing}
              className="w-full py-3 rounded-xl text-xs uppercase tracking-wider font-bold text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              Cancel Payment
            </button>
          </div>

        </div>
        
        <div className="text-center mt-6 flex items-center justify-center gap-2 text-[10px] text-gray-500 uppercase tracking-widest font-bold">
          <span>🔒 256-bit SSL Encryption</span>
        </div>
      </div>
    </div>
  );
}