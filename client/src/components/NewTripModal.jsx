import { useState } from "react";
import { createPortal } from "react-dom";
import { generateTrip } from "../api/tripsService";
import { useAuth } from "../context/AuthContext";

export default function NewTripModal({ isOpen, onClose, onTripCreated }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const [formData, setFormData] = useState({
    city:          "",
    budget:        "",
    startDate:     "",
    endDate:       "",
    interests:     "",
    preferences:   "Balanced",
    travelerCount: 1,
  });

  if (!isOpen) return null;

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const adjustCount = (delta) =>
    setFormData(prev => ({
      ...prev,
      travelerCount: Math.max(1, Math.min(20, prev.travelerCount + delta)),
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = {
        city:          formData.city,
        budget:        Number(formData.budget),
        startDate:     formData.startDate,
        endDate:       formData.endDate,
        interests:     formData.interests,
        preferences:   formData.preferences,
        travelerCount: Number(formData.travelerCount),
      };

      const response = await generateTrip(payload);
      if (!response.success) {
        setError(response.error || "Failed to generate trip");
        setLoading(false);
        return;
      }

      onTripCreated();
      onClose();
      setFormData({ city: "", budget: "", startDate: "", endDate: "", interests: "", preferences: "Balanced", travelerCount: 1 });
    } catch (err) {
      console.error(err);
      setError("Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ── shared input class ── */
  const inputCls = "w-full rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none transition-all duration-150";
  const inputStyle = {
    background: "rgba(15,23,42,0.80)",
    border: "1px solid rgba(255,255,255,0.09)",
    boxShadow: "inset 0 1px 3px rgba(0,0,0,0.4)",
  };
  const inputFocusStyle = (focused) => focused ? { ...inputStyle, border: "1px solid rgba(14,165,233,0.6)", boxShadow: "0 0 0 3px rgba(14,165,233,0.12), inset 0 1px 3px rgba(0,0,0,0.4)" } : inputStyle;

  return createPortal(
    /* Scrim */
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 600, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      {/* Modal card */}
      <div
        className="relative w-full max-w-lg rounded-3xl flex flex-col overflow-hidden"
        style={{
          background: "linear-gradient(145deg, rgba(2,6,23,0.97) 0%, rgba(15,23,42,0.97) 100%)",
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.08)",
          maxHeight: "calc(100vh - 48px)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Top accent glow */}
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: "linear-gradient(90deg,transparent,rgba(14,165,233,0.55),rgba(99,102,241,0.55),transparent)" }} />

        {/* ── Header ───────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-6 py-5 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "linear-gradient(135deg,rgba(14,165,233,0.08),rgba(99,102,241,0.06))" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#0ea5e9,#6366f1)", boxShadow: "0 8px 24px rgba(14,165,233,0.35)" }}>
              ✈️
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-tight">Plan a New Trip</h2>
              <p className="text-[11px] text-sky-400/70 mt-0.5">Powered by Gemini AI + Geoapify</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:text-white transition-all duration-150"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            ✕
          </button>
        </div>

        {/* ── Scrollable body ───────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 px-4 py-3 rounded-2xl text-sm text-red-300 flex items-center gap-2"
              style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)" }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" id="new-trip-form">

            {/* Destination */}
            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">📍 Destination</label>
              <input
                type="text" name="city" value={formData.city} onChange={handleChange}
                placeholder="e.g. Goa, Paris, Tokyo"
                className={inputCls}
                style={inputStyle}
                required
              />
            </div>

            {/* Budget */}
            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">💰 Total Budget (INR)</label>
              <input
                type="number" name="budget" value={formData.budget} onChange={handleChange}
                placeholder="e.g. 30000"
                className={inputCls}
                style={inputStyle}
                required
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Start Date</label>
                <input
                  type="date" name="startDate" value={formData.startDate} onChange={handleChange}
                  className={inputCls}
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">End Date</label>
                <input
                  type="date" name="endDate" value={formData.endDate} onChange={handleChange}
                  className={inputCls}
                  style={inputStyle}
                  required
                />
              </div>
            </div>

            {/* Interests */}
            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">🎯 Interests <span className="text-gray-600 normal-case font-normal">(optional)</span></label>
              <input
                type="text" name="interests" value={formData.interests} onChange={handleChange}
                placeholder="e.g. beaches, history, local food"
                className={inputCls}
                style={inputStyle}
              />
            </div>

            {/* Travel Style */}
            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">🧭 Travel Style</label>
              <select
                name="preferences" value={formData.preferences} onChange={handleChange}
                className={inputCls + " cursor-pointer"}
                style={inputStyle}
              >
                <option value="Balanced">⚖️ Balanced</option>
                <option value="Relaxed">🌴 Relaxed</option>
                <option value="Adventure">🏔️ Adventure</option>
                <option value="Cultural">🏛️ Cultural</option>
                <option value="Budget">💸 Budget-Friendly</option>
                <option value="Luxury">✨ Luxury</option>
              </select>
            </div>

            {/* Traveler Count */}
            <div className="rounded-2xl p-4" style={{ background: "rgba(14,165,233,0.05)", border: "1px solid rgba(14,165,233,0.12)" }}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[11px] font-black text-gray-300 uppercase tracking-widest">👥 Travelers</h3>
                  <p className="text-[10px] text-gray-500 mt-0.5">Budget &amp; activities scale with count</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => adjustCount(-1)}
                    disabled={formData.travelerCount <= 1}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-lg transition-all duration-150 disabled:opacity-30 hover:scale-110 active:scale-95"
                    style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
                  >−</button>
                  <span className="text-xl font-black text-white w-8 text-center tabular-nums">{formData.travelerCount}</span>
                  <button
                    type="button"
                    onClick={() => adjustCount(1)}
                    disabled={formData.travelerCount >= 20}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-lg transition-all duration-150 disabled:opacity-30 hover:scale-110 active:scale-95"
                    style={{ background: "linear-gradient(135deg,#0ea5e9,#6366f1)", boxShadow: "0 4px 12px rgba(14,165,233,0.3)" }}
                  >+</button>
                </div>
              </div>
              <p className="text-[10px] text-gray-600 mt-3">
                ℹ️ Invite members via the Members panel after the trip is created.
              </p>
            </div>

          </form>
        </div>

        {/* ── Footer Actions ────────────────────────────────── */}
        <div
          className="flex gap-3 px-6 py-4 flex-shrink-0"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)", background: "rgba(2,6,23,0.50)" }}
        >
          <button
            type="button" onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-gray-400 hover:text-white transition-all duration-150 disabled:opacity-50"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            Cancel
          </button>
          <button
            form="new-trip-form"
            type="submit"
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-black text-white transition-all duration-150 disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: loading ? "rgba(14,165,233,0.4)" : "linear-gradient(135deg,#0ea5e9,#6366f1)",
              boxShadow: loading ? "none" : "0 8px 24px rgba(14,165,233,0.30)",
            }}
          >
            {loading
              ? <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </span>
              : `✈️ Create Trip${formData.travelerCount > 1 ? ` for ${formData.travelerCount}` : ""}`
            }
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}