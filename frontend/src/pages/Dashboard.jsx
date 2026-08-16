import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../api';

/**
 * Helper function to safely extract the user role from JWT token or localStorage.
 */
const getUserRole = () => {
  const token = localStorage.getItem('token');
  if (!token) return null;

  try {
    const payloadBase64 = token.split('.')[1];
    if (payloadBase64) {
      const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const decoded = JSON.parse(jsonPayload);
      if (decoded.role) return decoded.role;
    }
  } catch (error) {
    console.error('Error decoding token role:', error);
  }
  return localStorage.getItem('role') || 'audience';
};

export default function Dashboard() {
  const [tickets, setTickets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Check if current user is an admin or support staff
  const userRole = getUserRole();
  const isAdminOrSupport = userRole === 'admin' || userRole === 'support';

  // Fetch tickets from API with optional search parameters
  const fetchTickets = async (query = '') => {
    setLoading(true);
    try {
      const params = {};
      if (query.trim()) {
        params.sport_type = query;
        params.team_name = query;
      }

      const response = await api.get('/tickets/search', { params });

      // Handle various response data structures safely
      let list = [];
      if (Array.isArray(response.data)) {
        list = response.data;
      } else if (response.data && Array.isArray(response.data.tickets)) {
        list = response.data.tickets;
      } else if (response.data && Array.isArray(response.data.results)) {
        list = response.data.results;
      }

      setTickets(list);

      if (list.length === 0 && query) {
        toast('بلیطی با این مشخصات یافت نشد', { icon: '🔍' });
      }
    } catch (error) {
      console.error('Search error:', error);
      setTickets([]);
      toast.error('خطا در دریافت اطلاعات بلیط‌ها');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchTickets(searchQuery);
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-12">
      {/* Main Application Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 space-x-reverse">
            <span className="text-2xl">🎟️</span>
            <h1 className="text-xl font-bold text-gray-900">سامانه رزرو بلیت ورزشی</h1>
          </div>
          
          {/* Action Buttons (Admin Panel, Support, Profile & Logout) */}
          <div className="flex items-center gap-3">
            {/* Conditional Rendering: Show Admin Panel button only for admin or support roles */}
            {isAdminOrSupport && (
              <button 
                onClick={() => window.location.href = '/admin'}
                className="text-sm font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 shadow-sm"
              >
                👑 پنل مدیریت
              </button>
            )}

            <button 
              onClick={() => window.location.href = '/support'}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors hidden sm:block px-2 py-1.5"
            >
              🎧 پشتیبانی
            </button>
            <button 
              onClick={() => window.location.href = '/profile'}
              className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 px-3 py-1.5 rounded-lg"
            >
              پروفایل من
            </button>
            <button 
              onClick={() => {
                localStorage.removeItem('token');
                localStorage.removeItem('role');
                window.location.href = '/';
              }}
              className="text-sm font-medium text-red-600 hover:text-red-800 transition-colors"
            >
              خروج
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Search Query Form */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
          <form onSubmit={handleSearch} className="flex gap-4">
            <input
              type="text"
              placeholder="جستجوی تیم، نوع ورزش یا شهر..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 text-sm"
            >
              {loading ? 'در حال جستجو...' : 'جستجو'}
            </button>
          </form>
        </div>

        {/* Tickets Grid Display */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">در حال دریافت بلیت‌ها...</div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-white rounded-2xl border border-gray-100">
            هیچ بلیتی یافت نشد.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tickets.map((t, idx) => (
              <div key={t.id || t.ticket_id || idx} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                <div className="bg-blue-600 p-4 text-white">
                  <span className="text-xs bg-blue-500 px-2.5 py-1 rounded-full font-medium">
                    {t.sport_type || 'ورزشی'}
                  </span>
                  <h3 className="font-bold text-lg mt-2">
                    {t.title || `${t.home_team || 'تیم ۱'} vs ${t.away_team || 'تیم ۲'}`}
                  </h3>
                </div>
                <div className="p-5 space-y-3 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>ورزشگاه:</span>
                    {/* Check venue_name first for DB/ElasticSearch compatibility */}
                    <span className="font-bold text-gray-800">
                      {t.venue_name || t.venue || t.location_name || 'نامشخص'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>قیمت:</span>
                    <span className="font-bold text-green-600">
                      {t.price ? Number(t.price).toLocaleString() : '۰'} تومان
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>ظرفیت باقیمانده:</span>
                    <span className="font-bold text-gray-800">
                      {t.remaining_capacity ?? t.capacity ?? 0} نفر
                    </span>
                  </div>
                  <button 
                    onClick={() => window.location.href = `/tickets/${t.id || t.ticket_id}`}
                    className="w-full mt-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white font-bold py-2.5 rounded-xl transition-all text-xs"
                  >
                    رزرو بلیت
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}