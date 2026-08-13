import { useState } from "react";
import { generateTrip } from "../api/tripsService";
import { useAuth } from "../context/AuthContext";

export default function NewTripModal({ isOpen, onClose, onTripCreated }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const [formData, setFormData] = useState({
    city:       "",
    budget:     "",
    startDate:  "",
    endDate:    "",
    interests:  "",
    preferences: "Balanced",
  });

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

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
      if (response.success) {
        onTripCreated();
        onClose();
        setFormData({ city: "", budget: "", startDate: "", endDate: "", interests: "", preferences: "Balanced" });
      } else {
        setError(response.error || "Failed to generate trip");
      }
    } catch (err) {
      console.error(err);
      setError("Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-white">✈️ Plan a New Trip</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition text-lg">✕</button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">Destination</label>
            <input
              type="text" name="city" value={formData.city} onChange={handleChange}
              placeholder="e.g. Goa, Paris, Tokyo"
              className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">Total Budget (INR)</label>
            <input
              type="number" name="budget" value={formData.budget} onChange={handleChange}
              placeholder="30000"
              className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
              required
            />
            <p className="text-[10px] text-gray-500 mt-1">
              💡 You start as the sole participant. Invite friends after creating the trip to split costs.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">Start Date</label>
              <input
                type="date" name="startDate" value={formData.startDate} onChange={handleChange}
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">End Date</label>
              <input
                type="date" name="endDate" value={formData.endDate} onChange={handleChange}
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">Interests (optional)</label>
            <input
              type="text" name="interests" value={formData.interests} onChange={handleChange}
              placeholder="e.g. beaches, history, local food"
              className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">Travel Style</label>
            <select
              name="preferences" value={formData.preferences} onChange={handleChange}
              className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500"
            >
              <option value="Balanced">⚖️ Balanced</option>
              <option value="Relaxed">🌴 Relaxed</option>
              <option value="Adventure">🏔️ Adventure</option>
              <option value="Cultural">🏛️ Cultural</option>
              <option value="Budget">💸 Budget-Friendly</option>
              <option value="Luxury">✨ Luxury</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
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
              {loading ? "🤖 Generating..." : "✈️ Create Trip"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}