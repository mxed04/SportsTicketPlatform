import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';

export default function Support() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  // Accordion State
  const [expandedReportId, setExpandedReportId] = useState(null);

  const fetchReports = async () => {
    try {
      const response = await api.get('/reports');
      const data = response.data?.reports || response.data || [];
      setReports(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching support reports:', error);
      toast.error('Failed to retrieve support history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject || !description) {
      toast.error('Please fill in both subject and description.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post('/reports', {
        category: subject,
        report_text: description,
        reservation_id: null
      });

      toast.success(response.data?.message || 'Support request submitted successfully.');
      setSubject('');
      setDescription('');
      fetchReports();
    } catch (error) {
      const msg = error.response?.data?.detail || 'Failed to submit request.';
      toast.error(typeof msg === 'string' ? msg : 'Server error');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleAccordion = (id) => {
    setExpandedReportId(prevId => (prevId === id ? null : id));
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 font-sans pb-16 relative overflow-hidden">
      {/* Ambient Glow */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none"></div>

      {/* Header Navigation */}
      <header className="bg-white/5 border-b border-white/10 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <h1 className="text-lg font-bold text-white tracking-tight">🎧 Support & Helpdesk</h1>
          <button 
            onClick={() => navigate('/dashboard')}
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            ← Back to Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 space-y-8 relative z-10">
        
        {/* Section 1: Submit New Report Form */}
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 p-2.5 rounded-2xl text-xl">📝</span>
            <h2 className="text-lg font-bold text-white">Create New Support Ticket</h2>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Subject / Category</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-indigo-500 text-xs text-white"
              >
                <option value="" disabled className="bg-[#0a0a0a]">Select category...</option>
                <option value="Payment Issue" className="bg-[#0a0a0a]">Payment or Wallet Issue</option>
                <option value="Cancellation & Refund" className="bg-[#0a0a0a]">Cancellation & Refund Request</option>
                <option value="Stadium Entry Issue" className="bg-[#0a0a0a]">Stadium / Venue Access Problem</option>
                <option value="System Bug Report" className="bg-[#0a0a0a]">Report System Bug</option>
                <option value="Other" className="bg-[#0a0a0a]">Other Inquiries</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Description</label>
              <textarea
                rows="4"
                placeholder="Describe your issue in detail..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-indigo-500 text-xs text-white placeholder-gray-500 resize-none"
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full md:w-auto px-8 py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
            >
              {submitting ? 'Submitting Ticket...' : 'Submit Support Request →'}
            </button>
          </form>
        </div>

        {/* Section 2: Previous Reports List with Accordion */}
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <span className="bg-white/5 border border-white/10 text-gray-300 p-2.5 rounded-2xl text-xl">🗂️</span>
            <h2 className="text-lg font-bold text-white">Your Support Tickets</h2>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500 text-xs animate-pulse">Loading support history...</div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12 text-gray-400 bg-black/20 rounded-2xl border border-dashed border-white/10 text-xs">
              You haven't submitted any support tickets yet.
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((report, index) => {
                const reportId = report.id || report.report_id || index;
                const categoryName = report.category || report.subject || 'Support Request';
                const status = report.status;
                const createdDate = report.created_at
                  ? new Date(report.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                  : 'N/A';
                const reportText = report.report_text || report.description || 'No description provided.';
                const isExpanded = expandedReportId === reportId;

                return (
                  <div key={reportId} className="p-5 rounded-2xl border border-white/10 bg-black/30 transition-all space-y-3">
                    
                    <div className="flex justify-between items-center">
                      <span className="font-extrabold text-white text-sm">{categoryName}</span>
                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border ${
                        status === 'resolved' || status === 'closed' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {status === 'resolved' || status === 'closed' ? 'Resolved' : 'Pending Review'}
                      </span>
                    </div>

                    <div className="flex flex-wrap justify-between items-center gap-2 pt-1">
                      <div className="text-xs text-gray-400 flex flex-wrap gap-2 font-medium">
                        <span className="bg-white/5 px-3 py-1 rounded-lg border border-white/10">
                          Ticket ID: #{reportId}
                        </span>
                        <span className="bg-white/5 px-3 py-1 rounded-lg border border-white/10">
                          📅 {createdDate}
                        </span>
                        {report.reservation_id && (
                          <span className="bg-white/5 px-3 py-1 rounded-lg border border-white/10">
                            🎟️ Reservation: #{report.reservation_id}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => toggleAccordion(reportId)}
                        className="text-xs font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1"
                      >
                        {isExpanded ? 'Hide Details ▲' : 'View Details ▼'}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                        <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-xs text-gray-300">
                          <strong className="block text-white font-bold mb-1">💬 Your Message:</strong>
                          <p className="whitespace-pre-line leading-relaxed">{reportText}</p>
                        </div>

                        {report.admin_response ? (
                          <div className="bg-indigo-500/10 border-l-4 border-indigo-500 p-4 rounded-r-xl text-xs text-indigo-200">
                            <strong className="block font-bold mb-1">👨‍💻 Support Response:</strong>
                            <p className="whitespace-pre-line leading-relaxed">{report.admin_response}</p>
                          </div>
                        ) : (
                          <div className="bg-amber-500/10 border-l-4 border-amber-400 p-3.5 rounded-r-xl text-[11px] text-amber-300 font-medium">
                            ⏳ This ticket is currently in queue. An agent will respond shortly.
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}