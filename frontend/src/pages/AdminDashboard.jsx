import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';

export default function AdminDashboard() {
  const navigate = useNavigate();
  // Active tabs: overview, tickets, users, reports, audit
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);

  const [stats, setStats] = useState({
    total_revenue: 0,
    total_tickets_sold: 0,
    total_cancellations: 0,
    pending_reports: 0
  });

  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [adminResponseText, setAdminResponseText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  const [users, setUsers] = useState([]);
  const [tickets, setTickets] = useState([]);
  
  // 🚀 NEW: Audit Logs State
  const [auditLogs, setAuditLogs] = useState([]);

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

  // 🚀 NEW: Fetch Audit Logs
  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/audit-logs');
      const data = response.data || [];
      setAuditLogs(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error('Failed to retrieve audit logs.');
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
    if (activeTab === 'audit' && auditLogs.length === 0) fetchAuditLogs();
  }, [activeTab, users.length, tickets.length, auditLogs.length]);

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

  // CSS Class Constants for 79-char strict limit
  const navBtnBase = "w-full text-left px-4 py-3 rounded-xl " + 
                     "transition-all flex justify-between items-center ";
  const navBtnActive = "bg-indigo-600 text-white shadow-lg " + 
                       "shadow-indigo-500/20";
  const navBtnIdle = "text-gray-400 hover:bg-white/5 hover:text-white";

  const cardClass = "bg-white/5 backdrop-blur-xl p-6 rounded-2xl " + 
                    "border border-white/10 shadow-xl";
  const panelClass = "bg-white/5 backdrop-blur-xl rounded-3xl border " + 
                     "border-white/10 p-6 shadow-2xl";
  const tableHead = "bg-white/5 text-gray-400 uppercase tracking-wider " + 
                    "text-[10px] font-bold";
  
  const statusActive = "bg-emerald-500/10 text-emerald-400 " + 
                       "border-emerald-500/20";
  const statusWarn = "bg-amber-500/10 text-amber-400 border-amber-500/20";
  const statusBadgeBase = "px-2.5 py-1 rounded-full text-[10px] " + 
                          "font-bold border ";

  return (
    <div 
      className={
        "flex h-screen bg-[#0a0a0a] text-gray-100 font-sans overflow-hidden"
      }
    >
      <aside 
        className={
          "w-64 bg-black/40 border-r border-white/10 backdrop-blur-xl " +
          "hidden md:flex flex-col"
        }
      >
        <div className="p-6 border-b border-white/10">
          <span className="text-2xl block mb-2">⚡</span>
          <h1 className="text-lg font-bold text-white">Admin Control</h1>
          <span 
            className={
              "text-[10px] uppercase tracking-wider text-indigo-400 " +
              "font-semibold"
            }
          >
            Management Console
          </span>
        </div>

        <nav className="flex-1 p-4 space-y-2 text-xs font-semibold">
          <button 
            onClick={() => setActiveTab('overview')}
            className={
              navBtnBase + (activeTab === 'overview' 
                ? navBtnActive : navBtnIdle)
            }
          >
            <span>📊 Overview & Analytics</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('tickets')}
            className={
              navBtnBase + (activeTab === 'tickets' 
                ? navBtnActive : navBtnIdle)
            }
          >
            <span>🎟️ Ticket Management</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('users')}
            className={
              navBtnBase + (activeTab === 'users' 
                ? navBtnActive : navBtnIdle)
            }
          >
            <span>👥 User Accounts</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('reports')}
            className={
              navBtnBase + (activeTab === 'reports' 
                ? navBtnActive : navBtnIdle)
            }
          >
            <span>🎧 Support Tickets</span>
            {stats.pending_reports > 0 && (
              <span 
                className={
                  "bg-rose-500 text-white text-[10px] px-2 py-0.5 " +
                  "rounded-full font-bold animate-pulse"
                }
              >
                {stats.pending_reports}
              </span>
            )}
          </button>

          {/* 🚀 NEW: Audit Logs Sidebar Button */}
          <button 
            onClick={() => setActiveTab('audit')}
            className={
              navBtnBase + (activeTab === 'audit' 
                ? navBtnActive : navBtnIdle)
            }
          >
            <span>📜 System Audit Logs</span>
          </button>
        </nav>

        <div className="p-4 border-t border-white/10">
          <button 
            onClick={() => navigate('/dashboard')}
            className={
              "w-full text-left px-4 py-3 text-xs text-gray-400 " +
              "hover:text-white transition-all font-semibold"
            }
          >
            ← Exit to Platform
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        <header className="mb-8">
          <h2 className="text-2xl font-black text-white tracking-tight">
            {activeTab === 'overview' && 'System Analytics & Overview'}
            {activeTab === 'tickets' && 'Event Tickets Management'}
            {activeTab === 'users' && 'Registered User Database'}
            {activeTab === 'reports' && 'Support Ticket Resolution'}
            {activeTab === 'audit' && 'Security & Audit Logs'}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Enterprise sports reservation platform administration
          </p>
        </header>

        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className={cardClass}>
                <span 
                  className={
                    "text-[10px] font-bold text-gray-400 uppercase " +
                    "tracking-wider block mb-1"
                  }
                >
                  Total Revenue
                </span>
                <h3 className="text-2xl font-black text-emerald-400 mt-2">
                  {Number(stats.total_revenue).toLocaleString()} 
                  <span className="text-xs font-normal text-gray-400 ml-1">
                    Toman
                  </span>
                </h3>
              </div>
              <div className={cardClass}>
                <span 
                  className={
                    "text-[10px] font-bold text-gray-400 uppercase " +
                    "tracking-wider block mb-1"
                  }
                >
                  Tickets Sold
                </span>
                <h3 className="text-2xl font-black text-white mt-2">
                  {stats.total_tickets_sold}
                </h3>
              </div>
              <div className={cardClass}>
                <span 
                  className={
                    "text-[10px] font-bold text-gray-400 uppercase " +
                    "tracking-wider block mb-1"
                  }
                >
                  Cancellations
                </span>
                <h3 className="text-2xl font-black text-amber-400 mt-2">
                  {stats.total_cancellations}
                </h3>
              </div>
              <div className={cardClass}>
                <span 
                  className={
                    "text-[10px] font-bold text-gray-400 uppercase " +
                    "tracking-wider block mb-1"
                  }
                >
                  Pending Reports
                </span>
                <h3 className="text-2xl font-black text-rose-400 mt-2">
                  {stats.pending_reports}
                </h3>
              </div>
            </div>

            <div className={panelClass}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-base font-bold text-white">
                  Recent Support Tickets
                </h3>
                <button 
                  onClick={() => setActiveTab('reports')} 
                  className={
                    "text-xs font-bold text-indigo-400 " +
                    "hover:text-indigo-300"
                  }
                >
                  View All →
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className={tableHead}>
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
                        <td 
                          colSpan="4" 
                          className="text-center py-8 text-gray-500"
                        >
                          No reports found.
                        </td>
                      </tr>
                    ) : (
                      reports.slice(0, 5).map((r) => (
                        <tr key={r.report_id} 
                            className="hover:bg-white/[0.02]">
                          <td className="px-4 py-4 font-bold">
                            #{r.report_id}
                          </td>
                          <td className="px-4 py-4">{r.user_name}</td>
                          <td className="px-4 py-4">{r.category}</td>
                          <td className="px-4 py-4">
                            <span 
                              className={
                                statusBadgeBase + 
                                (r.status === 'resolved' || 
                                 r.status === 'closed' 
                                  ? statusActive : statusWarn)
                              }
                            >
                              {r.status === 'resolved' || 
                               r.status === 'closed' 
                                ? 'Resolved' : 'Pending'}
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

        {activeTab === 'users' && (
          <div className={panelClass}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className={tableHead}>
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
                        <span 
                          className={
                            "bg-indigo-500/10 text-indigo-400 border " +
                            "border-indigo-500/20 px-2.5 py-1 " +
                            "rounded-full font-bold uppercase text-[10px]"
                          }
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {new Date(u.created_at).toLocaleDateString('en-US')}
                      </td>
                      <td className="px-4 py-3">
                        <span 
                          className={
                            statusBadgeBase + 
                            (u.is_active 
                              ? statusActive 
                              : "bg-rose-500/10 text-rose-400 " +
                                "border-rose-500/20")
                          }
                        >
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

        {activeTab === 'tickets' && (
          <div className={panelClass}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className={tableHead}>
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
                        <span 
                          className={
                            statusBadgeBase + 
                            (t.is_active 
                              ? statusActive 
                              : "bg-white/5 text-gray-400 border-white/10")
                          }
                        >
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

        {/* 🚀 NEW: Audit Logs Management Tab */}
        {activeTab === 'audit' && (
          <div className={panelClass}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className={tableHead}>
                  <tr>
                    <th className="px-4 py-3 rounded-l-xl">Log ID</th>
                    <th className="px-4 py-3">Reservation ID</th>
                    <th className="px-4 py-3">Previous Status</th>
                    <th className="px-4 py-3">New Status</th>
                    <th className="px-4 py-3 rounded-r-xl">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center py-8">
                        No audit logs available.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.log_id} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-3 font-bold text-gray-400">
                          #{log.log_id}
                        </td>
                        <td className="px-4 py-3 font-bold text-white">
                          #{log.reservation_id}
                        </td>
                        <td className="px-4 py-3">
                          <span 
                            className={
                              statusBadgeBase + 
                              "bg-white/5 text-gray-400 border-white/10"
                            }
                          >
                            {log.old_status || 'None'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span 
                            className={
                              statusBadgeBase + 
                              "bg-indigo-500/10 text-indigo-400 " +
                              "border-indigo-500/20"
                            }
                          >
                            {log.new_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {new Date(log.changed_at).toLocaleString('en-US')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div 
              className={
                "lg:col-span-1 bg-white/5 backdrop-blur-xl p-6 rounded-3xl " +
                "border border-white/10 space-y-3 max-h-[700px] " +
                "overflow-y-auto shadow-2xl"
              }
            >
              <h3 className="text-base font-bold text-white mb-4">
                Support Queue
              </h3>
              {loading ? (
                <div 
                  className={
                    "text-center py-8 text-gray-500 text-xs animate-pulse"
                  }
                >
                  Loading tickets...
                </div>
              ) : reports.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-xs">
                  No reports submitted.
                </div>
              ) : (
                reports.map((report) => {
                  const rId = report.report_id || report.id;
                  const isSel = selectedReport && 
                                (selectedReport.report_id === rId);
                  
                  return (
                    <div 
                      key={rId}
                      onClick={() => {
                        setSelectedReport(report);
                        setAdminResponseText(report.admin_response || '');
                      }}
                      className={
                        "p-4 rounded-2xl border transition-all " +
                        "cursor-pointer " + 
                        (isSel 
                          ? "border-indigo-500 bg-indigo-500/10 shadow-lg" 
                          : "border-white/5 bg-black/30 hover:bg-white/5")
                      }
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-white text-xs">
                          {report.category || 'Support Ticket'}
                        </span>
                        <span 
                          className={
                            statusBadgeBase + 
                            (report.status === 'resolved' || 
                             report.status === 'closed' 
                              ? statusActive : statusWarn)
                          }
                        >
                          {report.status === 'resolved' || 
                           report.status === 'closed' ? 'Resolved' : 'Pending'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 line-clamp-2">
                        {report.report_text || 'No text'}
                      </p>
                      <div 
                        className={
                          "mt-2 text-[10px] text-gray-500 flex " +
                          "justify-between"
                        }
                      >
                        <span>Ticket #{rId}</span>
                        <span>
                          {report.created_at 
                            ? new Date(report.created_at)
                                .toLocaleDateString('en-US') 
                            : ''}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div 
              className={
                "lg:col-span-2 bg-white/5 backdrop-blur-xl p-8 rounded-3xl " +
                "border border-white/10 shadow-2xl"
              }
            >
              {selectedReport ? (
                <div className="space-y-6">
                  <div 
                    className={
                      "border-b border-white/10 pb-4 flex justify-between " +
                      "items-start"
                    }
                  >
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1">
                        {selectedReport.category || 'Support Ticket'}
                      </h3>
                      <span className="text-xs text-gray-400">
                        Ticket ID: #{
                          selectedReport.report_id || selectedReport.id
                        } 
                        {selectedReport.user_name 
                          ? ` | User: ${selectedReport.user_name}` : ''}
                      </span>
                    </div>
                    <span 
                      className={
                        statusBadgeBase + 
                        (selectedReport.status === 'resolved' || 
                         selectedReport.status === 'closed' 
                          ? statusActive : statusWarn)
                      }
                    >
                      {selectedReport.status === 'resolved' || 
                       selectedReport.status === 'closed' 
                        ? 'Resolved' : 'Pending Action'}
                    </span>
                  </div>

                  <div 
                    className={
                      "bg-black/40 p-4 rounded-2xl border border-white/5 " +
                      "space-y-2"
                    }
                  >
                    <span 
                      className={
                        "text-[10px] font-bold text-gray-400 uppercase " +
                        "tracking-wider block"
                      }
                    >
                      User Message:
                    </span>
                    <p 
                      className={
                        "text-xs text-gray-200 leading-relaxed " +
                        "whitespace-pre-line"
                      }
                    >
                      {selectedReport.report_text || 'No message provided'}
                    </p>
                  </div>

                  <form 
                    onSubmit={handleReplySubmit} 
                    className="space-y-4 pt-2"
                  >
                    <div>
                      <label 
                        className={
                          "block text-xs font-bold text-gray-400 uppercase " +
                          "tracking-wider mb-2"
                        }
                      >
                        Admin Response:
                      </label>
                      <textarea
                        rows="5"
                        placeholder="Type your official response here..."
                        value={adminResponseText}
                        onChange={(e) => setAdminResponseText(e.target.value)}
                        className={
                          "w-full px-4 py-3 bg-white/5 border " +
                          "border-white/10 rounded-xl focus:outline-none " +
                          "focus:border-indigo-500 text-xs text-white " +
                          "placeholder-gray-500 resize-none"
                        }
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submittingReply}
                      className={
                        "px-6 py-3.5 bg-gradient-to-r from-indigo-600 " +
                        "to-blue-600 hover:from-indigo-500 " +
                        "hover:to-blue-500 text-white font-bold text-xs " +
                        "uppercase tracking-wider rounded-xl transition-all " +
                        "shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                      }
                    >
                      {submittingReply 
                        ? 'Registering Response...' 
                        : 'Submit Support Reply →'}
                    </button>
                  </form>
                </div>
              ) : (
                <div className="text-center py-32 text-gray-500">
                  <span className="text-5xl block mb-3">👈</span>
                  <p className="text-xs font-medium">
                    Select a support ticket from the sidebar queue to view.
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