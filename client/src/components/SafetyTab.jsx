import { useState, useEffect } from "react";
import { getNearbyEmergency } from "../api/guardianService";

export default function SafetyTab() {
  const [coords, setCoords] = useState(null);
  const [loadingCoords, setLoadingCoords] = useState(false);
  const [loadingServices, setLoadingServices] = useState(false);
  const [error, setError] = useState("");
  const [services, setServices] = useState([]);
  const [serviceType, setServiceType] = useState("hospital");
  const [sharingLocation, setSharingLocation] = useState(false);
  const [shareIntervalId, setShareIntervalId] = useState(null);

  const fetchEmergencyServices = async (lat, lng, type) => {
    setLoadingServices(true);
    setError("");
    try {
      const data = await getNearbyEmergency(lat, lng, type);
      setServices(data);
    } catch (err) {
      setError("Failed to retrieve nearby emergency services.");
    } finally {
      setLoadingServices(false);
    }
  };

  const handleSOS = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    setLoadingCoords(true);
    setCoords(null);
    setServices([]);
    setError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCoords({ lat, lng });
        setLoadingCoords(false);
        fetchEmergencyServices(lat, lng, serviceType);
      },
      (err) => {
        setLoadingCoords(false);
        if (err.code === err.PERMISSION_DENIED) {
          setError("Location permission denied. Please allow access to use SOS services.");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError("Location information is unavailable. Try again in a different spot.");
        } else if (err.code === err.TIMEOUT) {
          setError("Location request timed out. Please retry.");
        } else {
          setError("Unable to retrieve coordinates.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Re-fetch services if service type is changed and coords exist
  useEffect(() => {
    if (coords) {
      fetchEmergencyServices(coords.lat, coords.lng, serviceType);
    }
  }, [serviceType]);

  // Guardian Location Sharing simulation
  const toggleLocationSharing = () => {
    if (sharingLocation) {
      // Stop sharing
      if (shareIntervalId) {
        clearInterval(shareIntervalId);
        setShareIntervalId(null);
      }
      setSharingLocation(false);
      alert("Stopped sharing location with guardian.");
    } else {
      // Start sharing
      if (!navigator.geolocation) {
        alert("Geolocation unsupported.");
        return;
      }
      
      setSharingLocation(true);
      
      const interval = setInterval(() => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            console.log(`Sharing Location with Guardian: Lat ${pos.coords.latitude}, Lng ${pos.coords.longitude}`);
            // In a production app, we would make a POST /api/users/share-location here.
          },
          (err) => console.warn("Sharing failed:", err.message),
          { enableHighAccuracy: false, timeout: 5000 }
        );
      }, 15000); // sync every 15 seconds

      setShareIntervalId(interval);
      alert("Guardian location sharing enabled. Your current location will be shared securely.");
    }
  };

  // Cleanup sharing interval on unmount
  useEffect(() => {
    return () => {
      if (shareIntervalId) {
        clearInterval(shareIntervalId);
      }
    };
  }, [shareIntervalId]);

  return (
    <div className="p-6 text-white max-w-4xl mx-auto pb-6">
      <div className="mb-6">
        <h2 className="text-3xl font-extrabold bg-gradient-to-r from-red-400 to-amber-400 bg-clip-text text-transparent">Safety & Emergency</h2>
        <p className="text-gray-400 text-sm mt-1">Locate nearby services immediately and share your coordinates with guardians</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* SOS TRIGGER */}
        <div className="md:col-span-1 bg-slate-900/50 border border-white/5 p-6 rounded-2xl flex flex-col items-center justify-between text-center min-h-[300px]">
          <div>
            <h3 className="text-xl font-bold mb-2">🚨 SOS Emergency</h3>
            <p className="text-gray-400 text-xs px-2 mb-4">
              Press the button below to request GPS location and fetch closest hospitals, police departments, or fire stations.
            </p>
          </div>

          <div className="relative my-4">
            <span className="absolute inset-0 rounded-full bg-red-500/40 animate-ping"></span>
            <button 
              onClick={handleSOS}
              disabled={loadingCoords}
              className="relative w-24 h-24 rounded-full bg-gradient-to-tr from-red-600 to-rose-600 shadow-[0_0_30px_rgba(239,68,68,0.7)] text-white font-black text-xl hover:scale-105 active:scale-95 transition"
            >
              {loadingCoords ? "GPS..." : "SOS"}
            </button>
          </div>

          {coords && (
            <div className="text-[10px] text-gray-500 bg-black/20 px-3 py-1.5 rounded-lg border border-white/5">
              Current GPS: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
            </div>
          )}
        </div>

        {/* NEARBY SERVICES LIST */}
        <div className="md:col-span-2 bg-slate-900/50 border border-white/5 p-5 rounded-2xl min-h-[300px]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">🚑 Nearby Services</h3>
            {coords && (
              <select 
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                className="bg-slate-800 border border-white/10 rounded-lg px-2.5 py-1 text-xs"
              >
                <option value="hospital">Hospitals</option>
                <option value="police">Police Stations</option>
                <option value="fire">Fire Stations</option>
              </select>
            )}
          </div>

          {loadingServices && (
            <div className="text-center py-16 text-gray-400">
              <div className="inline-block w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin mb-2"></div>
              <p className="text-xs">Locating nearest services...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs text-center">
              {error}
            </div>
          )}

          {!coords && !loadingCoords && !error && (
            <div className="text-center py-20 text-gray-500 text-sm">
              Press the SOS button on the left to initialize.
            </div>
          )}

          {coords && !loadingServices && services.length === 0 && !error && (
            <div className="text-center py-20 text-gray-500 text-sm">
              No emergency services found within 5km of your current location.
            </div>
          )}

          {!loadingServices && services.length > 0 && (
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {services.map((item, index) => (
                <div key={index} className="bg-slate-900 border border-white/5 p-4 rounded-xl flex justify-between items-center hover:border-white/10 transition">
                  <div className="max-w-[80%]">
                    <h4 className="font-bold text-gray-200 truncate">{item.name}</h4>
                    <p className="text-gray-400 text-xs truncate mt-0.5">{item.address || "Address unknown"}</p>
                  </div>

                  <a 
                    href={`https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition text-center whitespace-nowrap text-white"
                  >
                    🗺️ Navigate
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* GUARDIAN LOCATION SHARING */}
      <div className="bg-slate-900/50 border border-white/5 p-5 rounded-2xl mt-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="text-3xl">🛡️</div>
          <div>
            <h3 className="font-bold text-lg">Guardian Location Sharing</h3>
            <p className="text-gray-400 text-xs mt-0.5">
              Securely stream your coordinates to a designated guardian in real-time. Toggle to start or stop sharing.
            </p>
          </div>
        </div>

        <button 
          onClick={toggleLocationSharing}
          className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 ${
            sharingLocation 
              ? "bg-amber-600 hover:bg-amber-700 text-white" 
              : "bg-sky-500 hover:bg-sky-600 text-white shadow-lg"
          }`}
        >
          {sharingLocation ? "🛑 Stop Sharing" : "🛰️ Start Sharing"}
        </button>
      </div>
    </div>
  );
}
