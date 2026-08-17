import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';

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
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSport, setSelectedSport] = useState('all');
  const [venueFilter, setVenueFilter] = useState('');

  const userRole = getUserRole();
  const isAdminOrSupport = userRole === 'admin' || userRole === 'support';

  // 🔴 CONNECT TO ELASTICSEARCH: Fetch from backend API
  const fetchTicketsFromES = async () => {
    setLoading(true);
    try {
      const params = {};
      if (searchQuery.trim()) params.q = searchQuery.trim();
      if (selectedSport !== 'all') params.sport_type = selectedSport;
      if (venueFilter.trim()) params.venue = venueFilter.trim();

      // Sending request directly to our powerful ElasticSearch API
      const response = await api.get('/tickets/search', { params });
      const data = response.data?.tickets || response.data || [];
      setTickets(Array.isArray(data) ? data : []);
      
    } catch (error) {
      // Ignore 429 Too Many Requests in console to keep UI clean
      if (error.response?.status !== 429) {
        console.error("ES Search Error:", error);
        toast.error('خطا در جستجوی هوشمند بلیت‌ها');
      }
    } finally {
      setLoading(false);
    }
  };

  // 🔴 SMART DEBOUNCE: Wait 600ms after user stops typing before asking backend
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTicketsFromES();
    }, 600);
    
    return () => clearTimeout(timer);
  }, [searchQuery, selectedSport, venueFilter]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedSport('all');
    setVenueFilter('');
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-12" dir="rtl">
      {/* Top Header */}
      <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎟️</span>
            <h1 className="text-xl font-bold text-gray-900">
              سامانه رزرو بلیت ورزشی
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {isAdminOrSupport && (
              <button
                onClick={() => navigate('/admin')}
                className="text-xs bg-purple-100 text-purple-700 px-3 py-2 rounded-lg font-bold hover:bg-purple-200 transition-all"
              >
                👑 پنل مدیریت
              </button>
            )}
            <button
              onClick={() => navigate('/support')}
              className="text-xs bg-gray-100 text-gray-700 px-3 py-2 rounded-lg font-bold hover:bg-gray-200 transition-all"
            >
              🎧 پشتیبانی
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="text-xs bg-blue-600 text-white px-3 py-2 rounded-lg font-bold hover:bg-blue-700 transition-all shadow-sm"
            >
              👤 پروفایل من
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        
        {/* Advanced Search & Filter Controls */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8 space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            
            {/* Search Query Input */}
            <div className="flex-1 w-full relative">
              <span className="absolute right-3.5 top-3.5 text-gray-400 text-sm">
                🔍
              </span>
              <input
                type="text"
                placeholder="جستجوی هوشمند تیم، مسابقه یا ورزشگاه (با پشتیبانی از غلط املایی)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            {/* Sport Type Dropdown */}
            <div className="w-full md:w-48">
              <select
                value={selectedSport}
                onChange={(e) => setSelectedSport(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">همه ورزش‌ها</option>
                <option value="football">⚽ فوتبال</option>
                <option value="volleyball">🏐 والیبال</option>
                <option value="basketball">🏀 بسکتبال</option>
              </select>
            </div>

            {/* Venue Filter Input */}
            <div className="w-full md:w-48">
              <input
                type="text"
                placeholder="نام ورزشگاه..."
                value={venueFilter}
                onChange={(e) => setVenueFilter(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Reset Filters Button */}
            {(searchQuery || selectedSport !== 'all' || venueFilter) && (
              <button
                onClick={handleClearFilters}
                className="w-full md:w-auto px-4 py-3 text-sm text-red-600 bg-red-50 hover:bg-red-100 font-bold rounded-xl transition-all whitespace-nowrap"
              >
                حذف فیلترها
              </button>
            )}
          </div>
        </div>

        {/* Tickets Results Grid */}
        {loading ? (
          <div className="text-center py-20 text-gray-500 font-bold animate-pulse">
            در حال جستجو در پایگاه داده ElasticSearch...
          </div>
        ) : tickets.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-gray-300">
            <span className="text-5xl block mb-4">🔍</span>
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              هیچ بلیتی با این مشخصات یافت نشد!
            </h3>
            <p className="text-sm text-gray-500">
              عبارت دیگری را جستجو کرده یا فیلترها را پاک کنید.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tickets.map((t) => {
              const ticketId = t.id || t.ticket_id;
              const home = t.home_team;
              const away = t.away_team;
              const title = (home && away) 
                ? `${home} vs ${away}` 
                : (t.title || 'بلیت مسابقه');
                
              const venue = t.venue_name || t.venue || t.location_name || 'نامشخص';
              const capacity = t.remaining_capacity ?? t.capacity ?? 0;
              const isSurge = capacity > 0 && capacity < 1000;
              
              const matchDate = t.match_date
                ? new Date(t.match_date).toLocaleDateString('fa-IR')
                : 'نامشخص';

              return (
                <div
                  key={ticketId}
                  className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Card Header Banner */}
                    <div className="bg-blue-600 p-5 text-white flex justify-between items-start">
                      <div>
                        <span className="text-xs bg-blue-500 px-2.5 py-1 rounded-full font-bold inline-block mb-2">
                          {t.sport_type || 'ورزشی'}
                        </span>
                        <h3 className="font-black text-xl">{title}</h3>
                      </div>
                      {isSurge && (
                        <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-1 rounded-md animate-pulse">
                          🔥 ظرفیت محدود
                        </span>
                      )}
                    </div>

                    {/* Ticket Details */}
                    <div className="p-5 space-y-3 text-sm text-gray-600">
                      <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                        <span>تاریخ مسابقه:</span>
                        <span className="font-bold text-gray-800">{matchDate}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                        <span>ورزشگاه:</span>
                        <span className="font-bold text-gray-800">{venue}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                        <span>قیمت بلیت:</span>
                        <span className="font-bold text-green-600 text-base">
                          {t.price ? Number(t.price).toLocaleString() : '۰'} تومان
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>ظرفیت باقی‌مانده:</span>
                        <span className="font-bold text-gray-800">{capacity} نفر</span>
                      </div>
                    </div>
                  </div>

                  {/* Reserve Action Button */}
                  <div className="p-5 pt-0">
                    <button
                      onClick={() => navigate(`/tickets/${ticketId}`)}
                      className="w-full bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white font-bold py-3 rounded-xl transition-all text-sm shadow-sm"
                    >
                      رزرو بلیت →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}