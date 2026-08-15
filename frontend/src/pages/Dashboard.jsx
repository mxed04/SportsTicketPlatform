import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../api';

export default function Dashboard() {
  const [tickets, setTickets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Safe Error Handler
  const fetchTickets = async (query = '') => {
    setLoading(true);
    try {
      const params = {};
      if (query.trim()) {
        params.sport_type = query;
        params.team_name = query;
      }

      const response = await api.get('/tickets/search', { params });

      // Handle different response structures
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
      toast.error('خطا در دریافت اطلاعات بلیت‌ها');
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

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans pb-12">
      <header className="bg-blue-600 text-white shadow-md py-4 px-6">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-black">سامانه بلیت مسابقات ورزشی</h1>
          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
          >
            خروج از حساب
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto mt-8 px-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-3">
            جستجوی هوشمند بلیت (ElasticSearch)
          </h2>
          <form onSubmit={handleSearch} className="flex gap-3">
            <input
              type="text"
              placeholder="نام ورزش (فوتبال، والیبال...) یا نام تیم را جستجو کنید..."
              className="flex-1 px-4 py-3 rounded-xl bg-gray-50 border border-gray-300 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors shadow-sm"
            >
              {loading ? 'در حال جستجو...' : 'جستجو'}
            </button>
          </form>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500 font-medium">
            در حال دریافت بلیت‌ها...
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 text-gray-500">
            هیچ بلیطی یافت نشد.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tickets.map((t, index) => (
              <div
                key={t.id || t.ticket_id || index}
                className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all"
              >
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
                  <span className="bg-white/20 text-xs font-bold px-2.5 py-1 rounded-full inline-block mb-2">
                    {t.sport_type || 'ورزشی'}
                  </span>
                  <h3 className="text-base font-extrabold">
                    {t.title || `${t.home_team || 'تیم ۱'} vs ${t.away_team || 'تیم ۲'}`}
                  </h3>
                </div>
                <div className="p-5 space-y-3 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>ورزشگاه:</span>
                    <span className="font-bold text-gray-800">
                      {t.venue || t.location_name || 'نامشخص'}
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
                      className="w-full mt-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white font-bold py-2.5 rounded-xl transition-all text-xs">
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