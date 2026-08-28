import { useEffect, useState, useRef } from "react";
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
   FLOATING MODAL PANEL
   ───────────────────────────────────────────────────────────── */
function FloatingPanel({ title, onClose, children, wide = false }) {
  return createPortal(
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className={`relative bg-slate-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden ${wide ? "w-full max-w-3xl max-h-[88vh]" : "w-full max-w-lg max-h-[85vh]"}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
          <h2 className="text-base font-bold text-white">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white flex items-center justify-center text-sm transition">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body
  );
}

/* ─────────────────────────────────────────────────────────────
   LOCATIONS DRAWER
   ───────────────────────────────────────────────────────────── */
function LocationsDrawer({ trip, locations, onClose, onSelect, selectedId }) {
  const groups = groupByDay(locations);
  return (
    <div className="fixed top-0 right-0 bottom-0 z-[300] w-full sm:w-64 bg-slate-900 border-l border-white/8 flex flex-col shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0 bg-slate-900">
        <div>
          <p className="text-xs font-black text-white uppercase tracking-widest">Locations</p>
          <p className="text-[10px] text-gray-500">{locations.length} stops · {trip?.city}</p>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white flex items-center justify-center transition">✕</button>
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
                className={`w-full text-left px-3 py-2 rounded-xl mb-0.5 transition flex items-center gap-2.5 ${
                  selectedId === loc.id ? "bg-sky-500/20 text-sky-300 border border-sky-500/30" : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
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
   TIMELINE DRAWER — now WITHOUT inline AIChatWidget
   ───────────────────────────────────────────────────────────── */
function TimelineDrawer({ trip, setActiveTrip, spent, total, percent, onClose }) {
  return (
    <div className="fixed top-0 right-0 bottom-0 z-[300] w-full sm:w-[380px] bg-slate-900 border-l border-white/8 flex flex-col shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0 bg-slate-900">
        <p className="text-xs font-black text-white uppercase tracking-widest">Itinerary</p>
        <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white flex items-center justify-center transition">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <Timeline trip={trip} setActiveTrip={setActiveTrip} spent={spent} total={total} percent={percent} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   FLOATING ACTION BUTTONS (AI + Chat)
   ───────────────────────────────────────────────────────────── */
function FloatingActionButton({ onClick, label, emoji, badge, gradient, glowColor, active }) {
  return (
    <button
      onClick={onClick}
      className={`
        relative flex items-center gap-2 px-4 py-2.5 rounded-2xl
        text-xs font-black text-white shadow-xl
        transition-all duration-200
        ${active
          ? `${gradient} scale-105`
          : `${gradient} opacity-90 hover:opacity-100 hover:scale-105`
        }
        ${glowColor}
      `}
    >
      <span className="text-sm">{emoji}</span>
      <span>{label}</span>
      {badge > 0 && (
        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-[9px] font-black flex items-center justify-center shadow-lg">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
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

  const refreshTrips = async () => {
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
  };

  const refreshNotifBadge = async () => {
    try {
      const res = await getNotifications(1); // just get the count
      setUnreadNotifs(res.unreadCount || 0);
    } catch {}
  };

  useEffect(() => { refreshTrips(); }, [user]);

  // Poll notification badge every 30 seconds
  useEffect(() => {
    if (!user?.uid) return;
    refreshNotifBadge();
    const interval = setInterval(refreshNotifBadge, 30000);
    return () => clearInterval(interval);
  }, [user?.uid]);

  const handleLogout = async () => {
    if (!confirm("Sign out from VoyageAI?")) return;
    try { await logout(); window.location.reload(); } catch { alert("Sign out failed."); }
  };

  const closePanel = () => setActivePanel(null);
  const openPanel  = (id) => setActivePanel(prev => prev === id ? null : id);

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-950 text-white gap-3">
        <div className="w-10 h-10 border-4 border-sky-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm font-semibold tracking-wide animate-pulse">Initializing VoyageAI...</p>
      </div>
    );
  }

  if (!user) return <Login />;

  const normalizedLocations = normalizeLocations(activeTrip);
  const spent   = normalizedLocations.reduce((s, l) => s + Number(l.cost || 0), 0);
  const total   = Number(activeTrip?.budget || 0);
  const percent = total > 0 ? Math.min(100, Math.round((spent / total) * 100)) : 0;
  const acceptedCount = (activeTrip?.participants || []).filter(p => p.status === "accepted").length || 1;

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

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-950">

      {/* ── FULL-PAGE MAP ──────────────────────────────────── */}
      <div className="absolute inset-0 z-0">
        <MapCanvas key={activeTrip?._id} locations={normalizedLocations} zoomTo={zoomTo} selectedId={selectedId} />
      </div>

      {/* ── TOP BAR ─────────────────────────────────────────── */}
      <header className="absolute top-0 left-0 right-0 z-[100] flex flex-col md:flex-row md:items-center justify-between gap-2 p-3 bg-gradient-to-b from-slate-950/95 via-slate-950/60 to-transparent pointer-events-none">

        <div className="flex items-center justify-between w-full md:w-auto gap-3 pointer-events-auto">
          {/* Brand */}
          <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-2 shadow-xl">
            <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-1">
              <span>Voyage</span>
              <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">AI</span>
              <span className="text-[9px] bg-sky-500/15 text-sky-400 px-1.5 py-0.5 rounded border border-sky-500/20 font-bold uppercase tracking-wider ml-1">Beta</span>
            </h1>
          </div>

          {/* User (mobile) */}
          <div className="md:hidden bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl px-3 py-2 shadow-xl flex items-center gap-2">
            {user.photoURL
              ? <img src={user.photoURL} alt="avatar" className="w-6 h-6 rounded-full border border-white/10" />
              : <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs">👤</div>
            }
            <button onClick={handleLogout} className="text-gray-500 hover:text-red-400 transition text-sm ml-1" title="Logout">🚪</button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-center pointer-events-auto">
          {/* Trip Switcher */}
          <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl px-3 py-2 shadow-xl flex items-center gap-2">
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wide hidden sm:block">Trip:</span>
            <select
              className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer max-w-[150px] sm:max-w-[180px] truncate"
              value={activeTrip?._id || ""}
              onChange={e => {
                const trip = trips.find(t => t._id === e.target.value);
                if (trip) { setActiveTrip(trip); setZoomTo(null); setSelectedId(null); }
              }}
            >
              {trips.length === 0 && <option>No trips yet</option>}
              {trips.map(t => <option key={t._id} value={t._id}>{t.tripName || t.city} ({t.days}d)</option>)}
            </select>
            <button onClick={() => setModalOpen(true)}
              className="ml-1 bg-sky-500 hover:bg-sky-600 text-white text-[10px] font-black px-2.5 py-1.5 rounded-xl transition shadow-lg shadow-sky-500/20">
              + New
            </button>
          </div>

          {/* Trip stats pill */}
          {activeTrip && (
            <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl px-3 sm:px-4 py-2 shadow-xl flex items-center gap-2 sm:gap-4 text-[11px] sm:text-xs">
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
              <div className="w-12 sm:w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden hidden xs:block">
                <div className={`h-full rounded-full transition-all ${spent > total ? "bg-red-500" : "bg-emerald-400"}`} style={{ width: `${percent}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* User (desktop) */}
        <div className="hidden md:flex bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl px-3 py-2 shadow-xl items-center gap-2 pointer-events-auto">
          {user.photoURL
            ? <img src={user.photoURL} alt="avatar" className="w-6 h-6 rounded-full border border-white/10" />
            : <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs">👤</div>
          }
          <span className="text-xs font-bold text-gray-300 max-w-[90px] truncate">{user.displayName || "Traveler"}</span>
          <button onClick={handleLogout} className="text-gray-500 hover:text-red-400 transition text-sm ml-1" title="Logout">🚪</button>
        </div>
      </header>

      {/* ── LEFT NAV DOCK (Desktop) ──────────────────────── */}
      <nav className="absolute left-4 top-1/2 -translate-y-1/2 z-[100] hidden md:flex flex-col gap-2">
        {NAV.map(item => {
          const isActive = activePanel === item.id;
          return (
            <button key={item.id} onClick={() => openPanel(item.id)} title={item.label}
              className={`group relative w-12 h-12 rounded-2xl backdrop-blur-xl border shadow-xl transition-all duration-200 flex flex-col items-center justify-center gap-0.5 ${
                isActive ? "bg-sky-500 border-sky-400 shadow-sky-500/30 scale-110" : "bg-slate-900/90 border-white/10 hover:bg-slate-800/90 hover:border-white/20 hover:scale-105"
              }`}>
              <span className="text-lg leading-none">{item.emoji}</span>
              <span className={`text-[8px] font-black uppercase tracking-wide leading-none ${isActive ? "text-white" : "text-gray-500 group-hover:text-gray-300"}`}>
                {item.label}
              </span>
              {/* Badge */}
              {item.badge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[8px] font-black flex items-center justify-center text-white">
                  {item.badge > 9 ? "9+" : item.badge}
                </span>
              )}
              {/* Tooltip */}
              <div className="absolute left-14 top-1/2 -translate-y-1/2 bg-slate-800 border border-white/10 text-white text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-xl">
                {item.label}
              </div>
            </button>
          );
        })}
      </nav>

      {/* ── BOTTOM NAV DOCK (Mobile) ─────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-[100] flex md:hidden items-center justify-around bg-slate-900/95 backdrop-blur-xl border-t border-white/10 px-2 py-2 rounded-t-2xl shadow-2xl pointer-events-auto overflow-x-auto gap-1">
        {NAV.map(item => {
          const isActive = activePanel === item.id;
          return (
            <button key={item.id} onClick={() => openPanel(item.id)}
              className={`relative flex-shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-xl transition ${
                isActive ? "bg-sky-500/20 text-sky-400 font-bold" : "text-gray-400 active:bg-white/5"
              }`}>
              <span className="text-base leading-none">{item.emoji}</span>
              <span className="text-[9px] mt-0.5 tracking-tight font-medium truncate max-w-[44px]">{item.label}</span>
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
        <div className="fixed bottom-20 md:bottom-6 right-4 z-[200] flex flex-col gap-2 items-end">
          <FloatingActionButton
            onClick={() => { setAiOpen(true); setChatOpen(false); }}
            label="AI Assistant"
            emoji="✨"
            gradient="bg-gradient-to-r from-sky-500 to-indigo-500 shadow-sky-500/30"
            glowColor="shadow-lg"
            active={aiOpen}
          />
          <FloatingActionButton
            onClick={() => { setChatOpen(true); setAiOpen(false); }}
            label="Trip Chat"
            emoji="💬"
            gradient="bg-gradient-to-r from-emerald-500 to-teal-500 shadow-emerald-500/30"
            glowColor="shadow-lg"
            active={chatOpen}
          />
        </div>
      )}

      {/* ── DRAWER BACKDROP ──────────────────────────────── */}
      {(activePanel === "itinerary" || activePanel === "locations") && (
        <div className="fixed inset-0 z-[290] bg-black/40" onClick={closePanel} />
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
        <div className="absolute bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[90] pointer-events-none w-[90%] max-w-md md:w-auto">
          <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-2 md:px-5 md:py-2.5 shadow-2xl flex items-center justify-between md:justify-start gap-2 md:gap-4 text-[10px] sm:text-xs text-gray-400">
            <span>📍 <span className="text-white font-bold">{normalizedLocations.length}</span> mapped</span>
            <span className="w-px h-3 bg-white/10" />
            <span>👥 <span className="text-white font-bold">{acceptedCount}</span> {acceptedCount === 1 ? "user" : "users"}</span>
            <span className="w-px h-3 bg-white/10" />
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