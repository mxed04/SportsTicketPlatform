import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';

// Helper to extract role from JWT token safely
const getUserRole = () => {
  const token = localStorage.getItem('token');
  if (!token) return 'audience';
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role || localStorage.getItem('role') || 'audience';
  } catch (e) {
    return 'audience';
  }
};

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState(false);

  // Check if current user is an administrator or support
  const userRole = getUserRole();
  const isAdminOrSupport = userRole === 'admin' || userRole === 'support';

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const response = await api.get(`/tickets/${id}`);
        const ticketData = response.data?.ticket || response.data;
        setTicket(ticketData);
      } catch (error) {
        toast.error('خطا در دریافت اطلاعات بلیت.');
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id, navigate]);

  const handleReserveOnly = async () => {
    setReserving(true);
    try {
      const resResponse = await api.post('/reservations/', {
        ticket_id: parseInt(id),
        quantity: 1
      });
      
      const resId = resResponse.data.reservation_id || resResponse.data.id;
      toast.success('صندلی برای شما قفل شد! انتقال به درگاه... ⏳');
      
      const exactPrice = Number(ticket.price) || 0;
      const title = ticket.title || 
        `${ticket.home_team || 'تیم ۱'} vs ${ticket.away_team || 'تیم ۲'}`;

      navigate(`/payment/${resId}`, {
        state: { finalPrice: exactPrice, title, ticketId: id }
      });
      
    } catch (error) {
      toast.error('خطا در رزرو بلیت. شاید ظرفیت پر شده باشد!');
    } finally {
      setReserving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 font-bold animate-pulse">
          در حال دریافت اطلاعات مسابقه...
        </p>
      </div>
    );
  }

  if (!ticket) return null;

  const displayPrice = Number(ticket.price) || 0;
  const capacity = ticket.remaining_capacity ?? ticket.capacity ?? 0;
  const isSurge = capacity > 0 && capacity < 1000;

  return (
    <div className="min-h-screen bg-gray-50 font-sans py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        
        <div className="bg-blue-600 p-8 text-white text-center">
          <span className="text-sm bg-blue-500 px-3 py-1 rounded-full font-medium mb-4 inline-block shadow-sm">
            {ticket.sport_type || 'ورزشی'}
          </span>
          <h1 className="text-3xl font-black mt-2">
            {ticket.title || 
              `${ticket.home_team || 'تیم ۱'} vs ${ticket.away_team || 'تیم ۲'}`}
          </h1>
        </div>

        <div className="p-8 space-y-6">
          <div className="flex flex-col md:flex-row justify-between border-b border-gray-100 pb-6">
            <div className="space-y-2">
              <span className="text-gray-500 text-sm block font-bold">مکان برگزاری:</span>
              <span className="text-lg font-bold text-gray-900">
                {ticket.venue_name || ticket.venue || 'نامشخص'}
              </span>
            </div>
            <div className="space-y-2 mt-4 md:mt-0 md:text-left">
              <span className="text-gray-500 text-sm block font-bold">تاریخ مسابقه:</span>
              <span className="text-lg font-bold text-gray-900">
                {ticket.match_date 
                  ? new Date(ticket.match_date).toLocaleDateString('fa-IR') 
                  : 'نامشخص'}
              </span>
            </div>
          </div>

          <div className="flex justify-between items-center bg-gray-50 p-6 rounded-2xl border border-gray-100">
            <div>
              <span className="text-gray-500 text-sm block mb-1">قیمت نهایی پرداخت:</span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-green-600">
                  {displayPrice.toLocaleString()} 
                  <span className="text-sm font-normal mr-1">تومان</span>
                </span>
                {isSurge && (
                  <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-1 rounded-md animate-pulse">
                    🔥 ظرفیت محدود (+۱۵٪ اعمال شده)
                  </span>
                )}
              </div>
            </div>
            <div className="text-left">
              <span className="text-gray-500 text-sm block mb-1">ظرفیت باقیمانده:</span>
              <span className="text-xl font-black text-gray-800">{capacity} نفر</span>
            </div>
          </div>

          <div className="pt-4">
            {/* 🔴 Check role: if admin, show disabled button with specific message */}
            {isAdminOrSupport ? (
              <button
                disabled
                className="w-full py-4 rounded-xl text-lg font-bold bg-gray-200 text-gray-500 cursor-not-allowed border border-gray-300"
              >
                🔒 مدیران مجاز به خرید بلیت نمی‌باشند
              </button>
            ) : (
              <button
                onClick={handleReserveOnly}
                disabled={reserving || capacity <= 0}
                className={`w-full py-4 rounded-xl text-lg font-bold transition-all shadow-md flex justify-center items-center gap-2 ${
                  reserving || capacity <= 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-500 hover:bg-green-600 text-white hover:shadow-lg'
                }`}
              >
                {reserving 
                  ? 'در حال قفل کردن صندلی...' 
                  : capacity <= 0 
                    ? 'ظرفیت تکمیل شده است' 
                    : '💳 رزرو بلیت و انتقال به درگاه پرداخت'}
              </button>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}