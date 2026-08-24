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
          .map(
            (c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
          )
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
  const [userRole, setUserRole] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSport, setSelectedSport] = useState('all');
  const [venue, setVenue] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setUserRole(getUserRole());
  }, []);

  useEffect(() => {
    const fetchTickets = async () => {
      setLoading(true);
      try {
        const endpoint = '/tickets/search';
        const params = new URLSearchParams();

        if (searchQuery.trim()) {
          params.append('q', searchQuery.trim());
        }
        if (selectedSport !== 'all') {
          params.append('sport_type', selectedSport);
        }
        if (venue.trim()) {
          params.append('venue', venue.trim());
        }
        if (minPrice) {
          params.append('min_price', minPrice);
        }
        if (maxPrice) {
          params.append('max_price', maxPrice);
        }

        const queryString = params.toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;

        const response = await api.get(url);
        const data = response.data?.tickets || response.data || [];
        setTickets(Array.isArray(data) ? data : []);
      } catch (error) {
        toast.error('Failed to load event tickets.');
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(() => {
      fetchTickets();
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedSport, venue, minPrice, maxPrice]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    toast.success('Signed out successfully.');
    navigate('/');
  };

  const navBtnClass = 
    "px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 " +
    "rounded-xl text-xs font-semibold text-gray-200 transition-all " +
    "flex items-center gap-2";

  const advInputClass = 
    "w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl " +
    "text-xs text-white placeholder-gray-500 focus:outline-none " +
    "focus:border-indigo-500";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 font-sans pb-16">
      <header 
        className="bg-white/5 border-b border-white/10 sticky top-0 z-30"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20">
          <div className="flex items-center justify-between h-full">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center">
                <span className="text-xl">🎟️</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">
                  Sports<span className="text-indigo-400">Ticket</span>
                </h1>
                <p className="text-[10px] text-gray-400 font-medium">
                  Event Booking Portal
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/profile')}
                className={navBtnClass}
              >
                <span>👤 My Profile</span>
              </button>

              <button
                onClick={() => navigate('/support')}
                className={navBtnClass}
              >
                <span>🎧 Support</span>
              </button>

              {userRole === 'admin' && (
                <button
                  onClick={() => navigate('/admin')}
                  className={
                    "px-4 py-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 " +
                    "border border-indigo-500/30 rounded-xl text-xs " +
                    "font-semibold text-indigo-300 transition-all"
                  }
                >
                  ⚡ Admin Panel
                </button>
              )}

              <button
                onClick={handleLogout}
                className={
                  "px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border " +
                  "border-rose-500/20 rounded-xl text-xs font-semibold " +
                  "text-rose-400 transition-all"
                }
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="mb-10 text-center max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            Find & Reserve 
            <span 
              className={
                "text-transparent bg-clip-text bg-gradient-to-r " +
                "from-indigo-400 to-blue-400"
              }
            >
              {" "}Live Sports Tickets
            </span>
          </h2>
          <p className="text-sm text-gray-400 mb-8 mt-3">
            Sub-second ElasticSearch query engine with real-time tracking.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 bg-white/5 border">
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search teams, venues, or cities..."
                  className={
                    "w-full pl-11 pr-4 py-3 bg-transparent text-sm " +
                    "text-white placeholder-gray-500 focus:outline-none"
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2">
                  🔍
                </span>
              </div>

              <div className="flex bg-black/40 p-1 rounded-xl border">
                {['all', 'football', 'basketball', 'volleyball'].map(
                  (sport) => (
                    <button
                      key={sport}
                      onClick={() => setSelectedSport(sport)}
                      className={
                        "px-4 py-2 rounded-lg text-xs font-bold " +
                        "capitalize transition-all " +
                        (selectedSport === sport
                          ? "bg-indigo-600 text-white shadow-md"
                          : "text-gray-400 hover:text-gray-200")
                      }
                    >
                      {sport}
                    </button>
                  )
                )}
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={
                  "px-4 py-2 bg-indigo-500/10 text-indigo-400 font-bold " +
                  "text-xs rounded-xl border border-indigo-500/20 " +
                  "hover:bg-indigo-500/20 transition-all flex items-center"
                }
              >
                ⚙️ Filters
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Specific Stadium / Venue"
                className={advInputClass}
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
              />
              <input
                type="number"
                placeholder="Min Price (Toman)"
                className={advInputClass}
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                step="10000"
                min="0"
              />
              <input
                type="number"
                placeholder="Max Price (Toman)"
                className={advInputClass}
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                step="10000"
                min="0"
              />
            </div>
          )}
        </div>

        {loading ? (
          <div 
            className="text-center py-20 text-gray-500 animate-pulse text-sm"
          >
            Searching ElasticSearch database...
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-20 bg-white/5 rounded-3xl border">
            <span className="text-5xl block mb-4">🎟️</span>
            <h3 className="text-lg font-bold text-white mb-1">
              No Tickets Found
            </h3>
            <p className="text-xs text-gray-400">
              Try adjusting your search query or sport filters.
            </p>
          </div>
        ) : (
          <div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {tickets.map((ticket, index) => {
              const ticketId = ticket.id || ticket.ticket_id;
              const homeTeam = ticket.home_team || 'Home Team';
              const awayTeam = ticket.away_team || 'Away Team';
              const venName = ticket.venue_name || ticket.venue || 'Venue';
              const sport = ticket.sport_type || 'Sports';
              const remaining = 
                ticket.remaining_capacity ?? ticket.capacity ?? 0;
              const isSurge = remaining < 1000 || ticket.is_surge_pricing;
              
              // 🚀 FIXED: Sync UI card price logic with backend Surge logic
              const basePrice = Number(ticket.price) || 0;
              const finalPrice = isSurge ? basePrice * 1.15 : basePrice;

              const matchDate = ticket.match_date 
                ? new Date(ticket.match_date).toLocaleDateString('en-US', { 
                    month: 'short', day: 'numeric', year: 'numeric' 
                  }) 
                : 'Upcoming';

              return (
                <div
                  key={ticketId || index}
                  className={
                    "bg-white/5 hover:bg-white/[0.08] border " +
                    "border-white/10 hover:border-indigo-500/50 " +
                    "rounded-3xl p-6 transition-all duration-300 shadow-xl " +
                    "group flex flex-col justify-between relative"
                  }
                >
                  <div className="flex justify-between items-center mb-5">
                    <span className="text-[10px] font-bold uppercase">
                      ⚽ {sport}
                    </span>
                    {isSurge && (
                      <span className="text-[10px] font-bold uppercase">
                        🔥 High Demand
                      </span>
                    )}
                  </div>

                  <div className="mb-6">
                    <h3 className="text-xl font-extrabold text-white">
                      {homeTeam}{" "}
                      <span className="text-xs text-gray-500 font-normal">
                        vs
                      </span>{" "}
                      {awayTeam}
                    </h3>
                    <p className="text-xs text-gray-400 mt-1 flex items-center">
                      <span>📍</span> {venName}
                    </p>
                  </div>

                  <div className="bg-black/30 rounded-2xl p-4 border">
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-500 text-xs">Date:</span>
                      <span className="font-semibold text-gray-200 text-xs">
                        {matchDate}
                      </span>
                    </div>
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-500 text-xs">Seats:</span>
                      <span 
                        className={
                          "font-semibold text-xs " +
                          (remaining < 100 ? "text-amber-400" : "text-white")
                        }
                      >
                        {remaining} remaining
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-gray-500 text-xs">Price:</span>
                      <span 
                        className="text-base font-extrabold text-emerald-400"
                      >
                        {/* 🚀 FIXED: Render calculated Surge price */}
                        {finalPrice > 0 
                          ? `${Number(finalPrice).toLocaleString()} T` 
                          : 'Free'}
                      </span>
                    </div>
                  </div>

                  {remaining > 0 ? (
                    <button
                      onClick={() => navigate(`/tickets/${ticketId}`)}
                      className={
                        "w-full bg-gradient-to-r from-indigo-600 " +
                        "to-blue-600 hover:from-indigo-500 text-white " +
                        "font-bold py-3.5 rounded-xl transition-all " +
                        "text-xs uppercase tracking-wider mt-6"
                      }
                    >
                      Reserve Ticket →
                    </button>
                  ) : (
                    <button
                      onClick={() => navigate(`/tickets/${ticketId}`)}
                      className={
                        "w-full bg-rose-500/10 hover:bg-rose-500/20 " +
                        "text-rose-400 border border-rose-500/20 font-bold " +
                        "py-3.5 rounded-xl transition-all text-xs uppercase " +
                        "tracking-wider mt-6 flex justify-center " +
                        "items-center gap-2"
                      }
                    >
                      🚫 Sold Out <span className="text-gray-500 font-normal">
                        |
                      </span> 🔔 Waitlist
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}