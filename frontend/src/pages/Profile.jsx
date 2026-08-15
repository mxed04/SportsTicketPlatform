import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';

export default function Profile() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelingId, setCancelingId] = useState(null);

  // Fetch bookings and automatically enrich missing ticket details (Price & Venue)
  useEffect(() => {
    const fetchBookingsAndTickets = async () => {
      try {
        const response = await api.get('/user/bookings');
        const rawBookings = response.data?.bookings || response.data || [];
        const bookingsList = Array.isArray(rawBookings) ? rawBookings : [];

        // Auto-fetch missing ticket information for each reservation
        const enrichedBookings = await Promise.all(
          bookingsList.map(async (b) => {
            const ticketId = b.ticket_id || b.ticket?.id;
            let extraPrice = b.price || b.amount;
            let extraVenue = b.venue_name || b.venue || b.stadium;
            let extraSport = b.sport_type;

            // Fetch details directly from /tickets/{id} if price or venue is missing
            if ((!extraPrice || !extraVenue) && ticketId) {
              try {
                const tRes = await api.get(`/tickets/${ticketId}`);
                extraPrice = extraPrice || tRes.data?.price;
                extraVenue = extraVenue || tRes.data?.venue_name || tRes.data?.venue;
                extraSport = extraSport || tRes.data?.sport_type;
              } catch (e) {
                console.error(`Failed to fetch ticket details for ID ${ticketId}`, e);
              }
            }

            return {
              ...b,
              fetchedPrice: extraPrice,
              fetchedVenue: extraVenue,
              fetchedSport: extraSport
            };
          })
        );

        setBookings(enrichedBookings);
      } catch (error) {
        console.error('Error fetching bookings:', error);
        toast.error('خطا در دریافت سابقه خریدها');
      } finally {
        setLoading(false);
      }
    };

    fetchBookingsAndTickets();
  }, []);

  // Handle ticket cancellation with penalty logic
  const handleCancelTicket = async (reservationId) => {
    if (!window.confirm('آیا از لغو این بلیت اطمینان دارید؟ جریمه کنسلی طبق قوانین کسر خواهد شد.')) {
      return;
    }

    setCancelingId(reservationId);
    try {
      const response = await api.post('/tickets/cancel', {
        reservation_id: reservationId
      });
      
      toast.success(response.data?.message || 'بلیت با موفقیت لغو شد.');
      
      // Update local state visually
      setBookings(prevBookings => 
        prevBookings.map(b => {
          const currentId = b.reservation_id || b.id;
          return currentId === reservationId ? { ...b, status: 'cancelled' } : b;
        })
      );
    } catch (error) {
      const msg = error.response?.data?.detail || 'خطا در لغو بلیت';
      toast.error(typeof msg === 'string' ? msg : 'خطای سرور');
    } finally {
      setCancelingId(null);
    }
  };

  // Metrics calculation for user summary
  const totalBookings = bookings.length;
  const activeBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'paid' || !b.status).length;
  const cancelledBookings = bookings.filter(b => b.status === 'cancelled').length;

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-12">
      {/* Header Navigation */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">👤 پروفایل من</h1>
          <button 
            onClick={() => navigate('/dashboard')}
            className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            بازگشت به داشبورد ←
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        
        {/* User Statistics Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs text-gray-500 font-bold block mb-1">کل رزروها</span>
              <span className="text-2xl font-black text-gray-800">{totalBookings}</span>
            </div>
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold text-lg">
              🎟️
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs text-gray-500 font-bold block mb-1">بلیت‌های فعال</span>
              <span className="text-2xl font-black text-green-600">{activeBookings}</span>
            </div>
            <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center font-bold text-lg">
              ✅
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs text-gray-500 font-bold block mb-1">لغو شده</span>
              <span className="text-2xl font-black text-red-600">{cancelledBookings}</span>
            </div>
            <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center font-bold text-lg">
              ❌
            </div>
          </div>
        </div>

        {/* Booking History List */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-4">سابقه خرید و رزرو بلیت</h2>
          
          {loading ? (
            <div className="text-center py-8 text-gray-500 animate-pulse">در حال دریافت و تکمیل اطلاعات بلیت‌ها...</div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              شما هنوز هیچ بلیتی خریداری نکرده‌اید.
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map((booking, index) => {
                const bookingId = booking.reservation_id || booking.id;
                const homeTeam = booking.home_team || '';
                const awayTeam = booking.away_team || '';
                
                const title = (homeTeam && awayTeam) ? `${homeTeam} vs ${awayTeam}` : (booking.title || 'بلیت مسابقه');
                
                const matchDate = booking.match_date 
                  ? new Date(booking.match_date).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }) 
                  : 'تاریخ نامشخص';
                  
                const status = booking.status || 'paid'; 
                const quantity = booking.quantity || 1;

                // Values fetched dynamically from ticket details
                const price = booking.fetchedPrice;
                const venue = booking.fetchedVenue;
                const sport = booking.fetchedSport;

                return (
                  <div key={bookingId || index} className="flex flex-col sm:flex-row justify-between items-center bg-gray-50 border border-gray-100 p-4 rounded-xl hover:shadow-md transition-shadow">
                    <div className="flex-1 w-full mb-4 sm:mb-0">
                      
                      {/* Title & Status */}
                      <div className="flex items-center gap-3 mb-3">
                        <span className="font-black text-gray-900 text-lg">{title}</span>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                          status === 'confirmed' || status === 'paid' ? 'bg-green-100 text-green-700' :
                          status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {status === 'confirmed' || status === 'paid' ? 'تایید شده' :
                           status === 'cancelled' ? 'لغو شده' : 'در انتظار پرداخت'}
                        </span>
                      </div>

                      {/* Ticket Details Badges */}
                      <div className="text-sm text-gray-600 flex flex-wrap gap-2 font-medium">
                        <span className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                          شماره رزرو: #{bookingId || 'نامشخص'}
                        </span>
                        
                        {/* Dynamic Price Display */}
                        {price ? (
                          <span className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm text-green-700 font-bold">
                            💰 {Number(price).toLocaleString()} تومان
                          </span>
                        ) : null}

                        <span className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                          📅 {matchDate}
                        </span>

                        {/* Venue / Sport Display */}
                        {(venue || sport) && (
                          <span className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                            📍 {venue || sport}
                          </span>
                        )}

                        <span className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                          🎟️ {quantity} عدد
                        </span>
                      </div>

                    </div>
                    
                    {/* Cancellation Action Button */}
                    {(status === 'confirmed' || status === 'paid') && (
                      <button
                        onClick={() => handleCancelTicket(bookingId)}
                        disabled={cancelingId === bookingId}
                        className="w-full sm:w-auto mt-3 sm:mt-0 px-5 py-2.5 bg-white border-2 border-red-100 text-red-600 rounded-xl hover:bg-red-50 hover:border-red-200 font-bold transition-all disabled:opacity-50 text-sm shadow-sm"
                      >
                        {cancelingId === bookingId ? 'در حال لغو...' : 'لغو بلیت'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}