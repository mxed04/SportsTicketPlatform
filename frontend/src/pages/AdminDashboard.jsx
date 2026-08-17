import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';

export default function AdminDashboard() {
  const navigate = useNavigate();
  // Active tab: overview, tickets, users, reports
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);

  // Dashboard Stats State
  const [stats, setStats] = useState({
    total_revenue: 0,
    total_tickets_sold: 0,
    total_cancellations: 0,
    pending_reports: 0
  });

  // Support Reports State
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [adminResponseText, setAdminResponseText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Users and Tickets State
  const [users, setUsers] = useState([]);
  const [tickets, setTickets] = useState([]);

  // Fetch admin dashboard stats
  const fetchDashboardStats = async () => {
    try {
      const response = await api.get('/admin/dashboard-stats');
      if (response.data) {
        setStats({
          total_revenue: response.data.total_revenue ?? 0,
          total_tickets_sold: response.data.total_tickets_sold ?? 0,
          total_cancellations: response.data.total_cancellations ?? 0,
          pending_reports: response.data.pending_reports ?? 0
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  };

  // Fetch and sort all support reports (Highest ID first)
  const fetchAllReports = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/reports');
      const data = response.data?.reports || response.data || [];
      const list = Array.isArray(data) ? data : [];
      
      // Sort reports by ID descending
      list.sort((a, b) => {
        const idA = a.report_id || a.id || 0;
        const idB = b.report_id || b.id || 0;
        return idB - idA;
      });
      
      setReports(list);
    } catch (error) {
      toast.error('خطا در دریافت لیست تیکت‌ها');
    } finally {
      setLoading(false);
    }
  };

  // Fetch and sort all users (Highest ID first)
  const fetchAllUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/users');
      const data = response.data || [];
      const list = Array.isArray(data) ? data : [];
      
      // Sort users by ID descending
      list.sort((a, b) => {
        const idA = a.user_id || a.id || 0;
        const idB = b.user_id || b.id || 0;
        return idB - idA;
      });

      setUsers(list);
    } catch (error) {
      toast.error('خطا در دریافت لیست کاربران');
    } finally {
      setLoading(false);
    }
  };

  // Fetch and sort all tickets (Highest ID first)
  const fetchAllTickets = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/tickets');
      const data = response.data || [];
      const list = Array.isArray(data) ? data : [];
      
      // Sort tickets by ID descending
      list.sort((a, b) => {
        const idA = a.ticket_id || a.id || 0;
        const idB = b.ticket_id || b.id || 0;
        return idB - idA;
      });

      setTickets(list);
    } catch (error) {
      toast.error('خطا در دریافت لیست بلیت‌ها');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchDashboardStats();
    fetchAllReports();
  }, []);

  // Lazy load tabs data
  useEffect(() => {
    if (activeTab === 'users' && users.length === 0) fetchAllUsers();
    if (activeTab === 'tickets' && tickets.length === 0) fetchAllTickets();
  }, [activeTab, users.length, tickets.length]);

  // Submit admin response
  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!selectedReport) return;
    if (!adminResponseText.trim()) {
      toast.error('لطفاً متن پاسخ را وارد کنید.');
      return;
    }

    setSubmittingReply(true);
    const reportId = selectedReport.report_id || selectedReport.id;

    try {
      await api.put(`/admin/reports/${reportId}/reply`, {
        admin_response: adminResponseText,
        status: 'resolved'
      });

      toast.success('پاسخ پشتیبان با موفقیت ثبت شد.');
      setAdminResponseText('');
      setSelectedReport(null);
      fetchAllReports();
      fetchDashboardStats();
    } catch (error) {
      toast.error('خطا در ثبت پاسخ');
    } finally {
      setSubmittingReply(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden" dir="rtl">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-gray-900 text-white hidden md:flex flex-col">
        <div className="p-6 border-b border-gray-800">
          <span className="text-2xl block mb-2">👑</span>
          <h1 className="text-xl font-bold text-white">پنل مدیریت سیستم</h1>
          <span className="text-xs text-gray-400">دسترسی ادمین / پشتیبان</span>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`w-full text-right px-4 py-3 rounded-xl transition-all ${
              activeTab === 'overview' 
                ? 'bg-blue-600 text-white font-bold' 
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            📊 نمای کلی و آمار
          </button>
          
          <button 
            onClick={() => setActiveTab('tickets')}
            className={`w-full text-right px-4 py-3 rounded-xl transition-all ${
              activeTab === 'tickets' 
                ? 'bg-blue-600 text-white font-bold' 
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            🎟️ مدیریت بلیت‌ها
          </button>
          
          <button 
            onClick={() => setActiveTab('users')}
            className={`w-full text-right px-4 py-3 rounded-xl transition-all ${
              activeTab === 'users' 
                ? 'bg-blue-600 text-white font-bold' 
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            👥 لیست کاربران
          </button>
          
          <button 
            onClick={() => setActiveTab('reports')}
            className={`w-full text-right px-4 py-3 rounded-xl transition-all flex justify-between items-center ${
              activeTab === 'reports' 
                ? 'bg-blue-600 text-white font-bold' 
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <span>🎧 پاسخ به تیکت‌ها</span>
            {stats.pending_reports > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                {stats.pending_reports}
              </span>
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
        
        <header className="mb-8">
          <h2 className="text-2xl font-black text-gray-800">
            {activeTab === 'overview' && 'آمار و گزارشات تحلیلی'}
            {activeTab === 'tickets' && 'مدیریت بلیت‌ها و مسابقات'}
            {activeTab === 'users' && 'کاربران سیستم'}
            {activeTab === 'reports' && 'مدیریت تیکت‌ها و پاسخ به کاربران'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            مدیریت یکپارچه سامانه رزرو بلیت ورزشی
          </p>
        </header>

        {/* Tab: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <span className="text-sm font-bold text-gray-500">درآمد کل</span>
                <h3 className="text-2xl font-black text-green-600 mt-2">
                  {Number(stats.total_revenue).toLocaleString()} 
                  <span className="text-sm font-normal mr-1">تومان</span>
                </h3>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <span className="text-sm font-bold text-gray-500">بلیت‌های فروخته شده</span>
                <h3 className="text-2xl font-black text-gray-800 mt-2">
                  {stats.total_tickets_sold}
                </h3>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <span className="text-sm font-bold text-gray-500">لغوی‌ها</span>
                <h3 className="text-2xl font-black text-amber-600 mt-2">
                  {stats.total_cancellations}
                </h3>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <span className="text-sm font-bold text-gray-500">در انتظار پاسخ</span>
                <h3 className="text-2xl font-black text-red-600 mt-2">
                  {stats.pending_reports}
                </h3>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-gray-800">
                  آخرین تیکت‌های دریافتی
                </h3>
                <button 
                  onClick={() => setActiveTab('reports')} 
                  className="text-sm font-bold text-blue-600 hover:underline"
                >
                  مشاهده و پاسخ‌دهی →
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm text-gray-600">
                  <thead className="bg-gray-50 text-gray-700 font-bold">
                    <tr>
                      <th className="px-4 py-3 rounded-r-lg">شناسه</th>
                      <th className="px-4 py-3">کاربر</th>
                      <th className="px-4 py-3">موضوع</th>
                      <th className="px-4 py-3 rounded-l-lg">وضعیت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {reports.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="text-center py-6 text-gray-400">
                          تیکتی یافت نشد.
                        </td>
                      </tr>
                    ) : (
                      reports.slice(0, 5).map((r) => (
                        <tr key={r.report_id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 font-bold">#{r.report_id}</td>
                          <td className="px-4 py-4">{r.user_name}</td>
                          <td className="px-4 py-4">{r.category}</td>
                          <td className="px-4 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              r.status === 'resolved' || r.status === 'closed' 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {r.status === 'resolved' || r.status === 'closed' 
                                ? 'پاسخ داده شده' 
                                : 'در انتظار پاسخ'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Users List */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm text-gray-600">
                <thead className="bg-gray-50 text-gray-700 font-bold">
                  <tr>
                    <th className="px-4 py-3">شناسه</th>
                    <th className="px-4 py-3">نام کاربر</th>
                    <th className="px-4 py-3">شماره تماس</th>
                    <th className="px-4 py-3">نقش</th>
                    <th className="px-4 py-3">ثبت نام</th>
                    <th className="px-4 py-3">وضعیت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((u) => (
                    <tr key={u.user_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-bold">#{u.user_id}</td>
                      <td className="px-4 py-3">
                        {u.first_name} {u.last_name}
                      </td>
                      <td className="px-4 py-3">{u.phone_number}</td>
                      <td className="px-4 py-3">
                        <span className="bg-blue-50 text-blue-600 px-2 rounded-lg">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {new Date(u.created_at).toLocaleDateString('fa-IR')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          u.is_active 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {u.is_active ? 'فعال' : 'غیرفعال'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab: Tickets Management */}
        {activeTab === 'tickets' && (
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm text-gray-600">
                <thead className="bg-gray-50 text-gray-700 font-bold">
                  <tr>
                    <th className="px-4 py-3">شناسه</th>
                    <th className="px-4 py-3">تیم‌ها</th>
                    <th className="px-4 py-3">تاریخ مسابقه</th>
                    <th className="px-4 py-3">قیمت (تومان)</th>
                    <th className="px-4 py-3">ظرفیت باقی‌مانده</th>
                    <th className="px-4 py-3">وضعیت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tickets.map((t) => (
                    <tr key={t.ticket_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-bold">#{t.ticket_id}</td>
                      <td className="px-4 py-3 font-bold text-gray-900">
                        {t.home_team} vs {t.away_team}
                      </td>
                      <td className="px-4 py-3">
                        {new Date(t.match_date).toLocaleDateString('fa-IR')}
                      </td>
                      <td className="px-4 py-3 text-green-600 font-bold">
                        {Number(t.price).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {t.remaining_capacity}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          t.is_active 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {t.is_active ? 'فروش باز' : 'بسته شده'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab: Support & Reports Management (Restored Original Layout) */}
        {activeTab === 'reports' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Reports List Column (Appears on the right in RTL) */}
            <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4 max-h-[700px] overflow-y-auto">
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                لیست تیکت‌ها
              </h3>
              {loading ? (
                <div className="text-center py-8 text-gray-500">
                  در حال بارگذاری تیکت‌ها...
                </div>
              ) : reports.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  هیچ تیکتی ثبت نشده است.
                </div>
              ) : (
                reports.map((report) => {
                  const rId = report.report_id || report.id;
                  const isSelected = selectedReport && 
                    (selectedReport.report_id === rId);
                  
                  return (
                    <div 
                      key={rId}
                      onClick={() => {
                        setSelectedReport(report);
                        setAdminResponseText(report.admin_response || '');
                      }}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50 shadow-sm' 
                          : 'border-gray-100 bg-gray-50 hover:bg-white'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-gray-900 text-sm">
                          {report.category || 'تیکت پشتیبانی'}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          report.status === 'resolved' || report.status === 'closed' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {report.status === 'resolved' || report.status === 'closed' 
                            ? 'پاسخ داده شده' 
                            : 'در انتظار'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-2">
                        {report.report_text || 'بدون متن'}
                      </p>
                      <div className="mt-2 text-[10px] text-gray-400 flex justify-between">
                        <span>تیکت #{rId}</span>
                        <span>
                          {report.created_at 
                            ? new Date(report.created_at).toLocaleDateString('fa-IR') 
                            : ''}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Selected Report Details & Reply Form Column (Left side) */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              {selectedReport ? (
                <div className="space-y-6">
                  
                  {/* Header */}
                  <div className="border-b border-gray-100 pb-4 flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-1">
                        {selectedReport.category || 'تیکت پشتیبانی'}
                      </h3>
                      <span className="text-xs text-gray-400">
                        شماره تیکت: #{selectedReport.report_id || selectedReport.id} 
                        {selectedReport.user_name ? ` | کاربر: ${selectedReport.user_name}` : ''}
                      </span>
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full font-bold ${
                      selectedReport.status === 'resolved' || selectedReport.status === 'closed' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {selectedReport.status === 'resolved' || selectedReport.status === 'closed' 
                        ? 'پاسخ داده شده' 
                        : 'در انتظار پاسخ شما'}
                    </span>
                  </div>

                  {/* User Message Display */}
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-2">
                    <span className="text-xs font-bold text-gray-500 block">
                      💬 پیام کاربر:
                    </span>
                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">
                      {selectedReport.report_text || 'بدون متن'}
                    </p>
                  </div>

                  {/* Reply Form */}
                  <form onSubmit={handleReplySubmit} className="space-y-4 pt-2">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        ارسال پاسخ پشتیبان به کاربر:
                      </label>
                      <textarea
                        rows="5"
                        placeholder="متن پاسخ خود را اینجا بنویسید..."
                        value={adminResponseText}
                        onChange={(e) => setAdminResponseText(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submittingReply}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50"
                    >
                      {submittingReply 
                        ? 'در حال ثبت پاسخ...' 
                        : 'ارسال و ثبت پاسخ پشتیبان'}
                    </button>
                  </form>
                </div>
              ) : (
                <div className="text-center py-32 text-gray-400">
                  <span className="text-5xl block mb-3">👈</span>
                  <p className="text-sm font-medium">
                    لطفاً یک تیکت را از منوی سمت راست انتخاب کنید.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}