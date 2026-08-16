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
          const userRes = await api.get('/users/me');
          if (userRes.data) {
            setProfileData({
              first_name: userRes.data.first_name || '',
              last_name: userRes.data.last_name || '',
              email: userRes.data.email || '',
              city: userRes.data.city || '',
              phone_number: userRes.data.phone_number || ''
            });
          }
        } catch (e) {
          console.error("Profile fetch error", e);
        }

        // 2. Fetch Bookings and enrich missing data
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

        // 🔴 SMART SORT: Pending first, then closest future match
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
        toast.error('خطا در دریافت اطلاعات کاربری');
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
      await api.put('/users/me', {
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        email: profileData.email,
        city: profileData.city,
      });
      toast.success('اطلاعات کاربری با موفقیت به‌روزرسانی شد.');
    } catch (err) {
      toast.error('خطا در به‌روزرسانی اطلاعات. مجدداً تلاش کنید.');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleCancelTicket = async (reservationId, status) => {
    const isPending = status === 'pending';
    const msgPend = 'آیا از لغو این رزرو پرداخت‌نشده اطمینان دارید؟';
    const msgPaid = 'لغو بلیت با کسر جریمه همراه است. ادامه می‌دهید؟';
    if (!window.confirm(isPending ? msgPend : msgPaid)) return;

    setCancelingId(reservationId);
    try {
      const response = await api.post('/payments/cancel', { reservation_id: reservationId });
      const refund = response.data?.refund_amount;
      
      let successMsg = response.data?.message || 'بلیت لغو شد.';
      if (!isPending && refund !== undefined && refund > 0) {
        successMsg = `بلیت لغو شد. مبلغ ${Number(refund).toLocaleString()} تومان عودت داده شد.`;
      }
      
      toast.success(successMsg, { duration: 6000 });
      setBookings(prev => prev.map(b => (b.reservation_id || b.id) === reservationId ? { ...b, effectiveStatus: 'cancelled' } : b));
    } catch (error) {
      const msg = error.response?.data?.detail || 'خطا در لغو بلیت';
      toast.error(typeof msg === 'string' ? msg : 'خطای سرور');
    } finally {
      setCancelingId(null);
    }
  };

  const handleResumePayment = (booking) => {
    const resId = booking.reservation_id || booking.id;
    const title = (booking.home_team && booking.away_team) ? `${booking.home_team} vs ${booking.away_team}` : (booking.title || 'بلیت مسابقه');
    navigate(`/payment/${resId}`, { state: { finalPrice: booking.fetchedPrice || 0, title, ticketId: booking.ticket_id } });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    toast.success('خروج با موفقیت انجام شد.');
    navigate('/');
  };

  // --- Render Helpers ---

  const successfulBookings = bookings.filter(b => b.effectiveStatus === 'paid').length;
  const failedBookings = bookings.filter(b => b.effectiveStatus === 'pending' || b.effectiveStatus === 'failed').length;
  const cancelledBookings = bookings.filter(b => b.effectiveStatus === 'cancelled').length;

  const getStatusVisuals = (status) => {
    if (status === 'paid') return { label: 'موفق', color: 'bg-green-100 text-green-700' };
    if (status === 'cancelled') return { label: 'کنسل‌شده', color: 'bg-red-100 text-red-700' };
    return { label: 'ناموفق / معلق', color: 'bg-yellow-100 text-yellow-700' };
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-12" dir="rtl">
      <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center">
          <div className="flex-1 flex justify-between items-center">
            <h1 className="text-xl font-bold text-gray-900">👤 پروفایل کاربری</h1>
            <button onClick={() => navigate('/dashboard')} className="text-sm font-medium text-blue-600 hover:text-blue-800">
              بازگشت به داشبورد ←
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        
        {/* Profile Header & Logout */}
        <div className="flex justify-between items-center bg-white p-6 rounded-2xl border shadow-sm mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold">
              {profileData.first_name ? profileData.first_name[0] : '👤'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {profileData.first_name} {profileData.last_name}
              </h2>
              <span className="text-sm text-gray-500 dir-ltr inline-block mt-1">
                {profileData.phone_number}
              </span>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 font-bold rounded-xl transition-all text-sm"
          >
            خروج از حساب
          </button>
        </div>

        {/* Tabs Navigation */}
        <div className="flex gap-4 mb-6 border-b border-gray-200 pb-px">
          <button 
            onClick={() => setActiveTab('bookings')}
            className={`pb-3 px-2 font-bold text-sm transition-all border-b-2 ${activeTab === 'bookings' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            🎟️ سابقه خرید و رزرو
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`pb-3 px-2 font-bold text-sm transition-all border-b-2 ${activeTab === 'settings' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            ⚙️ تنظیمات اطلاعات حساب
          </button>
        </div>

        {/* TAB 1: BOOKINGS */}
        {activeTab === 'bookings' && (
          <>
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-white p-5 rounded-2xl border shadow-sm flex">
                <div className="flex-1">
                  <span className="text-xs text-gray-500 font-bold block mb-1">پرداخت‌های موفق</span>
                  <span className="text-2xl font-black text-green-600">{successfulBookings}</span>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border shadow-sm flex">
                <div className="flex-1">
                  <span className="text-xs text-gray-500 font-bold block mb-1">پرداخت ناموفق/معلق</span>
                  <span className="text-2xl font-black text-yellow-600">{failedBookings}</span>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border shadow-sm flex">
                <div className="flex-1">
                  <span className="text-xs text-gray-500 font-bold block mb-1">کنسل‌شده</span>
                  <span className="text-2xl font-black text-red-600">{cancelledBookings}</span>
                </div>
              </div>
            </div>

            {/* Bookings List */}
            <div className="bg-white rounded-2xl shadow-sm border p-6 mb-8">
              {loading ? (
                <div className="text-center py-8 text-gray-500 animate-pulse">در حال دریافت اطلاعات...</div>
              ) : bookings.length === 0 ? (
                <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <span className="text-4xl block mb-3">🎫</span>
                  شما هنوز هیچ بلیتی خریداری/رزرو نکرده‌اید.
                </div>
              ) : (
                <div className="space-y-4">
                  {bookings.map((booking, index) => {
                    const bookingId = booking.reservation_id || booking.id;
                    const title = (booking.home_team && booking.away_team) ? `${booking.home_team} vs ${booking.away_team}` : (booking.title || 'بلیت مسابقه');
                    const matchDate = booking.match_date ? new Date(booking.match_date).toLocaleDateString('fa-IR') : 'نامشخص';
                    const status = booking.effectiveStatus; 
                    const price = booking.fetchedPrice;
                    const visual = getStatusVisuals(status);

                    return (
                      <div key={bookingId || index} className={`flex flex-col sm:flex-row justify-between border p-4 rounded-xl items-center transition-all ${status === 'pending' ? 'bg-yellow-50 border-yellow-200 shadow-sm' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="flex-1 w-full mb-4 sm:mb-0">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="font-black text-gray-900 text-lg">{title}</span>
                            <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${visual.color}`}>{visual.label}</span>
                          </div>
                          <div className="text-sm text-gray-600 flex flex-wrap gap-2">
                            <span className="bg-white px-3 py-1.5 border rounded-lg">شماره رزرو: #{bookingId}</span>
                            {price && <span className="bg-white px-3 py-1.5 border rounded-lg font-bold">{Number(price).toLocaleString()} تومان</span>}
                            <span className="bg-white px-3 py-1.5 border rounded-lg">تاریخ: {matchDate}</span>
                          </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                          {status === 'pending' && (
                            <button onClick={() => handleResumePayment(booking)} className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all text-sm shadow-sm animate-pulse">
                              ادامه پرداخت
                            </button>
                          )}
                          {(status === 'paid' || status === 'pending') && (
                            <button onClick={() => handleCancelTicket(bookingId, status)} disabled={cancelingId === bookingId} className="w-full sm:w-auto px-5 py-2.5 bg-white border-2 border-red-100 text-red-600 rounded-xl hover:bg-red-50 font-bold transition-all disabled:opacity-50 text-sm shadow-sm">
                              {cancelingId === bookingId ? 'در پردازش...' : 'لغو بلیت'}
                            </button>
                          )}
                        </div>
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
          <div className="bg-white rounded-2xl shadow-sm border p-6 mb-8">
            <h3 className="text-lg font-bold text-gray-800 mb-6">ویرایش اطلاعات حساب کاربری</h3>
            <form onSubmit={handleUpdateProfile} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">نام</label>
                  <input type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm" value={profileData.first_name} onChange={e => setProfileData({...profileData, first_name: e.target.value})} required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">نام خانوادگی</label>
                  <input type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm" value={profileData.last_name} onChange={e => setProfileData({...profileData, last_name: e.target.value})} required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">ایمیل</label>
                  <input type="email" dir="ltr" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm" value={profileData.email} onChange={e => setProfileData({...profileData, email: e.target.value})} required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">شهر محل سکونت</label>
                  <input type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm" value={profileData.city} onChange={e => setProfileData({...profileData, city: e.target.value})} required />
                </div>
                {/* Phone number is usually read-only unless an OTP change process is implemented */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">شماره موبایل (غیرقابل تغییر)</label>
                  <input type="text" dir="ltr" className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-500 cursor-not-allowed" value={profileData.phone_number} disabled />
                </div>
              </div>
              <div className="pt-4 flex justify-end">
                <button type="submit" disabled={updatingProfile} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md disabled:opacity-50 text-sm">
                  {updatingProfile ? 'در حال ثبت...' : 'ذخیره تغییرات'}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}