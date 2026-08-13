import { useState } from "react";
import { discoverPlaces, addVerifiedPlace } from "../api/placeService";

export default function ExploreTab({ activeTrip, refreshTrips, onPlaceSelect }) {
  const [category, setCategory] = useState("attractions");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [selectedDay, setSelectedDay] = useState(1);
  const [addingId, setAddingId] = useState(null);

  const categories = [
    { value: "attractions", label: "📸 Sights & Attractions" },
    { value: "beaches", label: "🏖️ Beaches" },
    { value: "restaurants", label: "🍔 Restaurants" },
    { value: "hotels", label: "🏨 Hotels" },
    { value: "shopping", label: "🛍️ Shopping" },
    { value: "entertainment", label: "🎭 Entertainment" },
    { value: "museums", label: "🏛️ Museums" },
    { value: "parks", label: "🌲 Parks" },
    { value: "hospitals", label: "🏥 Hospitals" },
    { value: "police", label: "🚓 Police" },
  ];

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!activeTrip) return;
    setLoading(true);
    setResults([]);

    try {
      const places = await discoverPlaces(activeTrip._id, category, query);
      setResults(places);
    } catch (err) {
      alert("Failed to find places. Try a different query.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddToTrip = async (place, index) => {
    if (!activeTrip) return;
    setAddingId(index);

    try {
      const payload = {
        tripId: activeTrip._id,
        type: category === "hotels" ? "hotel" : category === "restaurants" ? "restaurant" : "sight",
        name: place.name,
        lat: place.lat,
        lng: place.lng,
        cost: place.cost || 0,
        day: selectedDay,
      };

      await addVerifiedPlace(payload);
      await refreshTrips();
      alert(`Successfully added "${place.name}" to Day ${selectedDay}!`);
    } catch (err) {
      alert("Failed to add place to trip.");
    } finally {
      setAddingId(null);
    }
  };

  if (!activeTrip) {
    return (
      <div className="p-8 text-center text-gray-400">
        <p className="text-lg font-bold">No active trip selected</p>
        <p className="text-sm mt-1">Please select or plan a trip first to explore nearby attractions.</p>
      </div>
    );
  }

  return (
    <div className="p-4 text-white pb-4">
      <div className="mb-6">
        <h2 className="text-3xl font-extrabold bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">Explore {activeTrip.city}</h2>
        <p className="text-gray-400 text-sm mt-1">Search real-world places, attractions, and service stations verified by Geoapify</p>
      </div>

      <form onSubmit={handleSearch} className="bg-slate-900/50 border border-white/5 p-4 rounded-2xl mb-4 space-y-3">
        <div>
          <label className="block text-xs text-gray-400 uppercase font-bold mb-1">Category</label>
          <select 
            value={category} 
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-slate-800 border border-white/10 rounded-xl p-2.5 text-sm focus:outline-none focus:border-sky-500"
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-400 uppercase font-bold mb-1">Keyword (Optional)</label>
          <input 
            type="text" 
            placeholder="e.g. Baga, pizza, beach..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-slate-800 border border-white/10 rounded-xl p-2.5 text-sm focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex items-end">
          <button 
            type="submit" 
            className="w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2.5 rounded-xl text-sm transition"
          >
            Search Places
          </button>
        </div>
      </form>

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-gray-400 text-sm">Searching real places via Geoapify...</p>
        </div>
      )}

      {!loading && results.length === 0 && (
        <div className="text-center py-12 text-gray-500 border border-white/5 rounded-2xl bg-slate-900/25">
          Search for nearby attractions using the filters above.
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-4">
          <div className="bg-sky-500/10 border border-sky-500/20 p-3.5 rounded-xl text-xs text-sky-300 flex items-center justify-between mb-2">
            <span>Select Day:</span>
            <select 
              value={selectedDay}
              onChange={(e) => setSelectedDay(Number(e.target.value))}
              className="bg-slate-800 border border-sky-500/30 text-white px-2.5 py-1 rounded focus:outline-none"
            >
              {Array.from({ length: activeTrip.days }, (_, i) => (
                <option key={i + 1} value={i + 1}>Day {i + 1}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {results.map((place, i) => (
              <div 
                key={i} 
                className="bg-slate-900/50 border border-white/5 hover:border-white/10 rounded-2xl p-4 transition duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-bold text-gray-100 text-lg truncate max-w-[240px]" title={place.name}>
                      {place.name}
                    </h4>
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      ₹{place.cost}
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs mb-3 truncate" title={place.address}>
                    {place.address || "Address unavailable"}
                  </p>
                </div>

                <div className="flex gap-2 border-t border-white/5 pt-3 mt-2">
                  <button 
                    onClick={() => onPlaceSelect([place.lat, place.lng])}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-gray-200 py-1.5 rounded-lg text-xs transition"
                  >
                    🗺️ Show Map
                  </button>
                  <button 
                    onClick={() => handleAddToTrip(place, i)}
                    disabled={addingId === i}
                    className="flex-1 bg-sky-500/80 hover:bg-sky-500 text-white font-medium py-1.5 rounded-lg text-xs transition disabled:opacity-50"
                  >
                    {addingId === i ? "Adding..." : "+ Add to Trip"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
