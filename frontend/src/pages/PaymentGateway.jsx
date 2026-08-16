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
  const title = location.state?.title || 'بلیت مسابقه';

  const [processing, setProcessing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15 * 60);

  // Timer logic for 15 minutes limit
  useEffect(() => {
    if (timeLeft <= 0) {
      toast.error('زمان پرداخت به پایان رسید! رزرو شما منقضی شد.');
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

  // Submit payment to backend
  const handlePaymentSubmit = async () => {
    setProcessing(true);
    try {
      await api.post('/payments/', {
        reservation_id: parseInt(reservationId),
        payment_method: 'online_gateway'
      });
      toast.success('پرداخت با موفقیت انجام شد! 🎉');
      navigate('/profile');
    } catch (error) {
      toast.error('خطا در انجام پرداخت.');
      setProcessing(false);
    }
  };

  // Handle user cancellation
  const handleCancel = () => {
    toast.error('شما از پرداخت انصراف دادید.', { duration: 4000 });
    navigate('/profile');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-10 px-4 font-sans" dir="rtl">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
        
        {/* Gateway Header */}
        <div className="bg-[#2563eb] py-6 text-center">
          <h2 className="text-xl font-bold text-white mb-1">درگاه پرداخت امن</h2>
          <p className="text-sm text-blue-100 opacity-90">سامانه جامع بلیت ورزشی</p>
        </div>

        <div className="p-8">
          
          {/* Timer Component */}
          <div className="bg-[#f8fafc] border border-gray-200 rounded-2xl p-4 text-center mb-8">
            <span className="block text-sm font-bold text-gray-500 mb-2">
              زمان باقیمانده تا انقضای قفل بلیت
            </span>
            <span className="text-4xl font-black text-[#2563eb] tracking-wider">
              {formatTime(timeLeft)}
            </span>
          </div>

          {/* Invoice Information */}
          <div className="space-y-4 mb-8">
            <div className="flex justify-between items-center border-b border-gray-100 pb-4">
              <span className="text-sm font-medium text-gray-500">عنوان مسابقه:</span>
              <span className="text-sm font-bold text-gray-900">{title}</span>
            </div>
            
            <div className="flex justify-between items-center border-b border-gray-100 pb-4">
              <span className="text-sm font-medium text-gray-500">شماره رزرو:</span>
              <span className="text-sm font-bold text-gray-900">#{reservationId}</span>
            </div>
            
            <div className="flex justify-between items-center pt-2">
              <span className="text-sm font-bold text-gray-700">مبلغ قابل پرداخت:</span>
              <div className="text-left">
                <span className="text-2xl font-black text-[#16a34a] ml-1">
                  {Number(finalPrice).toLocaleString()}
                </span>
                <span className="text-sm font-medium text-[#16a34a]">تومان</span>
              </div>
            </div>
          </div>

          {/* User Actions */}
          <div className="space-y-4">
            <button
              onClick={handlePaymentSubmit}
              disabled={processing || finalPrice === 0}
              className="w-full bg-[#22c55e] hover:bg-[#16a34a] text-white py-4 rounded-xl font-bold text-lg transition-colors shadow-md disabled:opacity-50"
            >
              {processing ? 'در حال پردازش...' : 'پرداخت و صدور بلیت'}
            </button>
            
            <button
              onClick={handleCancel}
              disabled={processing}
              className="w-full bg-white text-[#ef4444] hover:bg-red-50 py-3 rounded-xl font-bold transition-colors"
            >
              انصراف و بازگشت
            </button>
          </div>
          
        </div>
      </div>
    </div>
  );
}