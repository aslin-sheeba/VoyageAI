import { useState, useEffect } from "react";
import { inviteMember, removeMember, listMembers } from "../api/memberService";
import { useAuth } from "../context/AuthContext";

export default function TripMembersPanel({ trip, onTripUpdate }) {
  const { user }  = useAuth();
  const [members, setMembers]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting]   = useState(false);
  const [showForm, setShowForm]   = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState("");

  const isOwner = trip?.userId === user?.uid;

  // Accepted participants count
  const acceptedCount = (trip?.participants || []).filter(p => p.status === "accepted").length;

  const fetchMembers = async () => {
    if (!trip?._id) return;
    setLoading(true);
    try {
      const res = await listMembers(trip._id);
      if (res.success) setMembers(res.participants || []);
    } catch {
      setMembers(trip?.participants || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [trip?._id]);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setError("");
    setSuccess("");
    try {
      const res = await inviteMember(trip._id, inviteEmail.trim());
      setSuccess(`Invitation created for ${inviteEmail}. They will see it in their notification center when they next log in.`);
      setInviteEmail("");
      setShowForm(false);
      if (res.trip && onTripUpdate) onTripUpdate(res.trip);
      await fetchMembers();
    } catch (err) {
      setError(err.message);
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (targetUserId, name) => {
    if (!confirm(`Remove "${name}" from this trip?`)) return;
    setError("");
    try {
      const res = await removeMember(trip._id, targetUserId);
      if (res.trip && onTripUpdate) onTripUpdate(res.trip);
      await fetchMembers();
    } catch (err) {
      setError(err.message);
    }
  };

  const statusBadge = (status) => {
    const map = {
      accepted: { label: "Accepted",  cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
      invited:  { label: "Pending",   cls: "bg-amber-500/15  text-amber-400  border-amber-500/20" },
      declined: { label: "Declined",  cls: "bg-red-500/15    text-red-400    border-red-500/20" },
    };
    const cfg = map[status] || map.invited;
    return (
      <span className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase tracking-wide ${cfg.cls}`}>
        {cfg.label}
      </span>
    );
  };

  if (!trip) return null;

  return (
    <div className="bg-slate-800/40 border border-white/5 rounded-2xl p-4 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          👥 Trip Members
          <span className="bg-sky-500/15 text-sky-400 border border-sky-500/20 text-[10px] px-2 py-0.5 rounded font-bold">
            {acceptedCount}
          </span>
        </h3>
        {isOwner && !showForm && (
          <button
            onClick={() => { setShowForm(true); setError(""); setSuccess(""); }}
            className="text-[10px] bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 px-2.5 py-1 rounded-lg font-bold transition"
          >
            + Add Member
          </button>
        )}
      </div>

      {/* Invite Form */}
      {showForm && isOwner && (
        <form onSubmit={handleInvite} className="mb-3 bg-slate-900/60 border border-white/10 rounded-xl p-3 space-y-2">
          <label className="block text-[11px] text-gray-400 font-semibold">Add Trip Member by Email</label>
          <input
            type="email"
            required
            placeholder="friend@example.com"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
          />
          <div className="text-[10px] text-gray-500">
            ℹ️ The user must already have a VoyageAI account. They will receive a notification to accept or decline.
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(""); }}
              className="flex-1 text-xs bg-white/5 hover:bg-white/10 py-1.5 rounded-lg transition text-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={inviting}
              className="flex-1 text-xs bg-sky-500 hover:bg-sky-600 py-1.5 rounded-lg transition text-white font-bold disabled:opacity-50"
            >
              {inviting ? "Sending..." : "Send Invitation"}
            </button>
          </div>
        </form>
      )}

      {/* Feedback */}
      {error   && <p className="text-xs text-red-400 mb-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
      {success && <p className="text-xs text-emerald-400 mb-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">{success}</p>}

      {/* Members List */}
      {loading ? (
        <div className="text-xs text-gray-500 py-2">Loading members...</div>
      ) : (
        <div className="space-y-2">
          {(members.length > 0 ? members : trip?.participants || []).map((m, i) => (
            <div
              key={m.userId || i}
              className="flex items-center justify-between bg-slate-900/50 border border-white/5 rounded-xl px-3 py-2.5 hover:border-white/10 transition"
            >
              <div className="flex items-center gap-2.5">
                {m.photoURL ? (
                  <img src={m.photoURL} alt={m.name} className="w-7 h-7 rounded-full border border-white/10 object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-sm">👤</div>
                )}
                <div>
                  <p className="text-xs font-bold text-gray-200">{m.name || m.email}</p>
                  <p className="text-[10px] text-gray-500">{m.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {m.role === "owner" ? (
                  <span className="text-[10px] px-2 py-0.5 rounded border bg-indigo-500/15 text-indigo-400 border-indigo-500/20 font-bold uppercase tracking-wide">
                    Owner
                  </span>
                ) : statusBadge(m.status)}

                {/* Owner can remove non-owner members */}
                {isOwner && m.role !== "owner" && (
                  <button
                    onClick={() => handleRemove(m.userId, m.name || m.email)}
                    className="text-[10px] text-red-400/60 hover:text-red-400 transition font-bold ml-1"
                    title="Remove member"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}

          {(members.length === 0 && (trip?.participants || []).length === 0) && (
            <p className="text-xs text-gray-500 py-2">No members yet. Add participants using the button above.</p>
          )}
        </div>
      )}
    </div>
  );
}
