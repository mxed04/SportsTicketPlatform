import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';

export default function Payment() {
  const { reservationId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Retrieve state or fallback values
  const ticketPrice = location.state?.finalPrice || location.state?.price || 1500000;
  const ticketTitle = location.state?.title || 'Sports Event Ticket';

  const [processing, setProcessing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(900); // 15 minutes Redis Lock TTL
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (timeLeft <= 0) {
      setExpired(true);
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handlePayment = async () => {
    if (expired) {
      toast.error('Seat lock expired. Please reserve again.');
      return;
    }

    setProcessing(true);
    try {
      await api.post('/payments/pay', {
        reservation_id: Number(reservationId),
        payment_method: 'credit_card',
      });
      toast.success('Payment successful! Your ticket has been issued.');
      navigate('/profile');
    } catch (error) {
      const detail = error.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Payment transaction failed.');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this reservation?')) return;
    try {
      await api.post('/payments/cancel', {
        reservation_id: Number(reservationId),
      });
      toast.success('Reservation cancelled successfully.');
      navigate('/dashboard');
    } catch (error) {
      toast.error('Failed to cancel reservation.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 font-sans flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-600/20 rounded-full blur-[130px] pointer-events-none"></div>

      <div className="max-w-md w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative z-10">
        
        {/* Header Icon & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-white/10 mb-4">
            <span className="text-3xl">💳</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Checkout Gateway</h2>
          <p className="text-xs text-gray-400 mt-1 font-medium">{ticketTitle}</p>
        </div>

        {/* Countdown Timer Card */}
        <div className={`p-5 rounded-2xl border text-center mb-6 transition-all ${
          expired ? 'bg-rose-500/10 border-rose-500/30' : 'bg-amber-500/10 border-amber-500/30'
        }`}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
            {expired ? 'Reservation Lock Expired' : 'Temporary Seat Lock Timer'}
          </span>
          <div className={`text-4xl font-black font-mono tracking-wider ${
            expired ? 'text-rose-400' : 'text-amber-400 animate-pulse'
          }`}>
            {expired ? '00:00' : formatTime(timeLeft)}
          </div>
          <p className="text-[11px] text-gray-400 mt-2">
            {expired ? 'Your seat has been released back to pool.' : 'Complete payment before lock expires.'}
          </p>
        </div>

        {/* Payment Summary */}
        <div className="bg-black/40 rounded-2xl p-5 border border-white/5 text-xs text-gray-300 space-y-3 mb-8">
          <div className="flex justify-between items-center pb-2 border-b border-white/5">
            <span className="text-gray-500">Reservation ID:</span>
            <span className="font-bold text-white">#{reservationId}</span>
          </div>
          <div className="flex justify-between items-center pb-2 border-b border-white/5">
            <span className="text-gray-500">Payment Method:</span>
            <span className="font-semibold text-gray-200">Mock Credit Card Gateway</span>
          </div>
          <div className="flex justify-between items-center pt-1">
            <span className="text-gray-400 font-bold">Total Payable Amount:</span>
            <span className="text-lg font-black text-emerald-400">
              {Number(ticketPrice).toLocaleString()} Toman
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handlePayment}
            disabled={processing || expired}
            className={`w-full py-4 rounded-xl text-xs uppercase tracking-wider font-bold transition-all shadow-xl ${
              processing || expired
                ? 'bg-white/5 text-gray-500 border border-white/10 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-500/20'
            }`}
          >
            {processing ? 'Processing Transaction...' : expired ? 'Seat Lock Expired' : 'Confirm & Pay Now →'}
          </button>

          <button
            onClick={handleCancel}
            disabled={processing}
            className="w-full py-3 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 transition-colors uppercase tracking-wider"
          >
            Cancel Reservation
          </button>
        </div>

      </div>
    </div>
  );
}