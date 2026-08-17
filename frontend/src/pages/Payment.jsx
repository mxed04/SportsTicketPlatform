import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';

export default function Payment() {
  const { reservationId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // 🔴 Retrieve price and title from the previous page (with a fallback default value)
  const ticketPrice = location.state?.price || 200000;
  const ticketTitle = location.state?.title || 'بلیت مسابقه ورزشی';

  const [processing, setProcessing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
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
    setProcessing(true);
    try {
      await api.post('/payments/', {
        reservation_id: parseInt(reservationId),
        amount: ticketPrice, // sending the price to the backend for validation
        payment_method: "online"
      });
      
      toast.success('💳 پرداخت با موفقیت انجام شد! بلیت شما صادر گردید.', { duration: 5000 });
      navigate('/dashboard');
    } catch (error) {
      const msg = error.response?.data?.detail || 'پرداخت ناموفق بود. لطفاً دوباره تلاش کنید.';
      toast.error(typeof msg === 'string' ? msg : 'خطا در ارتباط با درگاه پرداخت');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = () => {
    toast.error('پرداخت لغو شد. قفل بلیت باز می‌گردد.');
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans py-12 px-4 flex items-center justify-center">
      <div className="bg-white max-w-md w-full rounded-3xl shadow-xl overflow-hidden border border-gray-200">
        
        <div className="bg-blue-600 p-6 text-center text-white">
          <h1 className="text-xl font-black mb-1">درگاه پرداخت امن</h1>
          <p className="text-blue-200 text-sm">سامانه جامع بلیت ورزشی</p>
        </div>

        <div className="p-8">
          <div className={`text-center p-4 rounded-2xl mb-8 border-2 ${expired ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
            <p className="text-sm text-gray-500 mb-2 font-bold">
              {expired ? 'زمان پرداخت به پایان رسید' : 'زمان باقیمانده تا انقضای قفل بلیت'}
            </p>
            <div className={`text-4xl font-black tracking-widest ${expired ? 'text-red-600' : 'text-blue-600'}`}>
              {formatTime(timeLeft)}
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <span className="text-gray-500 text-sm">عنوان مسابقه:</span>
              <span className="font-bold text-gray-800 text-sm">{ticketTitle}</span>
            </div>
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <span className="text-gray-500 text-sm">شماره فاکتور (رزرو):</span>
              <span className="font-bold text-gray-800">#{reservationId}</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-gray-600 font-bold">مبلغ قابل پرداخت:</span>
              <span className="text-2xl font-black text-green-600">
                {Number(ticketPrice).toLocaleString()} <span className="text-sm font-normal">تومان</span>
              </span>
            </div>
          </div>

          <div className="space-y-3 mt-8">
            <button
              onClick={handlePayment}
              disabled={processing || expired}
              className={`w-full py-4 rounded-xl text-lg font-black transition-all shadow-md ${
                processing || expired
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600 text-white transform hover:-translate-y-1 hover:shadow-lg'
              }`}
            >
              {processing ? 'در حال پردازش تراکنش...' : expired ? 'قفل صندلی باطل شد' : 'پرداخت و صدور بلیت'}
            </button>
            
            <button
              onClick={handleCancel}
              disabled={processing}
              className="w-full py-3 rounded-xl text-red-500 font-bold hover:bg-red-50 transition-colors"
            >
              انصراف و بازگشت
            </button>
          </div>
        </div>
        
      </div>
    </div>
  );
}