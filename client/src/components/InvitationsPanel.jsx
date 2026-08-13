import { useState, useEffect } from "react";
import { listInvitations, acceptInvitation, declineInvitation } from "../api/memberService";

export default function InvitationsPanel({ onAccepted }) {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [busy, setBusy]               = useState(null);
  const [feedback, setFeedback]       = useState(null); // { type: "success"|"error", msg }

  const fetchInvitations = async () => {
    setLoading(true);
    try {
      const res = await listInvitations();
      setInvitations(res.invitations || []);
    } catch (err) {
      setFeedback({ type: "error", msg: "Failed to load invitations: " + err.message });
      setInvitations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInvitations(); }, []);

  const handleAccept = async (tripId, tripName) => {
    setBusy(tripId);
    setFeedback(null);
    try {
      await acceptInvitation(tripId);
      setInvitations(prev => prev.filter(inv => String(inv.tripId) !== String(tripId)));
      setFeedback({ type: "success", msg: `✅ You've joined "${tripName}"! The trip will now appear in your trip list.` });
      if (onAccepted) onAccepted();
    } catch (err) {
      setFeedback({ type: "error", msg: "Failed to accept: " + err.message });
    } finally {
      setBusy(null);
    }
  };

  const handleDecline = async (tripId) => {
    setBusy(tripId);
    setFeedback(null);
    try {
      await declineInvitation(tripId);
      setInvitations(prev => prev.filter(inv => String(inv.tripId) !== String(tripId)));
      setFeedback({ type: "info", msg: "Invitation declined." });
    } catch (err) {
      setFeedback({ type: "error", msg: "Failed to decline: " + err.message });
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center gap-3">
        <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Loading invitations...</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {/* Feedback banner */}
      {feedback && (
        <div className={`rounded-xl px-4 py-3 text-sm border flex items-start gap-2 ${
          feedback.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
          feedback.type === "error"   ? "bg-red-500/10 border-red-500/20 text-red-400" :
          "bg-slate-800 border-white/10 text-gray-400"
        }`}>
          <span className="flex-1">{feedback.msg}</span>
          <button onClick={() => setFeedback(null)} className="opacity-50 hover:opacity-100 transition flex-shrink-0">✕</button>
        </div>
      )}

      {/* Empty state */}
      {invitations.length === 0 && !feedback && (
        <div className="py-10 text-center">
          <div className="text-5xl mb-3">📭</div>
          <p className="text-gray-400 text-sm font-bold">No pending invitations</p>
          <p className="text-gray-600 text-xs mt-1">When someone invites you to a trip, it will appear here.</p>
        </div>
      )}

      {invitations.length === 0 && feedback?.type === "success" && (
        <div className="py-6 text-center">
          <div className="text-5xl mb-3">🎉</div>
          <p className="text-gray-400 text-sm font-bold">All caught up!</p>
        </div>
      )}

      {/* Invitation cards */}
      {invitations.map(inv => (
        <div
          key={inv.tripId}
          className="bg-slate-800/60 border border-amber-500/20 rounded-2xl p-4 hover:border-amber-500/40 transition"
        >
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xl flex-shrink-0">
              ✈️
            </div>
            <div className="min-w-0">
              <p className="font-bold text-white text-sm truncate">{inv.tripName}</p>
              <p className="text-xs text-gray-400">{inv.city} · {inv.days} {inv.days === 1 ? "day" : "days"}</p>
              <p className="text-[10px] text-amber-400 mt-0.5">
                📩 Invited {inv.invitation?.joinedAt
                  ? new Date(inv.invitation.joinedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                  : "recently"}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleAccept(inv.tripId, inv.tripName)}
              disabled={busy === inv.tripId}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold py-2.5 rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {busy === inv.tripId ? (
                <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Joining...</>
              ) : "✓ Accept & Join"}
            </button>
            <button
              onClick={() => handleDecline(inv.tripId)}
              disabled={busy === inv.tripId}
              className="flex-1 bg-white/5 hover:bg-red-500/10 text-gray-400 hover:text-red-400 border border-white/10 hover:border-red-500/20 text-xs font-bold py-2.5 rounded-xl transition disabled:opacity-50"
            >
              ✕ Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
