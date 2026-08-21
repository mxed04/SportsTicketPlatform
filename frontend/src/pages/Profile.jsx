import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';

export default function Profile() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('bookings'); // 'bookings' or 'settings'
  const [loading, setLoading] = useState(true);
  
  // Bookings State
  const [bookings, setBookings] = useState([]);
  const [cancelingId, setCancelingId] = useState(null);

  // Profile Settings State
  const [profileData, setProfileData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    city: '',
    phone_number: ''
  });
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // Fetch all initial data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Fetch User Profile Data
        try {
          const userRes = await api.get('/user/profile');
          const userData = userRes.data?.user || userRes.data;

          if (userData) {
            setProfileData({
              first_name: userData.first_name || '',
              last_name: userData.last_name || '',
              email: userData.email || '',
              city: userData.city || '',
              phone_number: userData.phone_number || ''
            });
          }
        } catch (e) {
          console.error("Profile fetch error", e);
        }

        // 2. Fetch Bookings (Now includes QR and tracking_code)
        const response = await api.get('/user/bookings');
        const rawData = response.data?.bookings || response.data || [];
        const bookingsList = Array.isArray(rawData) ? rawData : [];

        const enriched = await Promise.all(
          bookingsList.map(async (b) => {
            const tId = b.ticket_id || b.ticket?.id;
            let price = b.price || b.amount;
            let venue = b.venue_name || b.venue || b.stadium;

            if ((!price || !venue) && tId) {
              try {
                const tRes = await api.get(`/tickets/${tId}`);
                price = price || tRes.data?.price;
                venue = venue || tRes.data?.venue_name || tRes.data?.venue;
              } catch (e) {
                console.error("Ticket fetch error", e);
              }
            }

            let rawStatus = b.reservation_status || b.status || 'pending';
            rawStatus = rawStatus.toLowerCase();
            if (rawStatus === 'confirmed') rawStatus = 'paid';

            return { ...b, fetchedPrice: price, fetchedVenue: venue, effectiveStatus: rawStatus };
          })
        );

        // SMART SORT: Pending first, then closest future match
        const now = new Date().getTime();
        enriched.sort((a, b) => {
          const isPendingA = a.effectiveStatus === 'pending';
          const isPendingB = b.effectiveStatus === 'pending';
          if (isPendingA && !isPendingB) return -1;
          if (!isPendingA && isPendingB) return 1;

          const dateA = new Date(a.match_date || 0).getTime();
          const dateB = new Date(b.match_date || 0).getTime();
          const isFutureA = dateA >= now;
          const isFutureB = dateB >= now;

          if (isFutureA && isFutureB) return dateA - dateB;
          if (!isFutureA && !isFutureB) return dateB - dateA;
          return isFutureA ? -1 : 1;
        });

        setBookings(enriched);
      } catch (error) {
        toast.error('Failed to retrieve user profile data.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // --- Handlers ---

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setUpdatingProfile(true);
    try {
      await api.put('/user/profile', {
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        email: profileData.email,
        city: profileData.city,
      });
      toast.success('Account information updated successfully.');
    } catch (err) {
      toast.error('Failed to update account information.');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleCancelTicket = async (reservationId, status) => {
    const isPending = status === 'pending';
    const msgPend = 'Are you sure you want to cancel this unpaid reservation?';
    const msgPaid = 'Ticket cancellation includes a penalty fee. Continue?';
    if (!window.confirm(isPending ? msgPend : msgPaid)) return;

    setCancelingId(reservationId);
    try {
      const response = await api.post('/payments/cancel', { reservation_id: reservationId });
      const refund = response.data?.refund_amount;
      
      let successMsg = response.data?.message || 'Ticket cancelled.';
      if (!isPending && refund !== undefined && refund > 0) {
        successMsg = `Ticket cancelled. ${Number(refund).toLocaleString()} Toman refunded to your account.`;
      }
      
      toast.success(successMsg, { duration: 6000 });
      setBookings(prev => prev.map(b => (b.reservation_id || b.id) === reservationId ? { ...b, effectiveStatus: 'cancelled' } : b));
    } catch (error) {
      const msg = error.response?.data?.detail || 'Failed to cancel ticket.';
      toast.error(typeof msg === 'string' ? msg : 'Server error');
    } finally {
      setCancelingId(null);
    }
  };

  const handleResumePayment = (booking) => {
    const resId = booking.reservation_id || booking.id;
    const title = (booking.home_team && booking.away_team) ? `${booking.home_team} vs ${booking.away_team}` : (booking.title || 'Event Ticket');
    navigate(`/payment/${resId}`, { state: { finalPrice: booking.fetchedPrice || 0, title, ticketId: booking.ticket_id } });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    toast.success('Signed out successfully.');
    navigate('/');
  };

  // --- Render Helpers ---

  const successfulBookings = bookings.filter(b => b.effectiveStatus === 'paid').length;
  const failedBookings = bookings.filter(b => b.effectiveStatus === 'pending' || b.effectiveStatus === 'failed').length;
  const cancelledBookings = bookings.filter(b => b.effectiveStatus === 'cancelled').length;

  const getStatusVisuals = (status) => {
    if (status === 'paid') return { label: 'Confirmed', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    if (status === 'cancelled') return { label: 'Cancelled', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
    return { label: 'Pending Payment', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
  };

  const inputClass = "w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-indigo-500 text-sm text-white placeholder-gray-500";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 font-sans pb-16">
      {/* Top Navbar */}
      <header className="bg-white/5 border-b border-white/10 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <h1 className="text-lg font-bold text-white tracking-tight">👤 User Profile</h1>
          <div className="flex gap-4">
            {/* 🎧 Added Support Button */}
            <button onClick={() => navigate('/support')} className="text-xs font-semibold text-gray-300 hover:text-white transition-colors flex items-center gap-1">
              <span>🎧 Support</span>
            </button>
            <button onClick={() => navigate('/dashboard')} className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
              ← Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-8">
        
        {/* Profile Card Header */}
        <div className="flex justify-between items-center bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-blue-500 text-white rounded-2xl flex items-center justify-center text-2xl font-bold shadow-lg shadow-indigo-500/20">
              {profileData.first_name ? profileData.first_name[0].toUpperCase() : '👤'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {profileData.first_name} {profileData.last_name}
              </h2>
              <span className="text-xs text-gray-400 inline-block mt-1">
                {profileData.phone_number}
              </span>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 font-bold rounded-xl transition-all text-xs"
          >
            Sign Out
          </button>
        </div>

        {/* Tabs Navigation */}
        <div className="flex gap-4 mb-8 border-b border-white/10 pb-px">
          <button 
            onClick={() => setActiveTab('bookings')}
            className={`pb-3 px-2 font-bold text-xs uppercase tracking-wider transition-all border-b-2 ${
              activeTab === 'bookings' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            🎟️ Booking History
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`pb-3 px-2 font-bold text-xs uppercase tracking-wider transition-all border-b-2 ${
              activeTab === 'settings' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            ⚙️ Account Settings
          </button>
        </div>

        {/* TAB 1: BOOKINGS */}
        {activeTab === 'bookings' && (
          <>
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-white/5 backdrop-blur-xl p-5 rounded-2xl border border-white/10">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Confirmed Payments</span>
                <span className="text-2xl font-black text-emerald-400">{successfulBookings}</span>
              </div>
              <div className="bg-white/5 backdrop-blur-xl p-5 rounded-2xl border border-white/10">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Pending / Unpaid</span>
                <span className="text-2xl font-black text-amber-400">{failedBookings}</span>
              </div>
              <div className="bg-white/5 backdrop-blur-xl p-5 rounded-2xl border border-white/10">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Cancelled Tickets</span>
                <span className="text-2xl font-black text-rose-400">{cancelledBookings}</span>
              </div>
            </div>

            {/* Bookings List */}
            <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 mb-8 shadow-2xl">
              {loading ? (
                <div className="text-center py-12 text-gray-500 animate-pulse text-xs">Loading reservation history...</div>
              ) : bookings.length === 0 ? (
                <div className="text-center py-16 text-gray-400 bg-black/20 rounded-2xl border border-dashed border-white/10">
                  <span className="text-4xl block mb-3">🎫</span>
                  You haven't reserved or purchased any tickets yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {bookings.map((booking, index) => {
                    const bookingId = booking.reservation_id || booking.id;
                    const title = (booking.home_team && booking.away_team) ? `${booking.home_team} vs ${booking.away_team}` : (booking.title || 'Event Ticket');
                    const matchDate = booking.match_date ? new Date(booking.match_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
                    const status = booking.effectiveStatus; 
                    const price = booking.fetchedPrice;
                    const visual = getStatusVisuals(status);

                    return (
                      <div key={bookingId || index} className={`flex flex-col border p-5 rounded-2xl transition-all ${
                        status === 'pending' ? 'bg-amber-500/5 border-amber-500/30' : 'bg-black/30 border-white/10'
                      }`}>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                          <div className="flex-1 w-full mb-4 sm:mb-0">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="font-extrabold text-white text-base">{title}</span>
                              <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border ${visual.color}`}>{visual.label}</span>
                            </div>
                            <div className="text-xs text-gray-400 flex flex-wrap gap-2">
                              <span className="bg-white/5 px-2.5 py-1 border border-white/10 rounded-lg">ID: #{bookingId}</span>
                              {price && <span className="bg-white/5 px-2.5 py-1 border border-white/10 rounded-lg font-semibold text-emerald-400">{Number(price).toLocaleString()} Toman</span>}
                              <span className="bg-white/5 px-2.5 py-1 border border-white/10 rounded-lg">Date: {matchDate}</span>
                            </div>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                            {status === 'pending' && (
                              <button onClick={() => handleResumePayment(booking)} className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all text-xs uppercase tracking-wider animate-pulse shadow-lg shadow-indigo-500/20">
                                Resume Payment
                              </button>
                            )}
                            {(status === 'paid' || status === 'pending') && (
                              <button onClick={() => handleCancelTicket(bookingId, status)} disabled={cancelingId === bookingId} className="w-full sm:w-auto px-5 py-2.5 bg-white/5 border border-rose-500/30 text-rose-400 rounded-xl hover:bg-rose-500/10 font-bold transition-all disabled:opacity-50 text-xs uppercase tracking-wider">
                                {cancelingId === bookingId ? 'Processing...' : 'Cancel Ticket'}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 🧾 E-TICKET QR CODE SECTION */}
                        {status === 'paid' && booking.qr_code && (
                          <div className="mt-5 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center gap-5 bg-white/[0.02] p-4 rounded-xl">
                            <img src={booking.qr_code} alt="Ticket QR" className="w-20 h-20 rounded-xl bg-white p-1.5 shadow-lg" />
                            <div className="text-center sm:text-left">
                              <span className="block text-[10px] text-gray-400 uppercase tracking-wider mb-1">Official E-Ticket / Bank Ref</span>
                              <span className="text-sm font-mono font-bold text-white tracking-widest bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 inline-block shadow-inner">
                                {booking.tracking_code || 'TRK-PENDING'}
                              </span>
                              <p className="text-[9px] text-gray-500 mt-2">Present this QR code at the stadium gates for entry.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* TAB 2: SETTINGS (Edit Profile) */}
        {activeTab === 'settings' && (
          <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl mb-8">
            <h3 className="text-lg font-bold text-white mb-6">Edit Account Details</h3>
            <form onSubmit={handleUpdateProfile} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">First Name</label>
                  <input type="text" className={inputClass} value={profileData.first_name} onChange={e => setProfileData({...profileData, first_name: e.target.value})} required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Last Name</label>
                  <input type="text" className={inputClass} value={profileData.last_name} onChange={e => setProfileData({...profileData, last_name: e.target.value})} required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Email Address</label>
                  <input type="email" className={inputClass} value={profileData.email} onChange={e => setProfileData({...profileData, email: e.target.value})} required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">City</label>
                  <input type="text" className={inputClass} value={profileData.city} onChange={e => setProfileData({...profileData, city: e.target.value})} required />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Phone Number (Locked)</label>
                  <input type="text" className="w-full px-4 py-3 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-gray-500 cursor-not-allowed" value={profileData.phone_number} disabled />
                </div>
              </div>
              <div className="pt-4 flex justify-end">
                <button type="submit" disabled={updatingProfile} className="px-8 py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 text-xs uppercase tracking-wider">
                  {updatingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}