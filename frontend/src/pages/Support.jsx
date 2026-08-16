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

  // Accordion State: Track currently expanded report ID
  const [expandedReportId, setExpandedReportId] = useState(null);

  // Fetch user's previous reports on component mount
  const fetchReports = async () => {
    try {
      const response = await api.get('/reports/');
      const data = response.data?.reports || response.data || [];
      setReports(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error('خطا در دریافت سابقه پشتیبانی');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  // Handle submitting a new report/complaint
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject || !description) {
      toast.error('لطفاً موضوع و متن گزارش را کامل کنید.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post('/reports/', {
        category: subject,
        report_text: description,
        reservation_id: null
      });

      toast.success(response.data?.message || 'گزارش شما با موفقیت ثبت شد.');
      setSubject('');
      setDescription('');
      
      // Refresh the list to show the newly added report
      fetchReports();
    } catch (error) {
      const msg = error.response?.data?.detail || 'خطا در ثبت گزارش';
      toast.error(typeof msg === 'string' ? msg : 'خطای سرور');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle report details accordion
  const toggleAccordion = (id) => {
    setExpandedReportId(prevId => (prevId === id ? null : id));
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-12">
      {/* Header Navigation */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">🎧 پشتیبانی و تیکت‌ها</h1>
          <button 
            onClick={() => navigate('/dashboard')}
            className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            بازگشت به داشبورد ←
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        
        {/* Section 1: Submit New Report Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-6">
            <span className="bg-blue-50 text-blue-600 p-2 rounded-xl text-xl">📝</span>
            <h2 className="text-lg font-black text-gray-800">ثبت درخواست یا شکایت جدید</h2>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">موضوع درخواست</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
              >
                <option value="" disabled>انتخاب کنید...</option>
                <option value="مشکل در پرداخت">مشکل در پرداخت یا کیف پول</option>
                <option value="لغو بلیت و استرداد وجه">درخواست لغو بلیت و استرداد وجه</option>
                <option value="مشکل در ورود به ورزشگاه">مشکل در ورود به استادیوم/سالن</option>
                <option value="گزارش خرابی سیستم">گزارش خرابی سیستم رزرو</option>
                <option value="سایر موارد">سایر موارد</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">شرح کامل مشکل</label>
              <textarea
                rows="4"
                placeholder="توضیحات خود را اینجا بنویسید..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm resize-none"
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full md:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50"
            >
              {submitting ? 'در حال ارسال...' : 'ارسال درخواست پشتیبانی'}
            </button>
          </form>
        </div>

        {/* Section 2: Previous Reports List with Accordion */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-6">
            <span className="bg-gray-100 text-gray-600 p-2 rounded-xl text-xl">🗂️</span>
            <h2 className="text-lg font-black text-gray-800">تیکت‌ها و درخواست‌های قبلی شما</h2>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500 animate-pulse">در حال بارگذاری تیکت‌ها...</div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              شما تا کنون هیچ درخواستی ثبت نکرده‌اید.
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((report, index) => {
                const reportId = report.id || report.report_id || index;
                const categoryName = report.category || report.subject || 'گزارش پشتیبانی';
                const status = report.status;
                const createdDate = report.created_at
                  ? new Date(report.created_at).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' })
                  : 'تاریخ نامشخص';
                const reportText = report.report_text || report.description || 'توضیحاتی ثبت نشده است.';
                const isExpanded = expandedReportId === reportId;

                return (
                  <div key={reportId} className="p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-white hover:shadow-sm transition-all space-y-3">
                    
                    {/* Header: Title Category & Status Badge */}
                    <div className="flex justify-between items-center">
                      <span className="font-black text-gray-900 text-base">{categoryName}</span>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                        status === 'resolved' || status === 'closed' ? 'bg-green-100 text-green-700' :
                        status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {status === 'resolved' || status === 'closed' ? 'پاسخ داده شده' :
                         status === 'in_progress' ? 'در حال بررسی' : 'در انتظار پاسخ'}
                      </span>
                    </div>

                    {/* Metadata Details Badges & Accordion Toggle Button */}
                    <div className="flex flex-wrap justify-between items-center gap-2 pt-1">
                      <div className="text-sm text-gray-600 flex flex-wrap gap-2 font-medium">
                        <span className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                          شماره تیکت: #{reportId}
                        </span>
                        <span className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                          📅 {createdDate}
                        </span>
                        {report.reservation_id && (
                          <span className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                            🎟️ رزرو مربوطه: #{report.reservation_id}
                          </span>
                        )}
                      </div>

                      {/* Expand / Collapse Action Button */}
                      <button
                        onClick={() => toggleAccordion(reportId)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                      >
                        {isExpanded ? 'بستن جزئیات ▲' : 'مشاهده جزئیات ▼'}
                      </button>
                    </div>

                    {/* Expandable Accordion Body */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                        {/* User's Original Message */}
                        <div className="bg-white p-3.5 rounded-xl border border-gray-200 text-sm text-gray-700">
                          <strong className="block text-gray-900 font-bold mb-1">💬 متن درخواست شما:</strong>
                          <p className="whitespace-pre-line leading-relaxed">{reportText}</p>
                        </div>

                        {/* Admin Response section */}
                        {report.admin_response ? (
                          <div className="bg-blue-50 border-r-4 border-blue-500 p-3.5 rounded-l-xl text-sm text-blue-900">
                            <strong className="block font-bold mb-1">👨‍💻 پاسخ پشتیبان:</strong>
                            <p className="whitespace-pre-line leading-relaxed">{report.admin_response}</p>
                          </div>
                        ) : (
                          <div className="bg-yellow-50 border-r-4 border-yellow-400 p-3 rounded-l-xl text-xs text-yellow-800 font-medium">
                            ⏳ این تیکت هنوز در صف بررسی پشتیبانی است. پاسخ به‌زودی ثبت خواهد شد.
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