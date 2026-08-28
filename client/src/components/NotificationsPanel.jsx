import { useState, useEffect } from "react";
import { getNotifications, markRead, markAllRead } from "../api/notificationService";
import { listInvitations, acceptInvitation, declineInvitation } from "../api/memberService";

const TYPE_META = {
  invitation:            { emoji: "✉️",  color: "text-indigo-400" },
  member_joined:         { emoji: "👋",  color: "text-emerald-400" },
  expense_added:         { emoji: "💳",  color: "text-amber-400"  },
  itinerary_updated:     { emoji: "📋",  color: "text-sky-400"    },
  place_added:           { emoji: "📍",  color: "text-rose-400"   },
  chat_message:          { emoji: "💬",  color: "text-teal-400"   },
  settlement_requested:  { emoji: "⚖️",  color: "text-violet-400" },
  settlement_completed:  { emoji: "✅",  color: "text-emerald-400" },
  general:               { emoji: "🔔",  color: "text-gray-400"   },
};

function timeAgo(ts) {
  const diff = (Date.now() - new Date(ts)) / 1000;
  if (diff < 60)   return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationsPanel({ onAccepted }) {
  const [notifications, setNotifications] = useState([]);
  const [invitations,   setInvitations]   = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [tab,           setTab]           = useState("all"); // "all" | "invites"

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [notifRes, invRes] = await Promise.all([
        getNotifications(),
        listInvitations(),
      ]);
      setNotifications(notifRes.notifications || []);
      setInvitations(invRes.invitations || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleMarkRead = async (id) => {
    try {
      await markRead(id);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
    } catch {}
  };

  const handleMarkAll = async () => {
    try {
      await markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {}
  };

  const handleAccept = async (tripId) => {
    try {
      await acceptInvitation(tripId);
      await fetchAll();
      onAccepted?.();
    } catch (e) { alert(e.message); }
  };

  const handleDecline = async (tripId) => {
    try {
      await declineInvitation(tripId);
      await fetchAll();
    } catch (e) { alert(e.message); }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="p-5 text-white max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            🔔 Notifications
            {unreadCount > 0 && (
              <span className="bg-sky-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{unreadCount}</span>
            )}
          </h2>
        </div>
        {unreadCount > 0 && (
          <button onClick={handleMarkAll} className="text-xs text-sky-400 hover:text-sky-300 transition font-bold">
            Mark all read
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/50 rounded-xl p-1 mb-4">
        {[["all", "All Notifications"], ["invites", `Invitations${invitations.length > 0 ? ` (${invitations.length})` : ""}`]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${tab === id ? "bg-sky-500 text-white" : "text-gray-400 hover:text-gray-200"}`}>
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center py-8 text-gray-500 animate-pulse text-sm">Loading...</div>
      )}

      {/* ── Invitations Tab ─────────────────────────────── */}
      {!loading && tab === "invites" && (
        <div className="space-y-3">
          {invitations.length === 0 && (
            <div className="text-center py-10 text-gray-600">
              <p className="text-3xl mb-2">✉️</p>
              <p className="font-bold text-gray-500">No pending invitations</p>
            </div>
          )}
          {invitations.map(inv => (
            <div key={inv.tripId} className="bg-slate-800/50 border border-indigo-500/20 rounded-2xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">✈️</span>
                <div>
                  <p className="font-bold text-white">{inv.tripName}</p>
                  <p className="text-xs text-gray-400">{inv.city} · {inv.days} days</p>
                  <p className="text-[10px] text-indigo-400 mt-1">Invitation from trip owner</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleDecline(inv.tripId)}
                  className="flex-1 bg-white/5 hover:bg-white/10 py-2 rounded-xl text-xs font-bold text-gray-300 transition">
                  Decline
                </button>
                <button onClick={() => handleAccept(inv.tripId)}
                  className="flex-1 bg-indigo-500 hover:bg-indigo-600 py-2 rounded-xl text-xs font-bold text-white transition">
                  Accept
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── All Notifications Tab ───────────────────────── */}
      {!loading && tab === "all" && (
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {notifications.length === 0 && (
            <div className="text-center py-10 text-gray-600">
              <p className="text-3xl mb-2">🔔</p>
              <p className="font-bold text-gray-500">No notifications yet</p>
            </div>
          )}
          {notifications.map(n => {
            const meta = TYPE_META[n.type] || TYPE_META.general;
            return (
              <div
                key={n._id}
                onClick={() => !n.read && handleMarkRead(n._id)}
                className={`flex items-start gap-3 p-3.5 rounded-xl border transition cursor-pointer ${
                  n.read
                    ? "bg-slate-900/30 border-white/5 opacity-70"
                    : "bg-slate-800/60 border-white/10 hover:border-white/20"
                }`}
              >
                <span className="text-xl flex-shrink-0">{meta.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-200">{n.title}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{n.message}</p>
                  <p className="text-[10px] text-gray-600 mt-1">{timeAgo(n.createdAt)}</p>
                </div>
                {!n.read && (
                  <div className="w-2 h-2 bg-sky-500 rounded-full mt-1 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
