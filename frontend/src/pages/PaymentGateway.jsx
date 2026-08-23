import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';

export default function PaymentGateway() {
  const { reservationId } = useParams(); // Get ID from URL (/payment/:id)
  const navigate = useNavigate();
  const location = useLocation();
  
  // States to hold dynamic data
  const [finalPrice, setFinalPrice] = useState(0);
  const [title, setTitle] = useState('Loading Event...');
  const [loadingDetails, setLoadingDetails] = useState(true);
  
  const [processing, setProcessing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 minutes TTL

  // 🔥 EFFECT 1: Fetch Reservation Details (Anti-Refresh Logic)
  useEffect(() => {
    const fetchReservationData = async () => {
      setLoadingDetails(true);
      try {
        // 1. Try to use data passed via navigation state first (fastest)
        if (location.state?.finalPrice && location.state?.title) {
          setFinalPrice(location.state.finalPrice);
          setTitle(location.state.title);
          setLoadingDetails(false);
          // Optional: You still might want to verify status with backend
          return; 
        }

        // 2. Fallback: If state is lost (e.g. refresh), fetch from backend
        // We fetch all user bookings and find this specific reservation
        const bRes = await api.get('/user/bookings');
        const rawData = bRes.data?.bookings || bRes.data || [];
        const bookingsList = Array.isArray(rawData) ? rawData : [];

        // Find current reservation by ID (handling different field names)
        const currentRes = bookingsList.find(b => (b.reservation_id || b.id) == reservationId);

        if (!currentRes) {
          throw new Error('Reservation not found in your account.');
        }

        // Check if reservation is already expired or cancelled
        const status = (currentRes.reservation_status || currentRes.status || '').toLowerCase();
        if (status === 'cancelled' || status === 'expired') {
          toast.error('This reservation has expired or been cancelled.');
          navigate('/profile');
          return;
        }
        if (status === 'paid' || status === 'confirmed') {
          toast.success('This ticket is already paid.');
          navigate('/profile');
          return;
        }

        // We have the reservation, now we need ticket price/title
        const tId = currentRes.ticket_id || (currentRes.ticket && currentRes.ticket.id);
        if (tId) {
          const tRes = await api.get(`/tickets/${tId}`);
          const ticketData = tRes.data?.ticket || tRes.data;
          setFinalPrice(ticketData.price || 0);
          setTitle(`${ticketData.home_team} vs ${ticketData.away_team}`);
        } else {
          // Fallback if ticket_id is missing from booking response
          setFinalPrice(currentRes.amount || currentRes.price || 0);
          setTitle(currentRes.title || 'Event Ticket');
        }

      } catch (err) {
        console.error('Payment details fetch error:', err);
        toast.error('Failed to load secure payment details. Redirecting...');
        navigate('/dashboard');
      } finally {
        setLoadingDetails(false);
      }
    };

    fetchReservationData();
  }, [reservationId, location.state, navigate]);


  // 🔥 EFFECT 2: Timer logic for 15 minutes limit (TTL from Redis)
  useEffect(() => {
    if (loadingDetails || finalPrice === 0) return; // Don't start timer yet

    if (timeLeft <= 0) {
      toast.error('Payment time expired! Your reservation has been released.');
      // Auto-navigate to profile, where they can see the cancelled status
      navigate('/profile'); 
      return;
    }
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, navigate, loadingDetails, finalPrice]);

  // Format seconds to MM:SS
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handlePaymentSubmit = async () => {
    if (timeLeft <= 0 || finalPrice === 0) return;

    setProcessing(true);
    // Simulate gateway network delay for realistic UX
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    try {
      // 🚀 FIXED: Added trailing slash to match backend strictly
      await api.post('/payments/', {
        reservation_id: Number(reservationId),
        payment_method: 'online_gateway'
      });
      toast.success('Payment successful! Your e-ticket has been issued.');
      navigate('/profile');
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Transaction failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    if(!window.confirm('Are you sure you want to cancel this secure payment process?')) return;
    setProcessing(true);
    try {
      // 🚀 FIXED: Added trailing slash to match backend strictly
      await api.post('/payments/cancel/', {
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
          <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider font-medium">Official Test Payment Gateway</p>
        </div>

        {/* Glassmorphism Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative">
          
          {/* Main Loading State */}
          {loadingDetails && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-3xl text-sm text-gray-400 animate-pulse">
              Initializing secure transaction...
            </div>
          )}

          {/* Card Visualization */}
          <div className="bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-2xl p-5 mb-8 shadow-lg shadow-emerald-500/20 relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
            <div className="absolute -left-10 -bottom-10 w-24 h-24 bg-black/10 rounded-full blur-lg"></div>
            
            <div className="relative z-10">
              <div className="flex justify-between items-center mb-6">
                <span className="text-xl">💳</span>
                <span className={`text-xs font-bold bg-black/20 px-3 py-1 rounded-full ${timeLeft < 60 ? 'text-rose-200 animate-pulse' : 'text-emerald-100'}`}>
                  {formatTime(timeLeft)}
                </span>
              </div>
              <div className="text-sm text-emerald-100 mb-1 opacity-80">Total Payable Amount</div>
              <div className="text-3xl font-black text-white tracking-tight">
                {finalPrice > 0 ? Number(finalPrice).toLocaleString() : '---'} <span className="text-lg font-medium opacity-80">Toman</span>
              </div>
            </div>
          </div>

          {/* Invoice Summary */}
          <div className="bg-black/30 rounded-2xl p-5 border border-white/5 text-xs text-gray-300 space-y-3 mb-8">
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <span className="text-gray-500">Reservation ID:</span>
              <span className="font-bold text-white uppercase">#{reservationId || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-gray-500">Event Detail:</span>
              <span className="font-bold text-gray-200 truncate max-w-[200px]" title={title}>{title}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handlePaymentSubmit}
              disabled={processing || finalPrice === 0 || timeLeft <= 0 || loadingDetails}
              className={`w-full py-4 rounded-xl text-xs uppercase tracking-wider font-bold transition-all shadow-xl flex items-center justify-center gap-2 ${
                processing || finalPrice === 0 || timeLeft <= 0 || loadingDetails
                  ? 'bg-white/5 text-gray-500 border border-white/10 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
              }`}
            >
              {processing ? (
                <>
                  <span className="animate-spin text-lg">⏳</span> Validating with Redis TTL...
                </>
              ) : finalPrice === 0 ? (
                'Input Required'
              ) : timeLeft <= 0 ? (
                'Lock Expired'
              ) : (
                'Confirm & Pay Now →'
              )}
            </button>
            
            <button
              onClick={handleCancel}
              disabled={processing || loadingDetails}
              className="w-full py-3 rounded-xl text-xs uppercase tracking-wider font-bold text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
            >
              Cancel Reservation
            </button>
          </div>

        </div>
        
        <div className="text-center mt-6 flex items-center justify-center gap-2 text-[10px] text-gray-500 uppercase tracking-widest font-bold">
          <span>🔒 Simulated 256-bit SSL Encryption</span>
        </div>
      </div>
    </div>
  );
}