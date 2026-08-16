import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';

export default function Profile() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelingId, setCancelingId] = useState(null);

  // Fetch bookings and enrich missing data
  useEffect(() => {
    const fetchBookingsAndTickets = async () => {
      try {
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
                console.error("Fetch error", e);
              }
            }

            let rawStatus = b.reservation_status || b.status || 'pending';
            rawStatus = rawStatus.toLowerCase();
            if (rawStatus === 'confirmed') rawStatus = 'paid';

            return {
              ...b,
              fetchedPrice: price,
              fetchedVenue: venue,
              effectiveStatus: rawStatus
            };
          })
        );

        // 🔴 SMART SORT: Pending first, then closest future match
        const now = new Date().getTime();
        
        enriched.sort((a, b) => {
          const isPendingA = a.effectiveStatus === 'pending';
          const isPendingB = b.effectiveStatus === 'pending';

          // 1. Pending tickets always float to the top
          if (isPendingA && !isPendingB) return -1;
          if (!isPendingA && isPendingB) return 1;

          // 2. If statuses are same, sort by match date
          const dateA = new Date(a.match_date || 0).getTime();
          const dateB = new Date(b.match_date || 0).getTime();
          
          const isFutureA = dateA >= now;
          const isFutureB = dateB >= now;

          // Closest future first
          if (isFutureA && isFutureB) {
            return dateA - dateB;
          }
          // Most recent past first
          if (!isFutureA && !isFutureB) {
            return dateB - dateA;
          }
          // Future before past
          return isFutureA ? -1 : 1;
        });

        setBookings(enriched);
      } catch (error) {
        toast.error('خطا در دریافت سابقه خریدها');
      } finally {
        setLoading(false);
      }
    };

    fetchBookingsAndTickets();
  }, []);

  // Handle cancellation logic
  const handleCancelTicket = async (reservationId, status) => {
    const isPending = status === 'pending';
    const msgPend = 'آیا از لغو این رزرو پرداخت‌نشده اطمینان دارید؟';
    const msgPaid = 'لغو بلیت با کسر جریمه همراه است. ادامه می‌دهید؟';
    const confirmMsg = isPending ? msgPend : msgPaid;

    if (!window.confirm(confirmMsg)) return;

    setCancelingId(reservationId);
    try {
      const response = await api.post('/payments/cancel', {
        reservation_id: reservationId
      });
      
      const refund = response.data?.refund_amount;
      
      let successMsg = response.data?.message || 'بلیت لغو شد.';
      if (!isPending && refund !== undefined && refund > 0) {
        successMsg = (
          `بلیت لغو شد. مبلغ ${Number(refund).toLocaleString()} ` +
          `تومان عودت داده شد.`
        );
      }
      
      toast.success(successMsg, { duration: 6000 });
      
      setBookings(prev => 
        prev.map(b => {
          const currentId = b.reservation_id || b.id;
          if (currentId === reservationId) {
            return { ...b, effectiveStatus: 'cancelled' };
          }
          return b;
        })
      );
    } catch (error) {
      const msg = error.response?.data?.detail || 'خطا در لغو بلیت';
      toast.error(typeof msg === 'string' ? msg : 'خطای سرور');
    } finally {
      setCancelingId(null);
    }
  };

  // Navigate back to the payment gateway for pending tickets
  const handleResumePayment = (booking) => {
    const resId = booking.reservation_id || booking.id;
    const title = (booking.home_team && booking.away_team) 
      ? `${booking.home_team} vs ${booking.away_team}` 
      : (booking.title || 'بلیت مسابقه');
    
    const finalPrice = booking.fetchedPrice || 0;

    navigate(`/payment/${resId}`, {
      state: { finalPrice, title, ticketId: booking.ticket_id }
    });
  };

  // Calculate dashboard statistics
  const successfulBookings = bookings.filter(
    b => b.effectiveStatus === 'paid'
  ).length;
  
  const failedBookings = bookings.filter(
    b => b.effectiveStatus === 'pending' || b.effectiveStatus === 'failed'
  ).length;
  
  const cancelledBookings = bookings.filter(
    b => b.effectiveStatus === 'cancelled'
  ).length;

  const getStatusVisuals = (status) => {
    if (status === 'paid') {
      return { label: 'موفق', color: 'bg-green-100 text-green-700' };
    }
    if (status === 'cancelled') {
      return { label: 'کنسل‌شده', color: 'bg-red-100 text-red-700' };
    }
    return { 
      label: 'ناموفق / معلق', 
      color: 'bg-yellow-100 text-yellow-700' 
    };
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-12">
      <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center">
          <div className="flex-1 flex justify-between items-center">
            <h1 className="text-xl font-bold text-gray-900">
              👤 پروفایل من
            </h1>
            <button 
              onClick={() => navigate('/dashboard')} 
              className="text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              بازگشت به داشبورد ←
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-5 rounded-2xl border shadow-sm flex">
            <div className="flex-1">
              <span className="text-xs text-gray-500 font-bold block mb-1">
                پرداخت‌های موفق
              </span>
              <span className="text-2xl font-black text-green-600">
                {successfulBookings}
              </span>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border shadow-sm flex">
            <div className="flex-1">
              <span className="text-xs text-gray-500 font-bold block mb-1">
                پرداخت ناموفق/معلق
              </span>
              <span className="text-2xl font-black text-yellow-600">
                {failedBookings}
              </span>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border shadow-sm flex">
            <div className="flex-1">
              <span className="text-xs text-gray-500 font-bold block mb-1">
                کنسل‌شده
              </span>
              <span className="text-2xl font-black text-red-600">
                {cancelledBookings}
              </span>
            </div>
          </div>
        </div>

        {/* Bookings List */}
        <div className="bg-white rounded-2xl shadow-sm border p-6 mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            سابقه خرید و رزرو بلیت
          </h2>
          
          {loading ? (
            <div className="text-center py-8 text-gray-500 animate-pulse">
              در حال دریافت اطلاعات...
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-8 text-gray-500 bg-gray-50">
              شما هنوز هیچ بلیتی خریداری نکرده‌اید.
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map((booking, index) => {
                const bookingId = booking.reservation_id || booking.id;
                const home = booking.home_team;
                const away = booking.away_team;
                const title = (home && away) 
                  ? `${home} vs ${away}` 
                  : (booking.title || 'بلیت مسابقه');
                
                const matchDate = booking.match_date 
                  ? new Date(booking.match_date).toLocaleDateString('fa-IR') 
                  : 'نامشخص';
                
                const status = booking.effectiveStatus; 
                const price = booking.fetchedPrice;
                const visual = getStatusVisuals(status);

                return (
                  <div 
                    key={bookingId || index} 
                    className={`flex flex-col sm:flex-row justify-between border p-4 rounded-xl items-center transition-all ${
                      status === 'pending' 
                        ? 'bg-yellow-50 border-yellow-200 shadow-sm' 
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex-1 w-full mb-4 sm:mb-0">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="font-black text-gray-900 text-lg">
                          {title}
                        </span>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${visual.color}`}>
                          {visual.label}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 flex flex-wrap gap-2">
                        <span className="bg-white px-3 py-1.5 border rounded-lg">
                          شماره رزرو: #{bookingId}
                        </span>
                        {price && (
                          <span className="bg-white px-3 py-1.5 border rounded-lg font-bold">
                            {Number(price).toLocaleString()} تومان
                          </span>
                        )}
                        <span className="bg-white px-3 py-1.5 border rounded-lg">
                          تاریخ: {matchDate}
                        </span>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                      
                      {status === 'pending' && (
                        <button
                          onClick={() => handleResumePayment(booking)}
                          className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all text-sm shadow-sm animate-pulse"
                        >
                          ادامه پرداخت
                        </button>
                      )}
                      
                      {(status === 'paid' || status === 'pending') && (
                        <button
                          onClick={() => handleCancelTicket(bookingId, status)}
                          disabled={cancelingId === bookingId}
                          className="w-full sm:w-auto px-5 py-2.5 bg-white border-2 border-red-100 text-red-600 rounded-xl hover:bg-red-50 font-bold transition-all disabled:opacity-50 text-sm shadow-sm"
                        >
                          {cancelingId === bookingId 
                            ? 'در حال پردازش...' 
                            : 'لغو بلیت'}
                        </button>
                      )}
                    </div>
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