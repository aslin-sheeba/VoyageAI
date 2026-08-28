import { useState } from "react";
import { generateTrip } from "../api/tripsService";
import { inviteMember } from "../api/memberService";
import { useAuth } from "../context/AuthContext";

function MemberAvatar({ name, email }) {
  const initials = (name || email || "?").charAt(0).toUpperCase();
  const colors = ["bg-sky-500", "bg-indigo-500", "bg-violet-500", "bg-emerald-500", "bg-rose-500", "bg-amber-500"];
  const colorIdx = (initials.charCodeAt(0) || 0) % colors.length;
  return (
    <div className={`w-7 h-7 rounded-full ${colors[colorIdx]} flex items-center justify-center text-xs font-black text-white flex-shrink-0`}>
      {initials}
    </div>
  );
}

export default function NewTripModal({ isOpen, onClose, onTripCreated }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const [formData, setFormData] = useState({
    city:        "",
    budget:      "",
    startDate:   "",
    endDate:     "",
    interests:   "",
    preferences: "Balanced",
  });

  // ── Member invite state ──────────────────────────────
  const [memberEmail,    setMemberEmail]    = useState("");
  const [memberError,    setMemberError]    = useState("");
  const [pendingMembers, setPendingMembers] = useState([]);

  if (!isOpen) return null;

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  // ── Add member to local pending list ────────────────
  const handleAddMember = () => {
    setMemberError("");
    const email = memberEmail.trim().toLowerCase();

    if (!email) return;

    // Basic email validation
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email)) {
      setMemberError("Please enter a valid email address.");
      return;
    }

    // Prevent adding yourself
    if (user?.email && email === user.email.toLowerCase()) {
      setMemberError("You are already the trip owner.");
      return;
    }

    // Prevent duplicates
    if (pendingMembers.some(m => m.email === email)) {
      setMemberError("This email is already in the list.");
      return;
    }

    setPendingMembers(prev => [...prev, { email }]);
    setMemberEmail("");
  };

  const handleRemoveMember = (email) =>
    setPendingMembers(prev => prev.filter(m => m.email !== email));

  // ── Submit ───────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = {
        city:        formData.city,
        budget:      Number(formData.budget),
        startDate:   formData.startDate,
        endDate:     formData.endDate,
        interests:   formData.interests,
        preferences: formData.preferences,
      };

      const response = await generateTrip(payload);
      if (!response.success) {
        setError(response.error || "Failed to generate trip");
        setLoading(false);
        return;
      }

      // Invite pending members after trip creation
      const tripId = response.savedTripId;
      if (tripId && pendingMembers.length > 0) {
        const results = await Promise.allSettled(
          pendingMembers.map(m => inviteMember(tripId, m.email))
        );
        const failed = results
          .map((r, i) => r.status === "rejected" ? pendingMembers[i].email : null)
          .filter(Boolean);
        if (failed.length > 0) {
          // Non-blocking — trip was created, just show a warning
          console.warn("Some invitations could not be sent:", failed);
        }
      }

      onTripCreated();
      onClose();
      setFormData({ city: "", budget: "", startDate: "", endDate: "", interests: "", preferences: "Balanced" });
      setPendingMembers([]);
      setMemberEmail("");
    } catch (err) {
      console.error(err);
      setError("Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-white">✈️ Plan a New Trip</h2>
            <p className="text-xs text-gray-500 mt-0.5">Powered by Gemini + Geoapify</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white flex items-center justify-center transition text-sm">✕</button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Destination */}
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">📍 Destination</label>
            <input
              type="text" name="city" value={formData.city} onChange={handleChange}
              placeholder="e.g. Goa, Paris, Tokyo"
              className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500 transition"
              required
            />
          </div>

          {/* Budget */}
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">💰 Total Budget (INR)</label>
            <input
              type="number" name="budget" value={formData.budget} onChange={handleChange}
              placeholder="30000"
              className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500 transition"
              required
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">Start Date</label>
              <input
                type="date" name="startDate" value={formData.startDate} onChange={handleChange}
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500 transition"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">End Date</label>
              <input
                type="date" name="endDate" value={formData.endDate} onChange={handleChange}
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500 transition"
                required
              />
            </div>
          </div>

          {/* Interests */}
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">🎯 Interests (optional)</label>
            <input
              type="text" name="interests" value={formData.interests} onChange={handleChange}
              placeholder="e.g. beaches, history, local food"
              className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500 transition"
            />
          </div>

          {/* Travel Style */}
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">🧭 Travel Style</label>
            <select
              name="preferences" value={formData.preferences} onChange={handleChange}
              className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500 transition"
            >
              <option value="Balanced">⚖️ Balanced</option>
              <option value="Relaxed">🌴 Relaxed</option>
              <option value="Adventure">🏔️ Adventure</option>
              <option value="Cultural">🏛️ Cultural</option>
              <option value="Budget">💸 Budget-Friendly</option>
              <option value="Luxury">✨ Luxury</option>
            </select>
          </div>

          {/* ── Travel Members ───────────────────────────── */}
          <div className="bg-slate-800/60 border border-white/8 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest">👥 Travel Members</h3>
              <span className="text-[10px] text-gray-500">Optional — invite after too</span>
            </div>

            {/* Owner (always shown) */}
            <div className="flex items-center gap-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-3 py-2">
              {user?.photoURL
                ? <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full border border-white/10" />
                : <MemberAvatar name={user?.displayName} email={user?.email} />
              }
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-200 truncate">{user?.displayName || "You"}</p>
                <p className="text-[10px] text-gray-500 truncate">{user?.email}</p>
              </div>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-bold whitespace-nowrap">Owner</span>
            </div>

            {/* Pending members */}
            {pendingMembers.map(m => (
              <div key={m.email} className="flex items-center gap-2.5 bg-slate-900/60 border border-white/5 rounded-xl px-3 py-2">
                <MemberAvatar email={m.email} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-300 truncate">{m.email}</p>
                  <p className="text-[10px] text-amber-400">Pending invitation</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveMember(m.email)}
                  className="text-gray-500 hover:text-red-400 transition text-sm leading-none ml-1 flex-shrink-0"
                  title="Remove"
                >✕</button>
              </div>
            ))}

            {/* Add email input */}
            <div className="space-y-2">
              {memberError && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1">{memberError}</p>
              )}
              <div className="flex gap-2">
                <input
                  type="email"
                  value={memberEmail}
                  onChange={e => { setMemberEmail(e.target.value); setMemberError(""); }}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleAddMember())}
                  placeholder="friend@example.com"
                  className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 transition"
                />
                <button
                  type="button"
                  onClick={handleAddMember}
                  className="bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-400 text-xs font-bold px-3 py-2 rounded-xl transition whitespace-nowrap"
                >
                  + Add
                </button>
              </div>
              <p className="text-[10px] text-gray-600">
                ℹ️ Members must have a VoyageAI account. Invites sent after trip creation.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button" onClick={onClose}
              className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 py-2.5 rounded-xl text-sm font-bold transition"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 text-white font-bold py-2.5 rounded-xl text-sm transition disabled:opacity-50 shadow-lg shadow-sky-500/20"
            >
              {loading
                ? "🤖 Generating..."
                : pendingMembers.length > 0
                ? `✈️ Create Trip + Invite ${pendingMembers.length}`
                : "✈️ Create Trip"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}