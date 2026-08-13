import { useState } from "react";
import { createPortal } from "react-dom";
import { updateTrip } from "../api/tripsService";
import { sendMessage } from "../api/aiApi";
import TripMembersPanel from "./TripMembersPanel";

// ── Image / Place Details Modal ──────────────────────────────────────────────
function PlaceModal({ place, onClose }) {
  const [imgError, setImgError] = useState(false);
  if (!place) return null;
  const fallback = "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=2021&auto=format&fit=crop";

  const openWebsite = () => {
    if (place.websiteUrl) {
      window.open(place.websiteUrl, "_blank", "noopener,noreferrer");
    }
  };

  const openDirections = () => {
    if (place.coords?.lat && place.coords?.lng) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place.coords.lat + "," + place.coords.lng)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-lg w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-white/10"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 bg-black/50 hover:bg-black/80 text-white rounded-full w-8 h-8 flex items-center justify-center z-10 transition"
        >
          ✕
        </button>

        {/* Image */}
        {place.image && (
          <img
            src={imgError ? fallback : place.image}
            alt={place.name}
            className="w-full h-48 object-cover"
            onError={() => setImgError(true)}
          />
        )}

        {/* Details */}
        <div className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <span className="text-2xl">{place.type === "food" ? "🍴" : place.type === "hotel" ? "🏨" : "📸"}</span>
            <div>
              <h3 className="text-xl font-bold text-white leading-tight">{place.name}</h3>
              <span className="text-xs text-sky-400 uppercase tracking-wider font-bold">{place.type}</span>
            </div>
          </div>

          {place.address && (
            <p className="text-sm text-gray-400 flex items-center gap-1.5 mb-2">
              <span>📍</span> {place.address}
            </p>
          )}

          {place.cost > 0 && (
            <p className="text-sm font-bold text-emerald-400 mb-4">
              Estimated Cost: ₹{Number(place.cost).toLocaleString("en-IN")}
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {place.websiteUrl ? (
              <button
                onClick={openWebsite}
                className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2"
              >
                🌐 Visit Official Website
              </button>
            ) : (
              <div className="w-full bg-white/5 text-gray-500 font-medium py-2.5 rounded-xl text-sm text-center">
                🌐 Website unavailable
              </div>
            )}
            <button
              onClick={openDirections}
              className="w-full bg-slate-800 hover:bg-slate-700 text-gray-300 border border-white/10 font-bold py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2"
            >
              🗺 Get Directions
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── MAIN TIMELINE COMPONENT ──────────────────────────────────────────────────
export default function Timeline({ trip, setActiveTrip, spent, total, percent }) {
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [addingToDay,   setAddingToDay]   = useState(null);
  const [regeneratingDay, setRegeneratingDay] = useState(null);
  const [newPlace, setNewPlace]           = useState({ name: "", type: "sight", cost: "" });

  if (!trip) {
    return <div className="p-8 text-center text-gray-500">Select a trip to view plan</div>;
  }

  // Accepted members count (fallback to 1)
  const acceptedCount = (trip.participants || []).filter(p => p.status === "accepted").length || 1;
  const budgetPerPerson = total > 0 && acceptedCount > 0 ? Math.round(total / acceptedCount) : 0;
  const spentPerPerson  = acceptedCount > 0 ? Math.round(spent / acceptedCount) : spent;

  const openPlace = (place) => setSelectedPlace(place);
  const closePlace = () => setSelectedPlace(null);

  // ── Save helper ─────────────────────────────────────────────────────────────
  const saveTripUpdates = async (updatedItinerary) => {
    const locationsSeen = new Set();
    const locations = [];
    updatedItinerary.forEach(day => {
      day.activities.forEach(act => {
        const key = `${act.name}|${act.coords?.lat}|${act.coords?.lng}`;
        if (!locationsSeen.has(key) && act.coords?.lat) {
          locationsSeen.add(key);
          locations.push({
            name:       act.name,
            lat:        act.coords?.lat || 0,
            lng:        act.coords?.lng || 0,
            cost:       act.cost,
            type:       act.type === "food" ? "restaurant" : "attraction",
            address:    act.address    || "",
            websiteUrl: act.websiteUrl || "",
            placeId:    act.placeId    || "",
            day:        day.day,
          });
        }
      });
      if (day.hotel && day.hotel.name) {
        const key = `${day.hotel.name}|${day.hotel.coords?.lat}|${day.hotel.coords?.lng}`;
        if (!locationsSeen.has(key) && day.hotel.coords?.lat) {
          locationsSeen.add(key);
          locations.push({
            name:       day.hotel.name,
            lat:        day.hotel.coords?.lat || 0,
            lng:        day.hotel.coords?.lng || 0,
            cost:       day.hotel.cost,
            type:       "hotel",
            address:    day.hotel.address    || "",
            websiteUrl: day.hotel.websiteUrl || "",
            placeId:    day.hotel.placeId    || "",
            day:        day.day,
          });
        }
      }
    });

    const updatedSpent = locations.reduce((s, l) => s + Number(l.cost || 0), 0);
    const budgetBreakdown = {
      ...trip.budgetBreakdown,
      estimatedTotalCost: updatedSpent,
      status: updatedSpent <= trip.budget ? "Within Budget" : "Over Budget",
    };

    const res = await updateTrip(trip._id, { itinerary: updatedItinerary, locations, budgetBreakdown });
    if (res.success && res.trip) setActiveTrip(res.trip);
  };

  // ── Delete place ────────────────────────────────────────────────────────────
  const handleDeletePlace = async (dayNum, actIndex) => {
    if (!confirm("Remove this place?")) return;
    const updated = trip.itinerary.map(d => {
      if (d.day !== dayNum) return d;
      const acts = [...d.activities];
      acts.splice(actIndex, 1);
      return { ...d, activities: acts };
    });
    await saveTripUpdates(updated);
  };

  // ── Move place ──────────────────────────────────────────────────────────────
  const handleMovePlace = async (dayNum, actIndex, dir) => {
    const updated = trip.itinerary.map(d => {
      if (d.day !== dayNum) return d;
      const acts  = [...d.activities];
      const tgt   = actIndex + dir;
      if (tgt >= 0 && tgt < acts.length) {
        [acts[actIndex], acts[tgt]] = [acts[tgt], acts[actIndex]];
      }
      return { ...d, activities: acts };
    });
    await saveTripUpdates(updated);
  };

  // ── Add custom place ────────────────────────────────────────────────────────
  const handleAddCustomPlace = async (dayNum) => {
    if (!newPlace.name.trim()) return;
    const ref = trip.locations.find(l => l.lat && l.lng) || { lat: 15.49, lng: 73.82 };
    const img = `https://image.pollinations.ai/prompt/${encodeURIComponent(`${newPlace.type === "food" ? "dinner" : "sightseeing"} at ${newPlace.name} in ${trip.city}`)}?width=800&height=600&nologo=true`;

    const updated = trip.itinerary.map(d => {
      if (d.day !== dayNum) return d;
      return {
        ...d,
        activities: [
          ...d.activities,
          {
            type:   newPlace.type === "food" ? "food" : "sight",
            name:   newPlace.name,
            cost:   Number(newPlace.cost || 0),
            image:  img,
            address:    "",
            websiteUrl: "",
            placeId:    "",
            coords: {
              lat: ref.lat + (Math.random() - 0.5) * 0.05,
              lng: ref.lng + (Math.random() - 0.5) * 0.05,
            },
          },
        ],
      };
    });
    setNewPlace({ name: "", type: "sight", cost: "" });
    setAddingToDay(null);
    await saveTripUpdates(updated);
  };

  // ── Regenerate day ──────────────────────────────────────────────────────────
  const handleRegenerateDay = async (dayNum) => {
    if (!confirm(`Regenerate Day ${dayNum} plans with AI?`)) return;
    setRegeneratingDay(dayNum);
    try {
      const res = await sendMessage(`Regenerate Day ${dayNum} for my trip to ${trip.city}`, trip._id);
      if (res.updatedTrip) {
        setActiveTrip(res.updatedTrip);
      } else {
        alert(res.reply || "AI regenerated plans, but trip was not updated.");
      }
    } catch (err) {
      alert("Failed to regenerate: " + err.message);
    } finally {
      setRegeneratingDay(null);
    }
  };

  const BudgetBar = () => (
    <div className="mb-4 p-4 bg-slate-800/50 rounded-xl border border-white/5 space-y-2">
      <div className="flex justify-between text-sm text-gray-300">
        <span>Est. Cost</span>
        <span className={spent > total ? "text-red-400" : "text-emerald-400"}>
          ₹{spent.toLocaleString("en-IN")} / ₹{total.toLocaleString("en-IN")}
        </span>
      </div>
      <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${spent > total ? "bg-red-500" : "bg-emerald-500"}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      {acceptedCount > 1 && (
        <div className="flex justify-between text-xs text-gray-400 pt-1 border-t border-white/5">
          <span>👥 {acceptedCount} participants · Per person</span>
          <span className="font-bold text-sky-400">₹{budgetPerPerson.toLocaleString("en-IN")} budget / ₹{spentPerPerson.toLocaleString("en-IN")} est.</span>
        </div>
      )}
    </div>
  );

  return (
    <>
      <PlaceModal place={selectedPlace} onClose={closePlace} />

      <div className="p-4 pb-20">
        {/* Trip Header */}
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-white mb-1">{trip.city} Trip</h2>
          <p className="text-gray-400 text-sm">
            {trip.days} Days · {acceptedCount} {acceptedCount === 1 ? "Participant" : "Participants"}
          </p>
        </div>

        <BudgetBar />

        {/* Members Panel */}
        <TripMembersPanel trip={trip} onTripUpdate={setActiveTrip} />

        <div className="mt-6">
          {trip.itinerary && trip.itinerary.length > 0 ? (
            <div className="space-y-8">
              {trip.itinerary.map(dayItem => (
                <div key={dayItem.day} className="relative pl-6 border-l-2 border-sky-500/30">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-sky-500 border-4 border-slate-900" />

                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">Day {dayItem.day}</h3>
                    <button
                      onClick={() => handleRegenerateDay(dayItem.day)}
                      disabled={regeneratingDay === dayItem.day}
                      className="text-xs bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 px-2.5 py-1 rounded transition disabled:opacity-50"
                    >
                      {regeneratingDay === dayItem.day ? "Regenerating..." : "🔄 AI Redo Day"}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {/* Activities */}
                    {dayItem.activities.map((act, i) => (
                      <div
                        key={i}
                        className="bg-slate-800 p-3 rounded-lg border border-white/5 hover:border-sky-500/30 transition flex justify-between items-center group"
                      >
                        <div
                          className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
                          onClick={() => openPlace(act)}
                        >
                          <span className="text-lg flex-shrink-0">{act.type === "food" ? "🍴" : "📸"}</span>
                          <div className="truncate min-w-0">
                            <h4 className="font-medium text-gray-200 group-hover:text-sky-400 transition truncate text-sm">{act.name}</h4>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-sky-400 uppercase tracking-wider">{act.type}</span>
                              {act.websiteUrl && (
                                <span className="text-[10px] text-indigo-400">🌐</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <span className="text-xs font-bold text-emerald-400">₹{act.cost}</span>
                          <div className="flex gap-0.5">
                            <button
                              onClick={e => { e.stopPropagation(); handleMovePlace(dayItem.day, i, -1); }}
                              disabled={i === 0}
                              className="p-1 text-slate-400 hover:text-white transition disabled:opacity-30 text-[10px]"
                              title="Move up"
                            >▲</button>
                            <button
                              onClick={e => { e.stopPropagation(); handleMovePlace(dayItem.day, i, 1); }}
                              disabled={i === dayItem.activities.length - 1}
                              className="p-1 text-slate-400 hover:text-white transition disabled:opacity-30 text-[10px]"
                              title="Move down"
                            >▼</button>
                            <button
                              onClick={e => { e.stopPropagation(); handleDeletePlace(dayItem.day, i); }}
                              className="p-1 text-red-400/60 hover:text-red-400 transition text-[10px] font-bold"
                              title="Remove"
                            >✕</button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Hotel */}
                    {dayItem.hotel && (
                      <div
                        onClick={() => openPlace({ ...dayItem.hotel, type: "hotel" })}
                        className="bg-slate-800/40 p-3 rounded-lg border border-indigo-500/20 hover:border-indigo-400 transition flex justify-between items-center cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-lg flex-shrink-0">🌙</span>
                          <div className="truncate min-w-0">
                            <h4 className="font-medium text-gray-300 group-hover:text-indigo-300 transition truncate text-sm">
                              Night: {dayItem.hotel.name}
                            </h4>
                            {dayItem.hotel.websiteUrl && (
                              <span className="text-[10px] text-indigo-400">🌐 Website available</span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs font-bold text-emerald-400 flex-shrink-0 ml-2">₹{dayItem.hotel.cost}</span>
                      </div>
                    )}

                    {/* Add Custom Place */}
                    {addingToDay === dayItem.day ? (
                      <div className="bg-slate-900 border border-white/10 p-3 rounded-xl space-y-2 mt-2">
                        <input
                          type="text"
                          placeholder="Place name"
                          value={newPlace.name}
                          onChange={e => setNewPlace({ ...newPlace, name: e.target.value })}
                          className="w-full bg-slate-800 border border-white/10 rounded px-2.5 py-1 text-xs text-white focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <select
                            value={newPlace.type}
                            onChange={e => setNewPlace({ ...newPlace, type: e.target.value })}
                            className="flex-1 bg-slate-800 border border-white/10 rounded px-2 py-1 text-xs text-white"
                          >
                            <option value="sight">Sight</option>
                            <option value="food">Restaurant</option>
                          </select>
                          <input
                            type="number"
                            placeholder="Cost (₹)"
                            value={newPlace.cost}
                            onChange={e => setNewPlace({ ...newPlace, cost: e.target.value })}
                            className="flex-1 bg-slate-800 border border-white/10 rounded px-2 py-1 text-xs text-white"
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setAddingToDay(null)} className="text-[10px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded transition text-gray-300">Cancel</button>
                          <button onClick={() => handleAddCustomPlace(dayItem.day)} className="text-[10px] bg-sky-500 hover:bg-sky-600 px-3 py-1 rounded transition text-white font-semibold">Add</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingToDay(dayItem.day)}
                        className="w-full py-1.5 border border-dashed border-white/10 hover:border-sky-500/40 text-gray-400 hover:text-sky-400 rounded-lg text-xs font-semibold transition"
                      >
                        + Add Custom Place
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">Loading plan...</div>
          )}
        </div>
      </div>
    </>
  );
}