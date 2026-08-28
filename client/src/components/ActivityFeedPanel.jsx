import { useState, useEffect } from "react";
import { getActivityLog } from "../api/activityService";

const FILTERS = [
  { id: "all",       label: "All"       },
  { id: "member",    label: "👥 Members" },
  { id: "expense",   label: "💳 Expenses" },
  { id: "itinerary", label: "📋 Itinerary" },
  { id: "ai",        label: "✨ AI" },
  { id: "general",   label: "📌 General" },
];

const CAT_EMOJI = {
  member:    "👥",
  expense:   "💳",
  itinerary: "📋",
  ai:        "✨",
  general:   "📌",
};

function timeAgo(ts) {
  const diff = (Date.now() - new Date(ts)) / 1000;
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function ActivityFeedPanel({ trip }) {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter,  setFilter]  = useState("all");

  const fetchLogs = async (cat = "all") => {
    if (!trip?._id) return;
    setLoading(true);
    try {
      const res = await getActivityLog(trip._id, cat);
      setLogs(res.logs || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchLogs(filter); }, [trip?._id, filter]);

  return (
    <div className="p-5 text-white">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-white">🗓 Trip Activity</h2>
        <p className="text-xs text-gray-500 mt-0.5">Everything that's happened on this trip</p>
      </div>

      {/* Filter chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4">
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-3 py-1 text-xs font-bold rounded-lg whitespace-nowrap transition flex-shrink-0 ${
              filter === f.id ? "bg-sky-500 text-white" : "bg-slate-800 text-gray-400 hover:text-gray-200"
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center py-10 text-gray-500 animate-pulse text-sm">Loading activity...</div>
      )}

      {!loading && logs.length === 0 && (
        <div className="text-center py-10 text-gray-600">
          <p className="text-3xl mb-2">📋</p>
          <p className="font-bold text-gray-500">No activity yet</p>
          <p className="text-xs mt-1">Actions on this trip will appear here</p>
        </div>
      )}

      {!loading && (
        <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
          {logs.map((log, i) => {
            const emoji = CAT_EMOJI[log.category] || "📌";
            return (
              <div key={log._id || i} className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/3 transition">
                {/* Avatar */}
                {log.userPhoto ? (
                  <img src={log.userPhoto} alt={log.userName} className="w-7 h-7 rounded-full border border-white/10 object-cover flex-shrink-0 mt-0.5" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                    {log.userId ? (log.userName || "?").charAt(0).toUpperCase() : emoji}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-300 leading-relaxed">
                    <span className="font-bold text-gray-200">{log.userName || "Someone"}</span>
                    {" "}
                    <span className="text-gray-400">{log.action}</span>
                  </p>
                  <p className="text-[10px] text-gray-600 mt-0.5">{timeAgo(log.createdAt)}</p>
                </div>

                <span className="text-sm flex-shrink-0">{emoji}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
