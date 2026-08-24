import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';

const getUserRole = () => {
  const token = localStorage.getItem('token');
  if (!token) return 'audience';
  try {
    const payloadBase64 = token.split('.')[1];
    if (payloadBase64) {
      const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(
            (c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
          )
          .join('')
      );
      const decoded = JSON.parse(jsonPayload);
      if (decoded.role) return decoded.role;
    }
  } catch (e) {
    console.error('Error decoding token role:', e);
  }
  return localStorage.getItem('role') || 'audience';
};

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState(false);
  
  const [joiningWaitlist, setJoiningWaitlist] = useState(false);

  const userRole = getUserRole();
  const isAdminOrSupport = userRole === 'admin' || userRole === 'support';

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const response = await api.get(`/tickets/${id}`);
        const ticketData = response.data?.ticket || response.data;
        setTicket(ticketData);
      } catch (error) {
        toast.error('Failed to load ticket details.');
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [id, navigate]);

  const handleReserve = async () => {
    if (isAdminOrSupport) {
      toast.error('Admins and support cannot purchase tickets.');
      return;
    }

    setReserving(true);
    try {
      const res = await api.post('/reservations', {
        ticket_id: Number(id)
      });
      const reservationId = res.data?.reservation_id || res.data?.id;

      toast.success('Seat locked for 15 mins! Proceeding to checkout...');

      const homeTeam = ticket?.home_team || 'Home';
      const awayTeam = ticket?.away_team || 'Away';
      const title = `${homeTeam} vs ${awayTeam}`;
      
      // 🚀 RESTORED: Directly use the accurate backend price
      const finalPrice = ticket?.price || 0;

      navigate(`/payment/${reservationId}`, {
        state: { finalPrice, title, ticketId: id },
      });
    } catch (error) {
      const detail = error.response?.data?.detail;
      toast.error(
        typeof detail === 'string'
          ? detail
          : 'Failed to create reservation.'
      );
    } finally {
      setReserving(false);
    }
  };

  const handleJoinWaitlist = async () => {
    if (isAdminOrSupport) {
      toast.error('Admins and support cannot join waitlists.');
      return;
    }

    setJoiningWaitlist(true);
    try {
      await api.post('/reservations/waitlist', { ticket_id: Number(id) });
      toast.success('Joined waitlist! We will notify you if a seat opens.');
    } catch (error) {
      const detail = error.response?.data?.detail;
      toast.error(
        typeof detail === 'string'
          ? detail
          : 'Failed to join waitlist.'
      );
    } finally {
      setJoiningWaitlist(false);
    }
  };

  if (loading) {
    return (
      <div
        className={
          "min-h-screen bg-[#0a0a0a] text-gray-100 flex items-center " +
          "justify-center"
        }
      >
        <div
          className={
            "text-center py-20 text-gray-500 animate-pulse text-sm"
          }
        >
          Loading event & venue details...
        </div>
      </div>
    );
  }

  if (!ticket) return null;

  const homeTeam = ticket.home_team || 'Home Team';
  const awayTeam = ticket.away_team || 'Away Team';
  const venue = ticket.venue_name || ticket.venue || 'Stadium';
  const sport = ticket.sport_type || 'Sports';
  
  // 🚀 RESTORED: Directly use backend price
  const price = ticket.price;
  
  const capacity = ticket.remaining_capacity ?? ticket.capacity ?? 0;
  const organizer = ticket.organizer || 'Official League';
  const city = ticket.city || 'City Venue';
  const tier = ticket.ticket_tier || 'Standard';
  const matchDate = ticket.match_date
    ? new Date(ticket.match_date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'TBD';

  const navBtnClass =
    "text-xs font-semibold text-indigo-400 hover:text-indigo-300 " +
    "transition-colors flex items-center gap-1";

  const bgGlowClass =
    "absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] " +
    "bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none";

  const badgeClass =
    "text-xs font-bold uppercase tracking-wider px-3 py-1 " +
    "border rounded-full";

  const gridBoxClass =
    "bg-black/30 p-5 rounded-2xl border border-white/5 text-center";

  const reserveBtnClass =
    "w-full py-4 rounded-xl text-xs uppercase tracking-wider font-bold " +
    "transition-all shadow-xl flex items-center justify-center gap-2 " +
    (reserving
      ? "bg-white/5 text-gray-500 border border-white/10 cursor-not-allowed"
      : "bg-gradient-to-r from-indigo-600 to-blue-600 " +
        "hover:from-indigo-500 hover:to-blue-500 text-white " +
        "shadow-indigo-500/20");

  const waitlistBtnClass =
    "w-full py-4 rounded-xl text-xs uppercase tracking-wider font-bold " +
    "transition-all shadow-xl flex items-center justify-center gap-2 " +
    (joiningWaitlist
      ? "bg-white/5 text-gray-500 border border-white/10 cursor-not-allowed"
      : "bg-gradient-to-r from-amber-500 to-orange-500 " +
        "hover:from-amber-400 hover:to-orange-400 text-white " +
        "shadow-amber-500/20");

  return (
    <div
      className={
        "min-h-screen bg-[#0a0a0a] text-gray-100 font-sans pb-16 " +
        "relative overflow-hidden"
      }
    >
      <div className={bgGlowClass}></div>

      <header
        className={
          "bg-white/5 border-b border-white/10 sticky top-0 z-30 " +
          "backdrop-blur-md"
        }
      >
        <div
          className={
            "max-w-4xl mx-auto px-4 sm:px-6 h-20 flex items-center " +
            "justify-between"
          }
        >
          <div className="flex items-center gap-3">
            <div
              className={
                "w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 " +
                "to-blue-500 flex items-center justify-center text-xl " +
                "shadow-lg shadow-indigo-500/20"
              }
            >
              🎟️
            </div>
            <h1 className="text-lg font-bold text-white tracking-tight">
              Event Details
            </h1>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className={navBtnClass}
          >
            ← Back to Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 relative z-10">
        <div
          className={
            "bg-white/5 backdrop-blur-xl border border-white/10 " +
            "rounded-3xl p-8 shadow-2xl overflow-hidden"
          }
        >
          <div
            className={
              "flex flex-wrap items-center justify-between gap-3 mb-6 " +
              "pb-6 border-b border-white/10"
            }
          >
            <div className="flex items-center gap-2">
              <span
                className={
                  badgeClass + " bg-indigo-500/10 text-indigo-400 " +
                  "border-indigo-500/20"
                }
              >
                ⚽ {sport}
              </span>
              <span
                className={
                  badgeClass + " bg-blue-500/10 text-blue-400 " +
                  "border-blue-500/20"
                }
              >
                {tier} Tier
              </span>
            </div>
            <span className="text-xs font-medium text-gray-400">
              Organizer: <strong className="text-gray-200">
                {organizer}
              </strong>
            </span>
          </div>

          <div className="text-center my-8">
            <h2
              className={
                "text-3xl sm:text-5xl font-black text-white " +
                "tracking-tight leading-tight"
              }
            >
              {homeTeam}{" "}
              <span
                className={
                  "text-indigo-500 text-2xl sm:text-3xl font-light px-2"
                }
              >
                vs
              </span>{" "}
              {awayTeam}
            </h2>
            <p
              className={
                "text-sm text-gray-400 mt-3 flex items-center " +
                "justify-center gap-1.5"
              }
            >
              <span>📍</span> {venue} ({city})
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-8">
            <div className={gridBoxClass}>
              <span
                className={
                  "text-[10px] font-bold text-gray-400 uppercase " +
                  "tracking-wider block mb-1"
                }
              >
                Match Schedule
              </span>
              <span
                className={
                  "text-xs font-bold text-white leading-relaxed block"
                }
              >
                {matchDate}
              </span>
            </div>
            <div className={gridBoxClass}>
              <span
                className={
                  "text-[10px] font-bold text-gray-400 uppercase " +
                  "tracking-wider block mb-1"
                }
              >
                Available Seats
              </span>
              <span
                className={
                  "text-lg font-black block " +
                  (capacity < 100 ? "text-amber-400" : "text-emerald-400")
                }
              >
                {capacity} Remaining
              </span>
            </div>
            <div className={gridBoxClass}>
              <span
                className={
                  "text-[10px] font-bold text-gray-400 uppercase " +
                  "tracking-wider block mb-1"
                }
              >
                Price per Ticket
              </span>
              <span
                className="text-lg font-black text-emerald-400 block"
              >
                {price
                  ? `${Number(price).toLocaleString()} Toman`
                  : 'Free Entry'}
              </span>
            </div>
          </div>

          <div
            className={
              "bg-indigo-500/10 border border-indigo-500/20 " +
              "rounded-2xl p-4 mb-8 text-xs text-indigo-300 " +
              "leading-relaxed flex items-center gap-3"
            }
          >
            <span className="text-2xl">🔒</span>
            <div>
              <strong className="block text-indigo-200 font-bold mb-0.5">
                15-Minute Seat Lock Guarantee
              </strong>
              Once reserved, Redis locks this seat exclusively for your
              account for 15 minutes to allow secure payment completion.
            </div>
          </div>

          {isAdminOrSupport ? (
            <button
              disabled
              className={
                "w-full py-4 rounded-xl text-xs uppercase " +
                "tracking-wider font-bold bg-white/5 text-gray-500 " +
                "cursor-not-allowed border border-white/10"
              }
            >
              🔒 Admins and support cannot purchase tickets
            </button>
          ) : capacity > 0 ? (
            <button
              onClick={handleReserve}
              disabled={reserving}
              className={reserveBtnClass}
            >
              {reserving
                ? 'Locking Seat in Redis...'
                : '💳 Lock Seat & Proceed to Payment'}
            </button>
          ) : (
            <div className="space-y-3">
              <div
                className={
                  "w-full py-3 rounded-xl text-xs uppercase " +
                  "tracking-wider font-bold bg-rose-500/10 " +
                  "text-rose-400 border border-rose-500/20 " +
                  "text-center"
                }
              >
                🚫 Event Sold Out
              </div>
              <button
                onClick={handleJoinWaitlist}
                disabled={joiningWaitlist}
                className={waitlistBtnClass}
              >
                {joiningWaitlist
                  ? 'Adding to Redis Queue...'
                  : '🔔 Join Waitlist (Get Notified)'}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}