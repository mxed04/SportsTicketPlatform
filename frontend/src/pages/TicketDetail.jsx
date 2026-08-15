import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState(false);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const response = await api.get(`/tickets/${id}`);
        setTicket(response.data);
      } catch (error) {
        toast.error('خطا در دریافت اطلاعات بلیت. ممکن است بلیت حذف شده باشد.');
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id, navigate]);

  const handleReserve = async () => {
    setReserving(true);
    try {
      const response = await api.post('/reservations/', {
        ticket_id: parseInt(id),
        quantity: 1
      });
      
      toast.success('بلیت با موفقیت برای شما قفل شد! ۱۰ دقیقه زمان دارید. ⏳');
      
      const resId = response.data.reservation_id || response.data.id || 'new';
      
      // 🔴 Correction 1: Sending the ticket price and title to the payment page.
      navigate(`/payment/${resId}`, { 
        state: { 
          price: ticket.price, 
          title: ticket.title 
        } 
      });
    } catch (error) {
      const msg = error.response?.data?.detail || 'خطا در رزرو بلیت. شاید ظرفیت پر شده باشد!';
      toast.error(typeof msg === 'string' ? msg : 'خطای سرور');
    } finally {
      setReserving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-500 font-medium animate-pulse">در حال دریافت اطلاعات بلیت...</div>
      </div>
    );
  }

  if (!ticket) return null;

  return (
    <div className="min-h-screen bg-gray-50 font-sans py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <button 
          onClick={() => navigate('/dashboard')}
          className="text-blue-600 hover:text-blue-800 font-bold mb-6 flex items-center gap-2 transition-colors"
        >
          ← بازگشت به داشبورد
        </button>

        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
          {/* هدر کارت */}
          <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-8 text-white text-center relative overflow-hidden">
            <span className="bg-white/20 text-sm font-bold px-3 py-1 rounded-full mb-4 inline-block">
              {ticket.sport_type || 'ورزشی'}
            </span>
            <h1 className="text-3xl font-black mb-2">{ticket.title}</h1>
            <p className="text-blue-100 mt-2 text-lg">
              {ticket.match_date ? new Date(ticket.match_date).toLocaleDateString('fa-IR') : 'تاریخ نامشخص'}
            </p>
          </div>

          {/* محتوای کارت */}
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                <span className="text-gray-500 text-sm block mb-1">محل برگزاری</span>
                {/* 🔴 Correction 2: Supporting venue_name from the database */}
                <span className="text-gray-900 font-bold text-lg">
                  {ticket.venue_name || ticket.venue || ticket.location_name || 'نامشخص'}
                </span>
              </div>
              <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                <span className="text-gray-500 text-sm block mb-1">تیم‌های شرکت‌کننده</span>
                <span className="text-gray-900 font-bold text-lg">{ticket.home_team} vs {ticket.away_team}</span>
              </div>
            </div>

            {/* بخش قیمت و ظرفیت */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-blue-50 p-6 rounded-2xl border border-blue-100 mt-6">
              <div>
                <span className="text-gray-600 text-sm block mb-1">قیمت نهایی بلیت</span>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-black text-blue-700">
                    {Number(ticket.price).toLocaleString()} <span className="text-lg font-normal">تومان</span>
                  </span>
                  {ticket.is_surge_pricing && (
                    <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-1 rounded-md animate-pulse">
                      🔥 ظرفیت محدود (افزایش قیمت)
                    </span>
                  )}
                </div>
              </div>
              <div className="text-left mt-4 md:mt-0">
                <span className="text-gray-600 text-sm block mb-1">ظرفیت باقیمانده</span>
                <span className="text-xl font-bold text-gray-800">{ticket.remaining_capacity} صندلی</span>
              </div>
            </div>

            {/* دکمه رزرو */}
            <button
              onClick={handleReserve}
              disabled={reserving || ticket.remaining_capacity <= 0}
              className={`w-full text-lg font-black py-4 rounded-xl transition-all shadow-md mt-6 ${
                reserving || ticket.remaining_capacity <= 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600 text-white hover:shadow-lg transform hover:-translate-y-1'
              }`}
            >
              {reserving ? 'در حال قفل کردن صندلی...' : ticket.remaining_capacity <= 0 ? 'ظرفیت تکمیل شد' : 'رزرو و قفل بلیت (۱۰ دقیقه)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}