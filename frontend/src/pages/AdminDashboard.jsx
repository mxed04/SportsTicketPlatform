import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';

export default function AdminDashboard() {
  const navigate = useNavigate();
  // Active tabs: overview, tickets, users, reports
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

  // Fetch and sort all support reports
  const fetchAllReports = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/reports');
      const data = response.data?.reports || response.data || [];
      const list = Array.isArray(data) ? data : [];
      
      list.sort((a, b) => {
        const idA = a.report_id || a.id || 0;
        const idB = b.report_id || b.id || 0;
        return idB - idA;
      });
      
      setReports(list);
    } catch (error) {
      toast.error('Failed to retrieve support tickets.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch and sort all users
  const fetchAllUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/users');
      const data = response.data || [];
      const list = Array.isArray(data) ? data : [];
      
      list.sort((a, b) => {
        const idA = a.user_id || a.id || 0;
        const idB = b.user_id || b.id || 0;
        return idB - idA;
      });

      setUsers(list);
    } catch (error) {
      toast.error('Failed to retrieve users list.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch and sort all tickets
  const fetchAllTickets = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/tickets');
      const data = response.data || [];
      const list = Array.isArray(data) ? data : [];
      
      list.sort((a, b) => {
        const idA = a.ticket_id || a.id || 0;
        const idB = b.ticket_id || b.id || 0;
        return idB - idA;
      });

      setTickets(list);
    } catch (error) {
      toast.error('Failed to retrieve tickets list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
    fetchAllReports();
  }, []);

  useEffect(() => {
    if (activeTab === 'users' && users.length === 0) fetchAllUsers();
    if (activeTab === 'tickets' && tickets.length === 0) fetchAllTickets();
  }, [activeTab, users.length, tickets.length]);

  // Submit admin response
  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!selectedReport) return;
    if (!adminResponseText.trim()) {
      toast.error('Please enter a response text.');
      return;
    }

    setSubmittingReply(true);
    const reportId = selectedReport.report_id || selectedReport.id;

    try {
      await api.put(`/admin/reports/${reportId}/reply`, {
        admin_response: adminResponseText,
        status: 'resolved'
      });

      toast.success('Support response registered successfully.');
      setAdminResponseText('');
      setSelectedReport(null);
      fetchAllReports();
      fetchDashboardStats();
    } catch (error) {
      toast.error('Failed to register response.');
    } finally {
      setSubmittingReply(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-gray-100 font-sans overflow-hidden">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-black/40 border-r border-white/10 backdrop-blur-xl hidden md:flex flex-col">
        <div className="p-6 border-b border-white/10">
          <span className="text-2xl block mb-2">⚡</span>
          <h1 className="text-lg font-bold text-white">Admin Control</h1>
          <span className="text-[10px] uppercase tracking-wider text-indigo-400 font-semibold">Management Console</span>
        </div>

        <nav className="flex-1 p-4 space-y-2 text-xs font-semibold">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
              activeTab === 'overview' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            📊 Overview & Analytics
          </button>
          
          <button 
            onClick={() => setActiveTab('tickets')}
            className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
              activeTab === 'tickets' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            🎟️ Ticket Management
          </button>
          
          <button 
            onClick={() => setActiveTab('users')}
            className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
              activeTab === 'users' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            👥 User Accounts
          </button>
          
          <button 
            onClick={() => setActiveTab('reports')}
            className={`w-full text-left px-4 py-3 rounded-xl transition-all flex justify-between items-center ${
              activeTab === 'reports' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span>🎧 Support Tickets</span>
            {stats.pending_reports > 0 && (
              <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse">
                {stats.pending_reports}
              </span>
            )}
          </button>
        </nav>

        <div className="p-4 border-t border-white/10">
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-full text-left px-4 py-3 text-xs text-gray-400 hover:text-white transition-all font-semibold"
          >
            ← Exit to Platform
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-8">
        
        <header className="mb-8">
          <h2 className="text-2xl font-black text-white tracking-tight">
            {activeTab === 'overview' && 'System Analytics & Overview'}
            {activeTab === 'tickets' && 'Event Tickets Management'}
            {activeTab === 'users' && 'Registered User Database'}
            {activeTab === 'reports' && 'Support Ticket Resolution Center'}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Enterprise sports reservation platform administration
          </p>
        </header>

        {/* Tab: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white/5 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-xl">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Total Revenue</span>
                <h3 className="text-2xl font-black text-emerald-400 mt-2">
                  {Number(stats.total_revenue).toLocaleString()} 
                  <span className="text-xs font-normal text-gray-400 ml-1">Toman</span>
                </h3>
              </div>
              <div className="bg-white/5 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-xl">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Tickets Sold</span>
                <h3 className="text-2xl font-black text-white mt-2">
                  {stats.total_tickets_sold}
                </h3>
              </div>
              <div className="bg-white/5 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-xl">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Cancellations</span>
                <h3 className="text-2xl font-black text-amber-400 mt-2">
                  {stats.total_cancellations}
                </h3>
              </div>
              <div className="bg-white/5 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-xl">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Pending Reports</span>
                <h3 className="text-2xl font-black text-rose-400 mt-2">
                  {stats.pending_reports}
                </h3>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-base font-bold text-white">Recent Support Tickets</h3>
                <button 
                  onClick={() => setActiveTab('reports')} 
                  className="text-xs font-bold text-indigo-400 hover:text-indigo-300"
                >
                  View All →
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="bg-white/5 text-gray-400 uppercase tracking-wider text-[10px] font-bold">
                    <tr>
                      <th className="px-4 py-3 rounded-l-xl">ID</th>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3 rounded-r-xl">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {reports.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="text-center py-8 text-gray-500">
                          No reports found.
                        </td>
                      </tr>
                    ) : (
                      reports.slice(0, 5).map((r) => (
                        <tr key={r.report_id} className="hover:bg-white/[0.02]">
                          <td className="px-4 py-4 font-bold">#{r.report_id}</td>
                          <td className="px-4 py-4">{r.user_name}</td>
                          <td className="px-4 py-4">{r.category}</td>
                          <td className="px-4 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                              r.status === 'resolved' || r.status === 'closed' 
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            }`}>
                              {r.status === 'resolved' || r.status === 'closed' ? 'Resolved' : 'Pending'}
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
          <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-white/5 text-gray-400 uppercase tracking-wider text-[10px] font-bold">
                  <tr>
                    <th className="px-4 py-3 rounded-l-xl">ID</th>
                    <th className="px-4 py-3">Full Name</th>
                    <th className="px-4 py-3">Phone Number</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Joined Date</th>
                    <th className="px-4 py-3 rounded-r-xl">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map((u) => (
                    <tr key={u.user_id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-bold">#{u.user_id}</td>
                      <td className="px-4 py-3 font-semibold text-white">
                        {u.first_name} {u.last_name}
                      </td>
                      <td className="px-4 py-3">{u.phone_number}</td>
                      <td className="px-4 py-3">
                        <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded-full font-bold uppercase text-[10px]">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {new Date(u.created_at).toLocaleDateString('en-US')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          u.is_active 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {u.is_active ? 'Active' : 'Deactivated'}
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
          <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-white/5 text-gray-400 uppercase tracking-wider text-[10px] font-bold">
                  <tr>
                    <th className="px-4 py-3 rounded-l-xl">ID</th>
                    <th className="px-4 py-3">Teams Match</th>
                    <th className="px-4 py-3">Match Date</th>
                    <th className="px-4 py-3">Price (Toman)</th>
                    <th className="px-4 py-3">Remaining Capacity</th>
                    <th className="px-4 py-3 rounded-r-xl">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {tickets.map((t) => (
                    <tr key={t.ticket_id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-bold">#{t.ticket_id}</td>
                      <td className="px-4 py-3 font-bold text-white">
                        {t.home_team} vs {t.away_team}
                      </td>
                      <td className="px-4 py-3">
                        {new Date(t.match_date).toLocaleDateString('en-US')}
                      </td>
                      <td className="px-4 py-3 text-emerald-400 font-bold">
                        {Number(t.price).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">{t.remaining_capacity}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          t.is_active 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : 'bg-white/5 text-gray-400 border-white/10'
                        }`}>
                          {t.is_active ? 'Active' : 'Closed'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab: Support & Reports Management */}
        {activeTab === 'reports' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <div className="lg:col-span-1 bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-white/10 space-y-3 max-h-[700px] overflow-y-auto shadow-2xl">
              <h3 className="text-base font-bold text-white mb-4">Support Queue</h3>
              {loading ? (
                <div className="text-center py-8 text-gray-500 text-xs animate-pulse">Loading tickets...</div>
              ) : reports.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-xs">No reports submitted.</div>
              ) : (
                reports.map((report) => {
                  const rId = report.report_id || report.id;
                  const isSelected = selectedReport && (selectedReport.report_id === rId);
                  
                  return (
                    <div 
                      key={rId}
                      onClick={() => {
                        setSelectedReport(report);
                        setAdminResponseText(report.admin_response || '');
                      }}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        isSelected 
                          ? 'border-indigo-500 bg-indigo-500/10 shadow-lg' 
                          : 'border-white/5 bg-black/30 hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-white text-xs">
                          {report.category || 'Support Ticket'}
                        </span>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${
                          report.status === 'resolved' || report.status === 'closed' 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {report.status === 'resolved' || report.status === 'closed' ? 'Resolved' : 'Pending'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 line-clamp-2">{report.report_text || 'No text'}</p>
                      <div className="mt-2 text-[10px] text-gray-500 flex justify-between">
                        <span>Ticket #{rId}</span>
                        <span>{report.created_at ? new Date(report.created_at).toLocaleDateString('en-US') : ''}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="lg:col-span-2 bg-white/5 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl">
              {selectedReport ? (
                <div className="space-y-6">
                  <div className="border-b border-white/10 pb-4 flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1">
                        {selectedReport.category || 'Support Ticket'}
                      </h3>
                      <span className="text-xs text-gray-400">
                        Ticket ID: #{selectedReport.report_id || selectedReport.id} 
                        {selectedReport.user_name ? ` | User: ${selectedReport.user_name}` : ''}
                      </span>
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full font-bold border ${
                      selectedReport.status === 'resolved' || selectedReport.status === 'closed' 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>
                      {selectedReport.status === 'resolved' || selectedReport.status === 'closed' ? 'Resolved' : 'Pending Action'}
                    </span>
                  </div>

                  <div className="bg-black/40 p-4 rounded-2xl border border-white/5 space-y-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">User Message:</span>
                    <p className="text-xs text-gray-200 leading-relaxed whitespace-pre-line">
                      {selectedReport.report_text || 'No message provided'}
                    </p>
                  </div>

                  <form onSubmit={handleReplySubmit} className="space-y-4 pt-2">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                        Admin Response:
                      </label>
                      <textarea
                        rows="5"
                        placeholder="Type your official response here..."
                        value={adminResponseText}
                        onChange={(e) => setAdminResponseText(e.target.value)}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-indigo-500 text-xs text-white placeholder-gray-500 resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submittingReply}
                      className="px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                    >
                      {submittingReply ? 'Registering Response...' : 'Submit Support Reply →'}
                    </button>
                  </form>
                </div>
              ) : (
                <div className="text-center py-32 text-gray-500">
                  <span className="text-5xl block mb-3">👈</span>
                  <p className="text-xs font-medium">Select a support ticket from the sidebar queue to view details.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}