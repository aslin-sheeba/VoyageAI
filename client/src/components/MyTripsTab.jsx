import { useState } from "react";
import { deleteTrip, updateTrip } from "../api/tripsService";

export default function MyTripsTab({ trips, activeTrip, setActiveTrip, refreshTrips }) {
  const [editingTrip, setEditingTrip] = useState(null);
  const [formData, setFormData] = useState({
    tripName: "",
    budget: "",
  });
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (tripId, name) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    setDeletingId(tripId);
    try {
      await deleteTrip(tripId);
      await refreshTrips();
    } catch (err) {
      alert("Failed to delete trip. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const startEdit = (trip) => {
    setEditingTrip(trip);
    setFormData({
      tripName: trip.tripName || `${trip.city} Trip`,
      budget: trip.budget || "",
    });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingTrip) return;
    setUpdating(true);

    try {
      await updateTrip(editingTrip._id, {
        tripName: formData.tripName,
        budget: Number(formData.budget),
      });
      setEditingTrip(null);
      await refreshTrips();
    } catch (err) {
      alert("Failed to update trip.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="p-6 text-white max-w-4xl mx-auto pb-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-extrabold bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">My Trips</h2>
          <p className="text-gray-400 text-sm mt-1">Manage, edit, or remove your travel plans</p>
        </div>
      </div>

      {trips.length === 0 ? (
        <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-12 text-center">
          <p className="text-xl text-gray-300 font-semibold mb-2">No trips planned yet</p>
          <p className="text-gray-400 text-sm">Click the "+ New Trip" button in the top menu to start planning!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {trips.map((trip) => {
            const isActive = activeTrip?._id === trip._id;
            return (
              <div 
                key={trip._id}
                className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
                  isActive 
                    ? "bg-gradient-to-br from-slate-900/90 to-sky-950/40 border-sky-500/80 shadow-[0_0_15px_rgba(56,189,248,0.15)]" 
                    : "bg-slate-900/50 border-white/5 hover:border-white/20"
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-bold tracking-tight truncate max-w-[200px]">
                      {trip.tripName || `${trip.city} Trip`}
                    </h3>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                      isActive ? "bg-sky-500/20 text-sky-400 border border-sky-500/30" : "bg-white/5 text-gray-400"
                    }`}>
                      {isActive ? "Active" : "Saved"}
                    </span>
                  </div>

                  <p className="text-gray-400 text-sm flex items-center gap-1.5 mb-4">
                    📍 <span className="font-medium text-gray-300">{trip.city}</span>
                  </p>

                  <div className="grid grid-cols-3 gap-2 text-xs text-gray-400 mb-4 bg-black/20 p-3 rounded-xl border border-white/5">
                    <div>
                      <span className="block text-gray-500 font-bold uppercase tracking-widest text-[9px] mb-0.5">Duration</span>
                      <span className="font-bold text-gray-200">{trip.days} Days</span>
                    </div>
                    <div>
                      <span className="block text-gray-500 font-bold uppercase tracking-widest text-[9px] mb-0.5">Participants</span>
                      <span className="font-bold text-gray-200">{(trip.participants || []).filter(p => p.status === 'accepted').length || 1}</span>
                    </div>
                    <div>
                      <span className="block text-gray-500 font-bold uppercase tracking-widest text-[9px] mb-0.5">Budget</span>
                      <span className="font-bold text-emerald-400">₹{trip.budget.toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-4 pt-3 border-t border-white/5">
                  {!isActive && (
                    <button
                      onClick={() => setActiveTrip(trip)}
                      className="flex-1 bg-white/10 hover:bg-white/20 text-white font-medium py-2 rounded-xl text-sm transition"
                    >
                      Set Active
                    </button>
                  )}
                  <button
                    onClick={() => startEdit(trip)}
                    className={`font-medium py-2 rounded-xl text-sm transition ${
                      isActive ? "flex-1 bg-sky-500 hover:bg-sky-600 text-white" : "px-4 bg-white/5 hover:bg-white/10 text-gray-300"
                    }`}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(trip._id, trip.tripName || trip.city)}
                    disabled={deletingId === trip._id}
                    className="px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-sm transition disabled:opacity-50"
                  >
                    {deletingId === trip._id ? "..." : "🗑️"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* EDIT MODAL */}
      {editingTrip && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]">
          <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold mb-1">Edit Trip Parameters</h3>
            <p className="text-gray-400 text-xs mb-4">Modify the trip parameters below</p>
            
            <form onSubmit={handleUpdate} className="space-y-4 text-slate-200">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Trip Name</label>
                <input 
                  type="text" 
                  value={formData.tripName} 
                  onChange={(e) => setFormData({ ...formData, tripName: e.target.value })}
                  className="w-full bg-black/20 border border-white/10 rounded-xl p-2.5 focus:outline-none focus:border-sky-500" 
                  required 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Budget (INR)</label>
                <input 
                  type="number" 
                  value={formData.budget} 
                  onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                  className="w-full bg-black/20 border border-white/10 rounded-xl p-2.5 focus:outline-none focus:border-emerald-500" 
                  required 
                />
              </div>
              <div className="bg-black/20 border border-white/5 rounded-xl p-2.5 text-xs text-gray-500">
                👥 Participants are managed via the Members panel inside the trip itinerary.
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-3 border-t border-white/5">
                <button 
                  type="button" 
                  onClick={() => setEditingTrip(null)} 
                  className="px-4 py-2 bg-white/5 rounded-xl hover:bg-white/10 transition"
                  disabled={updating}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 rounded-xl font-medium transition disabled:opacity-50"
                  disabled={updating}
                >
                  {updating ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
