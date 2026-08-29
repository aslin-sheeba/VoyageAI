import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import { createPortal } from "react-dom";

// Services
import { getTrips } from "./api/tripsService";
import { getNotifications } from "./api/notificationService";

// Components
import MapCanvas           from "./components/MapCanvas";
import CursorOverlay       from "./components/CursorOverlay";
import Timeline            from "./components/Timeline";
import AIChatModal         from "./components/AIChatModal";
import GroupChatModal      from "./components/GroupChatModal";
import NewTripModal        from "./components/NewTripModal";
import NotificationsPanel  from "./components/NotificationsPanel";
import ActivityFeedPanel   from "./components/ActivityFeedPanel";

// Tab Subcomponents
import MyTripsTab       from "./components/MyTripsTab";
import ExploreTab       from "./components/ExploreTab";
import BudgetTab        from "./components/BudgetTab";
import SafetyTab        from "./components/SafetyTab";
import ProfileTab       from "./components/ProfileTab";
import TripMembersPanel from "./components/TripMembersPanel";
import { joinTrip }     from "./api/memberService";

/* ─────────────────────────────────────────────────────────────
   NORMALIZE LOCATIONS
   ───────────────────────────────────────────────────────────── */
function normalizeLocations(trip) {
  if (!trip) return [];
  const seen = new Set();
  const result = [];
  const push = (item) => {
    const { lat, lng, name } = item;
    if (!lat || !lng || Math.abs(lat) < 0.001 || !name) return;
    const key = `${name}|${lat.toFixed(5)}|${lng.toFixed(5)}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push({ ...item, id: key });
  };
  (trip.itinerary || []).forEach(day => {
    (day.activities || []).forEach(act => push({
      name: act.name, lat: act.coords?.lat, lng: act.coords?.lng,
      cost: act.cost || 0, type: act.type === "food" ? "restaurant" : "attraction",
      address: act.address || "", websiteUrl: act.websiteUrl || "", placeId: act.placeId || "", day: day.day,
    }));
    if (day.hotel?.name) push({
      name: day.hotel.name, lat: day.hotel.coords?.lat, lng: day.hotel.coords?.lng,
      cost: day.hotel.cost || 0, type: "hotel",
      address: day.hotel.address || "", websiteUrl: day.hotel.websiteUrl || "", placeId: day.hotel.placeId || "", day: day.day,
    });
  });
  if (result.length === 0) {
    (trip.locations || []).forEach(loc => push({
      name: loc.name, lat: loc.lat, lng: loc.lng, cost: loc.cost || 0,
      type: loc.type || "other", address: loc.address || "", websiteUrl: loc.websiteUrl || "", day: loc.day,
    }));
  }
  return result;
}

function groupByDay(locs) {
  const g = {};
  locs.forEach(l => { const d = l.day || 0; (g[d] = g[d] || []).push(l); });
  return Object.entries(g).sort(([a], [b]) => +a - +b);
}

const TYPE_EMOJI = { hotel: "🏨", restaurant: "🍴", food: "🍴", attraction: "⭐", sight: "📸", activity: "🎯", other: "📍" };

/* ─────────────────────────────────────────────────────────────
   GLASS FLOATING MODAL PANEL
   ───────────────────────────────────────────────────────────── */
function FloatingPanel({ title, onClose, children, wide = false }) {
  return createPortal(
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className={`relative rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-white/10 ${wide ? "w-full max-w-3xl max-h-[88vh]" : "w-full max-w-lg max-h-[85vh]"}`}
        style={{ background: "rgba(2, 6, 23, 0.65)", backdropFilter: "blur(24px) saturate(180%)", WebkitBackdropFilter: "blur(24px) saturate(180%)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Subtle top glow line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sky-500/40 to-transparent" />
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
          <h2 className="text-sm font-black text-white tracking-wide">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full border border-white/10 bg-white/5 hover:bg-red-500/20 hover:border-red-500/30 text-gray-400 hover:text-red-400 flex items-center justify-center text-sm transition-all duration-150">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body
  );
}

/* ─────────────────────────────────────────────────────────────
   GLASS LOCATIONS DRAWER
   ───────────────────────────────────────────────────────────── */
function LocationsDrawer({ trip, locations, onClose, onSelect, selectedId }) {
  const groups = groupByDay(locations);
  return (
    <div className="fixed top-0 right-0 bottom-0 z-[300] w-full sm:w-64 flex flex-col shadow-2xl border-l border-white/8"
      style={{ background: "rgba(2, 6, 23, 0.75)", backdropFilter: "blur(24px) saturate(160%)", WebkitBackdropFilter: "blur(24px) saturate(160%)" }}>
      {/* Top glow */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sky-500/30 to-transparent" />
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 flex-shrink-0">
        <div>
          <p className="text-xs font-black text-white uppercase tracking-widest">Locations</p>
          <p className="text-[10px] text-sky-400/60">{locations.length} stops · {trip?.city}</p>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-full border border-white/10 bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 flex items-center justify-center transition text-xs">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {groups.length === 0 && <p className="text-[11px] text-gray-600 p-3">No locations found.</p>}
        {groups.map(([day, locs]) => (
          <div key={day}>
            <p className="text-[10px] font-black text-sky-500/70 uppercase tracking-widest px-2 mb-1">
              {+day === 0 ? "General" : `Day ${day}`}
            </p>
            {locs.map(loc => (
              <button key={loc.id} onClick={() => onSelect(loc)}
                className={`w-full text-left px-3 py-2 rounded-xl mb-0.5 transition-all flex items-center gap-2.5 ${
                  selectedId === loc.id
                    ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                    : "text-gray-400 hover:bg-white/8 hover:text-gray-200 border border-transparent"
                }`}>
                <span className="text-sm flex-shrink-0">{TYPE_EMOJI[loc.type] || "📍"}</span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold truncate leading-tight">{loc.name}</p>
                  {loc.cost > 0 && <p className="text-[9px] text-emerald-400">₹{loc.cost.toLocaleString("en-IN")}</p>}
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   GLASS TIMELINE DRAWER
   ───────────────────────────────────────────────────────────── */
function TimelineDrawer({ trip, setActiveTrip, spent, total, percent, onClose }) {
  return (
    <div className="fixed top-0 right-0 bottom-0 z-[300] w-full sm:w-[380px] flex flex-col shadow-2xl border-l border-white/8"
      style={{ background: "rgba(2, 6, 23, 0.75)", backdropFilter: "blur(24px) saturate(160%)", WebkitBackdropFilter: "blur(24px) saturate(160%)" }}>
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 flex-shrink-0">
        <p className="text-xs font-black text-white uppercase tracking-widest">Itinerary</p>
        <button onClick={onClose} className="w-7 h-7 rounded-full border border-white/10 bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 flex items-center justify-center transition text-xs">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <Timeline trip={trip} setActiveTrip={setActiveTrip} spent={spent} total={total} percent={percent} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   GLASS FLOATING ACTION BUTTONS (AI + Chat)
   ───────────────────────────────────────────────────────────── */
function FloatingActionButton({ onClick, label, emoji, badge, active, accentFrom, accentTo, glowColor }) {
  return (
    <button
      onClick={onClick}
      className="relative flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black text-white transition-all duration-200 hover:scale-105 active:scale-95"
      style={{
        background: active
          ? `linear-gradient(135deg, ${accentFrom}, ${accentTo})`
          : "rgba(2, 6, 23, 0.65)",
        backdropFilter: "blur(16px) saturate(180%)",
        WebkitBackdropFilter: "blur(16px) saturate(180%)",
        border: active
          ? `1px solid ${accentFrom}60`
          : "1px solid rgba(255,255,255,0.10)",
        boxShadow: active
          ? `0 8px 32px ${glowColor}55`
          : "0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      {/* Inner glow top highlight */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${accentFrom}50, transparent)` }} />
      </div>
      <span className="text-sm relative z-10">{emoji}</span>
      <span className="relative z-10">{label}</span>
      {badge > 0 && (
        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-[9px] font-black flex items-center justify-center shadow-lg">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   GLASS NAV BUTTON (Desktop sidebar)
   ───────────────────────────────────────────────────────────── */
function NavButton({ item, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      title={item.label}
      className="group relative w-12 h-12 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all duration-200 hover:scale-105 active:scale-95"
      style={{
        background: isActive
          ? "linear-gradient(135deg, #0ea5e9, #6366f1)"
          : "rgba(2, 6, 23, 0.60)",
        backdropFilter: "blur(16px) saturate(180%)",
        WebkitBackdropFilter: "blur(16px) saturate(180%)",
        border: isActive ? "1px solid rgba(14,165,233,0.5)" : "1px solid rgba(255,255,255,0.08)",
        boxShadow: isActive
          ? "0 8px 24px rgba(14,165,233,0.35), inset 0 1px 0 rgba(255,255,255,0.15)"
          : "0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      <span className="text-lg leading-none">{item.emoji}</span>
      <span className={`text-[8px] font-black uppercase tracking-wide leading-none ${isActive ? "text-white" : "text-gray-500 group-hover:text-gray-300"}`}>
        {item.label}
      </span>
      {item.badge > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[8px] font-black flex items-center justify-center text-white shadow-lg">
          {item.badge > 9 ? "9+" : item.badge}
        </span>
      )}
      {/* Tooltip */}
      <div className="absolute left-14 top-1/2 -translate-y-1/2 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-xl border border-white/10"
        style={{ background: "rgba(2,6,23,0.90)", backdropFilter: "blur(12px)" }}>
        {item.label}
      </div>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   MAIN APP
   ───────────────────────────────────────────────────────────── */
export default function App() {
  const { user, loading, logout } = useAuth();
  const [trips,       setTrips]       = useState([]);
  const [activeTrip,  setActiveTrip]  = useState(null);
  const [modalOpen,   setModalOpen]   = useState(false);
  const [activePanel, setActivePanel] = useState(null);
  const [zoomTo,      setZoomTo]      = useState(null);
  const [selectedId,  setSelectedId]  = useState(null);

  // Floating modal states
  const [aiOpen,   setAiOpen]   = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  // Notification badge
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  // ── Memoize expensive location normalization ───────────────
  // Only recalculates when the active trip object identity changes.
  const normalizedLocations = useMemo(() => normalizeLocations(activeTrip), [activeTrip]);

  const spent   = useMemo(() => normalizedLocations.reduce((s, l) => s + Number(l.cost || 0), 0), [normalizedLocations]);
  const total   = Number(activeTrip?.budget || 0);
  const percent = total > 0 ? Math.min(100, Math.round((spent / total) * 100)) : 0;
  const acceptedCount = (activeTrip?.participants || []).filter(p => p.status === "accepted").length || 1;

  const refreshTrips = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const list = [...(await getTrips())].reverse();
      setTrips(list);
      if (list.length > 0) {
        if (activeTrip) {
          const fresh = list.find(t => t._id === activeTrip._id);
          setActiveTrip(fresh || list[0]);
        } else {
          setActiveTrip(list[0]);
        }
      } else {
        setActiveTrip(null);
      }
    } catch (err) {
      console.error("Trip fetch failed:", err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const refreshNotifBadge = useCallback(async () => {
    try {
      const res = await getNotifications(1);
      setUnreadNotifs(res.unreadCount || 0);
    } catch {}
  }, []);

  useEffect(() => { refreshTrips(); }, [refreshTrips]);

  // Poll notification badge every 30 seconds
  useEffect(() => {
    if (!user?.uid) return;
    refreshNotifBadge();
    const interval = setInterval(refreshNotifBadge, 30000);
    return () => clearInterval(interval);
  }, [user?.uid, refreshNotifBadge]);

  // ── Invite link handler ─────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    const params = new URLSearchParams(window.location.search);
    const tripId = params.get("invite");
    if (!tripId) return;

    window.history.replaceState({}, "", window.location.pathname);

    joinTrip(tripId)
      .then((res) => {
        alert(`🎉 ${res.message || "You have joined the trip!"}`);
        refreshTrips();
      })
      .catch((err) => {
        if (!err.message?.toLowerCase().includes("already")) {
          alert(`Could not join trip: ${err.message}`);
        } else {
          refreshTrips();
        }
      });
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = async () => {
    if (!confirm("Sign out from VoyageAI?")) return;
    try { await logout(); window.location.reload(); } catch { alert("Sign out failed."); }
  };

  const closePanel = useCallback(() => setActivePanel(null), []);
  const openPanel  = useCallback((id) => setActivePanel(prev => prev === id ? null : id), []);

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-950 text-white gap-3">
        <div className="w-10 h-10 border-4 border-sky-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm font-semibold tracking-wide animate-pulse">Initializing VoyageAI...</p>
      </div>
    );
  }

  if (!user) return <Login />;

  const NAV = [
    { id: "itinerary",   emoji: "📋", label: "Itinerary" },
    { id: "locations",   emoji: "📍", label: "Locations" },
    { id: "trips",       emoji: "🎒", label: "My Trips"  },
    { id: "explore",     emoji: "🔍", label: "Explore"   },
    { id: "budget",      emoji: "💰", label: "Budget"    },
    { id: "members",     emoji: "👥", label: "Members"   },
    { id: "activity",    emoji: "🗓", label: "Activity"  },
    { id: "safety",      emoji: "🚨", label: "Safety"    },
    { id: "invitations", emoji: "🔔", label: "Notifs",   badge: unreadNotifs },
    { id: "profile",     emoji: "👤", label: "Profile"   },
  ];

  /* ── Glass card style shared ──────────────────────────── */
  const glassCard = {
    background: "rgba(2, 6, 23, 0.60)",
    backdropFilter: "blur(20px) saturate(180%)",
    WebkitBackdropFilter: "blur(20px) saturate(180%)",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-950">

      {/* ── FULL-PAGE MAP — NO key= so it never remounts ─── */}
      <div className="absolute inset-0 z-0">
        <MapCanvas
          activeTripId={activeTrip?._id}
          locations={normalizedLocations}
          zoomTo={zoomTo}
          selectedId={selectedId}
        />
      </div>

      {/* ── TOP BAR ─────────────────────────────────────────── */}
      <header className="absolute top-0 left-0 right-0 z-[100] flex flex-col md:flex-row md:items-center justify-between gap-2 p-3 pointer-events-none">

        <div className="flex items-center justify-between w-full md:w-auto gap-3 pointer-events-auto">
          {/* Brand */}
          <div className="rounded-2xl px-4 py-2" style={glassCard}>
            <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-1">
              <span>Voyage</span>
              <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">AI</span>
              <span className="text-[9px] bg-sky-500/15 text-sky-400 px-1.5 py-0.5 rounded border border-sky-500/20 font-bold uppercase tracking-wider ml-1">Beta</span>
            </h1>
          </div>

          {/* User (mobile) */}
          <div className="md:hidden rounded-2xl px-3 py-2 flex items-center gap-2" style={glassCard}>
            {user.photoURL
              ? <img src={user.photoURL} alt="avatar" className="w-6 h-6 rounded-full border border-white/10" />
              : <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs">👤</div>
            }
            <button onClick={handleLogout} className="text-gray-500 hover:text-red-400 transition text-sm ml-1" title="Logout">🚪</button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-center pointer-events-auto">
          {/* Trip Switcher */}
          <div className="rounded-2xl px-3 py-2 flex items-center gap-2" style={glassCard}>
            <span className="text-xs text-sky-400/60 font-bold uppercase tracking-wide hidden sm:block">Trip:</span>
            <select
              className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer max-w-[150px] sm:max-w-[200px] truncate"
              value={activeTrip?._id || ""}
              onChange={e => {
                const trip = trips.find(t => t._id === e.target.value);
                if (trip) { setActiveTrip(trip); setZoomTo(null); setSelectedId(null); }
              }}
            >
              {trips.length === 0 && <option>No trips yet</option>}
              {trips.map(t => <option key={t._id} value={t._id}>{t.tripName || t.city} ({t.days}d)</option>)}
            </select>
            <button
              onClick={() => setModalOpen(true)}
              className="ml-1 bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 text-white text-[10px] font-black px-2.5 py-1.5 rounded-xl transition-all shadow-lg shadow-sky-500/25 hover:scale-105"
            >
              + New
            </button>
          </div>

          {/* Trip stats pill */}
          {activeTrip && (
            <div className="rounded-2xl px-3 sm:px-4 py-2 flex items-center gap-2 sm:gap-4 text-[11px] sm:text-xs" style={glassCard}>
              <span className="text-gray-400">
                <span className="text-white font-bold max-w-[80px] sm:max-w-none truncate inline-block align-bottom">{activeTrip.city}</span>
                <span className="text-gray-500 ml-1">· {activeTrip.days}d</span>
              </span>
              <span className="text-gray-400 hidden xs:inline">
                👥 <span className="text-white font-bold">{acceptedCount}</span>
              </span>
              <span className={`font-bold ${spent > total ? "text-red-400" : "text-emerald-400"}`}>
                ₹{spent.toLocaleString("en-IN")}
                <span className="text-gray-500 font-normal"> / {total.toLocaleString("en-IN")}</span>
              </span>
              <div className="w-12 sm:w-20 h-1.5 bg-white/10 rounded-full overflow-hidden hidden xs:block">
                <div
                  className={`h-full rounded-full transition-all ${spent > total ? "bg-red-500" : "bg-emerald-400"}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* User (desktop) */}
        <div className="hidden md:flex rounded-2xl px-3 py-2 items-center gap-2 pointer-events-auto" style={glassCard}>
          {user.photoURL
            ? <img src={user.photoURL} alt="avatar" className="w-7 h-7 rounded-full border border-white/15 shadow-lg" />
            : <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs">👤</div>
          }
          <span className="text-xs font-bold text-gray-300 max-w-[90px] truncate">{user.displayName || "Traveler"}</span>
          <button onClick={handleLogout} className="text-gray-500 hover:text-red-400 transition text-sm ml-1" title="Logout">🚪</button>
        </div>
      </header>

      {/* ── LEFT NAV DOCK (Desktop) ──────────────────────── */}
      <nav className="absolute left-4 top-1/2 -translate-y-1/2 z-[100] hidden md:flex flex-col gap-2">
        {NAV.map(item => (
          <NavButton
            key={item.id}
            item={item}
            isActive={activePanel === item.id}
            onClick={() => openPanel(item.id)}
          />
        ))}
      </nav>

      {/* ── BOTTOM NAV DOCK (Mobile) ─────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-[100] flex md:hidden items-center justify-around px-2 py-2 rounded-t-2xl shadow-2xl pointer-events-auto overflow-x-auto gap-1 border-t border-white/8"
        style={{ background: "rgba(2,6,23,0.80)", backdropFilter: "blur(20px) saturate(160%)", WebkitBackdropFilter: "blur(20px) saturate(160%)" }}
      >
        {NAV.map(item => {
          const isActive = activePanel === item.id;
          return (
            <button key={item.id} onClick={() => openPanel(item.id)}
              className={`relative flex-shrink-0 flex flex-col items-center justify-center w-12 h-11 rounded-xl transition-all duration-150 ${
                isActive ? "text-sky-400" : "text-gray-500 active:bg-white/5"
              }`}
              style={isActive ? {
                background: "rgba(14,165,233,0.12)",
                border: "1px solid rgba(14,165,233,0.25)",
              } : { border: "1px solid transparent" }}
            >
              <span className="text-base leading-none">{item.emoji}</span>
              <span className={`text-[9px] mt-0.5 tracking-tight font-medium truncate max-w-[44px] ${isActive ? "font-black" : ""}`}>{item.label}</span>
              {item.badge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[8px] font-black flex items-center justify-center text-white">
                  {item.badge > 9 ? "9+" : item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ── FLOATING AI + CHAT BUTTONS ─────────────────── */}
      {activeTrip && !activePanel && (
        <div className="fixed bottom-[76px] md:bottom-6 right-4 z-[200] flex flex-col gap-2 items-end">
          <FloatingActionButton
            onClick={() => { setAiOpen(true); setChatOpen(false); }}
            label="AI Assistant"
            emoji="✨"
            active={aiOpen}
            accentFrom="#0ea5e9"
            accentTo="#6366f1"
            glowColor="#0ea5e9"
          />
          <FloatingActionButton
            onClick={() => { setChatOpen(true); setAiOpen(false); }}
            label="Trip Chat"
            emoji="💬"
            active={chatOpen}
            accentFrom="#10b981"
            accentTo="#14b8a6"
            glowColor="#10b981"
          />
        </div>
      )}

      {/* ── DRAWER BACKDROP ──────────────────────────────── */}
      {(activePanel === "itinerary" || activePanel === "locations") && (
        <div className="fixed inset-0 z-[290] bg-black/30 backdrop-blur-[2px]" onClick={closePanel} />
      )}

      {/* ── PANELS ───────────────────────────────────────── */}

      {activePanel === "itinerary" && (
        <TimelineDrawer trip={activeTrip} setActiveTrip={setActiveTrip} spent={spent} total={total} percent={percent} onClose={closePanel} />
      )}

      {activePanel === "locations" && (
        <LocationsDrawer trip={activeTrip} locations={normalizedLocations} onClose={closePanel} selectedId={selectedId}
          onSelect={loc => { setZoomTo([loc.lat, loc.lng]); setSelectedId(loc.id); }} />
      )}

      {activePanel === "trips" && (
        <FloatingPanel title="🎒 My Trips" onClose={closePanel} wide>
          <MyTripsTab trips={trips} activeTrip={activeTrip} setActiveTrip={trip => { setActiveTrip(trip); closePanel(); }} refreshTrips={refreshTrips} />
        </FloatingPanel>
      )}

      {activePanel === "explore" && (
        <FloatingPanel title="🔍 Place Discovery" onClose={closePanel} wide>
          <ExploreTab activeTrip={activeTrip} refreshTrips={refreshTrips}
            onPlaceSelect={coords => { setZoomTo(coords); setSelectedId(null); closePanel(); }} />
        </FloatingPanel>
      )}

      {activePanel === "budget" && (
        <FloatingPanel title="💰 Budget & Expenses" onClose={closePanel} wide>
          <BudgetTab activeTrip={activeTrip} refreshTrips={refreshTrips} />
        </FloatingPanel>
      )}

      {activePanel === "members" && (
        <FloatingPanel title="👥 Trip Members" onClose={closePanel}>
          <TripMembersPanel trip={activeTrip} onTripUpdate={updated => { setActiveTrip(updated); refreshTrips(); }} />
        </FloatingPanel>
      )}

      {activePanel === "activity" && (
        <FloatingPanel title="🗓 Trip Activity" onClose={closePanel}>
          <ActivityFeedPanel trip={activeTrip} />
        </FloatingPanel>
      )}

      {activePanel === "safety" && (
        <FloatingPanel title="🚨 Safety & SOS" onClose={closePanel}>
          <SafetyTab activeTrip={activeTrip} />
        </FloatingPanel>
      )}

      {activePanel === "invitations" && (
        <FloatingPanel title="🔔 Notifications" onClose={closePanel}>
          <NotificationsPanel onAccepted={() => { refreshTrips(); refreshNotifBadge(); closePanel(); }} />
        </FloatingPanel>
      )}

      {activePanel === "profile" && (
        <FloatingPanel title="👤 My Profile" onClose={closePanel}>
          <ProfileTab tripsCount={trips.length} />
        </FloatingPanel>
      )}

      {/* ── BOTTOM STATUS BAR ────────────────────────────── */}
      {!activePanel && normalizedLocations.length > 0 && (
        <div className="absolute bottom-[80px] md:bottom-6 left-1/2 -translate-x-1/2 z-[90] pointer-events-none w-[90%] max-w-md md:w-auto">
          <div className="rounded-2xl px-4 py-2 md:px-5 md:py-2.5 flex items-center justify-between md:justify-start gap-2 md:gap-4 text-[10px] sm:text-xs text-gray-400" style={glassCard}>
            <span>📍 <span className="text-white font-bold">{normalizedLocations.length}</span> mapped</span>
            <span className="w-px h-3 bg-white/15" />
            <span>👥 <span className="text-white font-bold">{acceptedCount}</span> {acceptedCount === 1 ? "user" : "users"}</span>
            <span className="w-px h-3 bg-white/15" />
            <span className={spent > total ? "text-red-400" : "text-emerald-400"}>
              {spent > total ? "⚠️ Over Budget" : "✓ Within Budget"}
            </span>
          </div>
        </div>
      )}

      <CursorOverlay />

      {/* ── MODALS ───────────────────────────────────────── */}
      <NewTripModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onTripCreated={refreshTrips} />

      <AIChatModal
        trip={activeTrip}
        setActiveTrip={setActiveTrip}
        isOpen={aiOpen}
        onClose={() => setAiOpen(false)}
      />

      <GroupChatModal
        trip={activeTrip}
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        onAskAI={(msg) => { setChatOpen(false); setAiOpen(true); }}
      />
    </div>
  );
}