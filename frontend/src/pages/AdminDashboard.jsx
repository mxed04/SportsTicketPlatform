import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview'); // tabs: overview, tickets, users, reports
  const [loading, setLoading] = useState(false);

  // Mock states for analytics (Will be replaced with actual API data)
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalTicketsSold: 0,
    activeUsers: 0,
    pendingReports: 0
  });

  const [recentReports, setRecentReports] = useState([]);

  // Fetch Admin Analytics on load
  useEffect(() => {
    const fetchAdminData = async () => {
      setLoading(true);
      try {
        // TODO: Replace with actual backend analytical endpoints from Phase 2
        // const statsRes = await api.get('/admin/stats');
        // const reportsRes = await api.get('/admin/reports/pending');
        
        // Simulating API response for UI building
        setStats({
          totalRevenue: 125000000,
          totalTicketsSold: 450,
          activeUsers: 128,
          pendingReports: 3
        });
        
        setRecentReports([
          { id: 1, user: 'علی محمدی', category: 'مشکل در پرداخت', status: 'in_progress', date: '1402/05/28' },
          { id: 2, user: 'سارا رضایی', category: 'لغو بلیت', status: 'pending', date: '1402/05/29' }
        ]);

      } catch (error) {
        console.error('Error fetching admin data:', error);
        toast.error('خطا در دریافت اطلاعات مدیریتی');
      } finally {
        setLoading(false);
      }
    };

    fetchAdminData();
  }, []);

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col hidden md:flex">
        <div className="p-6 border-b border-gray-800">
          <span className="text-2xl block mb-2">👑</span>
          <h1 className="text-xl font-bold text-white">پنل مدیریت سیستم</h1>
          <span className="text-xs text-gray-400">دسترسی ادمین کل</span>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`w-full text-right px-4 py-3 rounded-xl transition-all ${activeTab === 'overview' ? 'bg-blue-600 text-white font-bold' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
          >
            📊 نمای کلی و آمار
          </button>
          <button 
            onClick={() => setActiveTab('tickets')}
            className={`w-full text-right px-4 py-3 rounded-xl transition-all ${activeTab === 'tickets' ? 'bg-blue-600 text-white font-bold' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
          >
            🎟️ مدیریت بلیت‌ها
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`w-full text-right px-4 py-3 rounded-xl transition-all ${activeTab === 'users' ? 'bg-blue-600 text-white font-bold' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
          >
            👥 لیست کاربران
          </button>
          <button 
            onClick={() => setActiveTab('reports')}
            className={`w-full text-right px-4 py-3 rounded-xl transition-all flex justify-between items-center ${activeTab === 'reports' ? 'bg-blue-600 text-white font-bold' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
          >
            <span>🎧 تیکت‌های پشتیبانی</span>
            {stats.pendingReports > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{stats.pendingReports}</span>
            )}
          </button>
        </nav>
        <div className="p-4 border-t border-gray-800">
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-full text-right px-4 py-3 text-sm text-gray-400 hover:text-white transition-all"
          >
            ← بازگشت به سایت
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-8">
        
        {/* Top Header */}
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-black text-gray-800">
              {activeTab === 'overview' ? 'آمار و گزارشات تحلیلی' : 
               activeTab === 'tickets' ? 'مدیریت بلیت‌ها و مسابقات' : 
               activeTab === 'users' ? 'کاربران سیستم' : 'پاسخ به تیکت‌ها'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">خلاصه وضعیت سیستم در ۲۴ ساعت گذشته</p>
          </div>
        </header>

        {loading ? (
          <div className="text-center py-20 text-gray-500 animate-pulse font-bold text-lg">در حال دریافت داده‌های تحلیلی...</div>
        ) : (
          <>
            {/* Overview Tab Content */}
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {/* 4 Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <span className="text-sm font-bold text-gray-500">درآمد کل سیستم</span>
                    <h3 className="text-2xl font-black text-green-600 mt-2">{Number(stats.totalRevenue).toLocaleString()} <span className="text-sm font-normal">تومان</span></h3>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <span className="text-sm font-bold text-gray-500">بلیت‌های فروخته شده</span>
                    <h3 className="text-2xl font-black text-gray-800 mt-2">{stats.totalTicketsSold} <span className="text-sm font-normal">عدد</span></h3>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <span className="text-sm font-bold text-gray-500">کاربران فعال</span>
                    <h3 className="text-2xl font-black text-blue-600 mt-2">{stats.activeUsers} <span className="text-sm font-normal">نفر</span></h3>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <span className="text-sm font-bold text-gray-500">تیکت‌های باز</span>
                    <h3 className="text-2xl font-black text-red-600 mt-2">{stats.pendingReports} <span className="text-sm font-normal">مورد</span></h3>
                  </div>
                </div>

                {/* Recent Reports Table Preview */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-gray-800">آخرین تیکت‌های دریافتی</h3>
                    <button onClick={() => setActiveTab('reports')} className="text-sm font-bold text-blue-600">مشاهده همه →</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm text-gray-600">
                      <thead className="bg-gray-50 text-gray-700 font-bold">
                        <tr>
                          <th className="px-4 py-3 rounded-r-lg">شناسه</th>
                          <th className="px-4 py-3">کاربر</th>
                          <th className="px-4 py-3">موضوع</th>
                          <th className="px-4 py-3">تاریخ</th>
                          <th className="px-4 py-3 rounded-l-lg">وضعیت</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {recentReports.map(report => (
                          <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-4 font-bold text-gray-900">#{report.id}</td>
                            <td className="px-4 py-4">{report.user}</td>
                            <td className="px-4 py-4">{report.category}</td>
                            <td className="px-4 py-4">{report.date}</td>
                            <td className="px-4 py-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-bold ${report.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                                {report.status === 'pending' ? 'در انتظار' : 'در حال بررسی'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Empty States for other tabs */}
            {activeTab !== 'overview' && (
              <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                <span className="text-4xl block mb-4">🚧</span>
                <h3 className="text-lg font-bold text-gray-800 mb-2">این بخش در حال توسعه است</h3>
                <p className="text-gray-500 text-sm">به زودی اتصال به دیتابیس برای این قسمت برقرار می‌شود.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}