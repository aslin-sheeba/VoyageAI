import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef, useState } from "react";

// ── Default Leaflet marker fix ──────────────────────────────────────────────
import icon       from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
L.Marker.prototype.options.icon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41] });

// ── Typed custom div-icons — glass drop style ─────────────────────────────
const ICON_CONFIG = {
  hotel:      { emoji: "🏨", bg: "#6366f1", glow: "rgba(99,102,241,0.5)"  },
  restaurant: { emoji: "🍴", bg: "#f59e0b", glow: "rgba(245,158,11,0.5)"  },
  food:       { emoji: "🍴", bg: "#f59e0b", glow: "rgba(245,158,11,0.5)"  },
  attraction: { emoji: "⭐", bg: "#0ea5e9", glow: "rgba(14,165,233,0.5)"  },
  sight:      { emoji: "📸", bg: "#0ea5e9", glow: "rgba(14,165,233,0.5)"  },
  activity:   { emoji: "🎯", bg: "#10b981", glow: "rgba(16,185,129,0.5)"  },
  transport:  { emoji: "🚗", bg: "#8b5cf6", glow: "rgba(139,92,246,0.5)"  },
  emergency:  { emoji: "🚨", bg: "#ef4444", glow: "rgba(239,68,68,0.5)"   },
  other:      { emoji: "📍", bg: "#64748b", glow: "rgba(100,116,139,0.5)" },
};

function makeIcon(type) {
  const cfg = ICON_CONFIG[type] || ICON_CONFIG.other;
  return L.divIcon({
    className: "",
    iconAnchor: [20, 40],
    popupAnchor: [0, -42],
    html: `
      <div style="
        position:relative;
        width:40px;height:40px;
      ">
        <!-- glow ring -->
        <div style="
          position:absolute;inset:-4px;
          border-radius:50%;
          background:${cfg.glow};
          filter:blur(6px);
          opacity:0.7;
        "></div>
        <!-- glass pin body -->
        <div style="
          position:absolute;inset:0;
          border-radius:50% 50% 50% 0;
          background:linear-gradient(135deg,${cfg.bg}CC,${cfg.bg}88);
          border:1.5px solid rgba(255,255,255,0.3);
          box-shadow:
            0 4px 14px ${cfg.glow},
            inset 0 1px 0 rgba(255,255,255,0.35);
          backdrop-filter:blur(6px);
          display:flex;align-items:center;justify-content:center;
          font-size:17px;
          transform:rotate(-45deg);
        ">
          <span style="transform:rotate(45deg);display:block;line-height:1">${cfg.emoji}</span>
        </div>
      </div>`,
  });
}

// ── User location dot icon ──────────────────────────────────────────────────
const USER_ICON = L.divIcon({
  className: "",
  iconAnchor: [12, 12],
  html: `
    <div style="position:relative;width:24px;height:24px;">
      <div style="
        position:absolute;inset:0;border-radius:50%;
        background:rgba(56,189,248,0.2);
        animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;
      "></div>
      <div style="
        position:absolute;inset:4px;border-radius:50%;
        background:#38bdf8;
        border:2px solid #fff;
        box-shadow:0 0 8px rgba(56,189,248,0.7);
      "></div>
    </div>`,
});

// ── FitBounds: auto-zoom map to all markers ─────────────────────────────────
function FitBoundsHandler({ locations }) {
  const map      = useMap();
  const prevKey  = useRef(null);

  useEffect(() => {
    const valid = (locations || []).filter(l => l.lat && l.lng && Math.abs(l.lat) > 0.001);
    const key   = valid.map(l => `${l.lat},${l.lng}`).join("|");
    if (!valid.length || key === prevKey.current) return;
    prevKey.current = key;

    if (valid.length === 1) {
      map.flyTo([valid[0].lat, valid[0].lng], 13, { animate: true, duration: 1.2 });
    } else {
      const bounds = L.latLngBounds(valid.map(l => [l.lat, l.lng]));
      map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 14, animate: true, duration: 1.2 });
    }
  }, [locations, map]);

  return null;
}

// ── ZoomTo: fly to a selected location ─────────────────────────────────────
function ZoomHandler({ zoomTo, selectedId, markers }) {
  const map = useMap();
  useEffect(() => {
    if (!zoomTo) return;
    if (typeof zoomTo[0] === "number" && typeof zoomTo[1] === "number") {
      map.flyTo(zoomTo, 15, { animate: true, duration: 0.8 });
      // Open popup of matching marker
      if (selectedId && markers.current[selectedId]) {
        setTimeout(() => markers.current[selectedId].openPopup(), 900);
      }
    }
  }, [zoomTo, selectedId]);
  return null;
}

// ── User Location button ────────────────────────────────────────────────────
function LocationMarker() {
  const map = useMap();
  useEffect(() => {
    const Ctrl = L.Control.extend({
      options: { position: "bottomright" },
      onAdd() {
        const btn = L.DomUtil.create("button", "leaflet-bar leaflet-control");
        Object.assign(btn.style, { background: "#0f172a", color: "white", width: "40px", height: "40px", border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", borderRadius: "8px", fontSize: "18px" });
        btn.innerHTML = "🎯";
        btn.title     = "My location";
        btn.onclick = () => map.locate().on("locationfound", e => map.flyTo(e.latlng, 14));
        return btn;
      },
    });
    const ctrl = new Ctrl();
    map.addControl(ctrl);
    return () => map.removeControl(ctrl);
  }, [map]);
  return null;
}

// ── ClearDirectionsControl ──────────────────────────────────────────────────
function ClearDirectionsControl({ onClear, visible }) {
  const map = useMap();
  const ctrlRef = useRef(null);

  useEffect(() => {
    if (!visible) {
      if (ctrlRef.current) { map.removeControl(ctrlRef.current); ctrlRef.current = null; }
      return;
    }
    const Ctrl = L.Control.extend({
      options: { position: "topright" },
      onAdd() {
        const btn = L.DomUtil.create("button", "");
        Object.assign(btn.style, {
          background: "rgba(239,68,68,0.85)",
          backdropFilter: "blur(8px)",
          color: "white",
          border: "1px solid rgba(255,255,255,0.2)",
          padding: "6px 12px",
          borderRadius: "10px",
          fontSize: "11px",
          fontWeight: "bold",
          cursor: "pointer",
          marginTop: "10px",
          boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
        });
        btn.innerText = "✕ Clear Directions";
        btn.onclick = () => { L.DomEvent.stopPropagation(btn); onClear(); };
        return btn;
      },
    });
    ctrlRef.current = new Ctrl();
    map.addControl(ctrlRef.current);
    return () => { if (ctrlRef.current) map.removeControl(ctrlRef.current); };
  }, [visible, map, onClear]);

  return null;
}

// ── RouteBoundsHandler: fit map to route bounds ────────────────────────────
function RouteBoundsHandler({ routeLine }) {
  const map = useMap();
  useEffect(() => {
    if (!routeLine || routeLine.length === 0) return;
    const bounds = L.latLngBounds(routeLine);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15, animate: true, duration: 1.2 });
  }, [routeLine, map]);
  return null;
}

// ── MAIN MAP ────────────────────────────────────────────────────────────────
export default function MapCanvas({ activeTripId, locations = [], zoomTo = null, selectedId = null }) {
  const markerRefs    = useRef({});
  const defaultCenter = [20.5937, 78.9629];

  // ── Routing state ───────────────────────────────────────────────────────
  const [routeLine,   setRouteLine]   = useState(null);   // [[lat,lng], ...]
  const [userLatLng,  setUserLatLng]  = useState(null);   // [lat, lng] of device
  const [loadingDir,  setLoadingDir]  = useState(false);
  const [dirError,    setDirError]    = useState("");

  // ── Clear directions whenever the user switches trip ───────────────────
  useEffect(() => {
    setRouteLine(null);
    setUserLatLng(null);
    setDirError("");
    setLoadingDir(false);
  }, [activeTripId]);
  const fetchRoute = async (destLat, destLng) => {
    setDirError("");
    setLoadingDir(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: sLat, longitude: sLng } = pos.coords;
        setUserLatLng([sLat, sLng]);
        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${sLng},${sLat};${destLng},${destLat}?overview=full&geometries=geojson`;
          const res  = await fetch(url);
          const data = await res.json();
          if (data.routes && data.routes.length > 0) {
            const coords = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
            setRouteLine(coords);
          } else {
            setDirError("No route found.");
          }
        } catch {
          setDirError("Could not fetch route.");
        } finally {
          setLoadingDir(false);
        }
      },
      () => {
        setDirError("Location access denied.");
        setLoadingDir(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const clearRoute = () => {
    setRouteLine(null);
    setUserLatLng(null);
    setDirError("");
  };

  // Normalise: filter invalid coords, deduplicate by id/name+lat+lng
  const seen  = new Set();
  const valid = [];
  for (const loc of locations) {
    if (!loc.lat || !loc.lng || Math.abs(loc.lat) < 0.001) continue;
    const key = loc.id || `${loc.name}|${loc.lat.toFixed(5)}|${loc.lng.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    valid.push({ ...loc, _key: key });
  }

  return (
    <MapContainer center={defaultCenter} zoom={5} className="w-full h-full z-0">
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        className="map-tiles-dark"
      />

      <FitBoundsHandler locations={valid} />
      <ZoomHandler zoomTo={zoomTo} selectedId={selectedId} markers={markerRefs} />
      <LocationMarker />
      <ClearDirectionsControl visible={!!routeLine} onClear={clearRoute} />
      <RouteBoundsHandler routeLine={routeLine} />

      {/* Route polyline */}
      {routeLine && (
        <Polyline
          positions={routeLine}
          pathOptions={{
            color: "#38bdf8",
            weight: 6,
            opacity: 0.85,
            dashArray: "8 4",
          }}
        />
      )}

      {/* User location dot */}
      {userLatLng && (
        <Marker position={userLatLng} icon={USER_ICON} />
      )}

      {valid.map((loc) => {
        const type = loc.type || "other";
        return (
          <Marker
            key={loc._key}
            position={[loc.lat, loc.lng]}
            icon={makeIcon(type)}
            ref={el => { if (el) markerRefs.current[loc._key] = el; }}
          >
            <Popup maxWidth={280} className="voyage-popup">
              {/* Glass header */}
              <div style={{
                background: `linear-gradient(135deg, ${ICON_CONFIG[type]?.bg}CC 0%, ${ICON_CONFIG[type]?.bg}88 100%)`,
                backdropFilter: "blur(12px) saturate(180%)",
                padding: "12px 14px 10px",
                borderRadius: "12px 12px 0 0",
                marginBottom: 0,
                borderBottom: "1px solid rgba(255,255,255,0.1)",
              }}>
                <div style={{ fontSize: 19, marginBottom: 3 }}>
                  {ICON_CONFIG[type]?.emoji}{" "}
                  <strong style={{ color: "#fff", fontSize: 14 }}>{loc.name}</strong>
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", textTransform: "capitalize", letterSpacing: "0.05em" }}>
                  {type}{loc.day ? ` · Day ${loc.day}` : ""}
                </div>
              </div>

              {/* Glass body */}
              <div style={{
                background: "rgba(15, 23, 42, 0.55)",
                backdropFilter: "blur(16px) saturate(160%)",
                padding: "10px 12px 12px",
                borderRadius: "0 0 12px 12px",
              }}>
                {loc.address && <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 7 }}>📍 {loc.address}</p>}
                {loc.cost > 0 && <p style={{ fontSize: 13, color: "#34d399", fontWeight: "bold", marginBottom: 10 }}>₹{Number(loc.cost).toLocaleString("en-IN")}</p>}

                {/* Action Buttons */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {loc.websiteUrl && (
                    <a
                      href={loc.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "block",
                        background: "linear-gradient(135deg,#0ea5e9,#6366f1)",
                        color: "#fff",
                        padding: "7px 10px",
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: "bold",
                        textDecoration: "none",
                        textAlign: "center",
                        boxShadow: "0 2px 8px rgba(14,165,233,0.3)",
                      }}
                    >
                      🌐 Visit Website
                    </a>
                  )}
                  <button
                    onClick={() => fetchRoute(loc.lat, loc.lng)}
                    disabled={loadingDir}
                    style={{
                      display: "block",
                      width: "100%",
                      background: loadingDir
                        ? "rgba(30,41,59,0.6)"
                        : "linear-gradient(135deg,rgba(16,185,129,0.2),rgba(14,165,233,0.15))",
                      color: loadingDir ? "#64748b" : "#34d399",
                      border: "1px solid rgba(52,211,153,0.3)",
                      padding: "7px 10px",
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: "bold",
                      textAlign: "center",
                      cursor: loadingDir ? "not-allowed" : "pointer",
                      backdropFilter: "blur(8px)",
                      transition: "all 0.2s",
                    }}
                  >
                    {loadingDir ? "📡 Finding route..." : "🗺 Show Directions"}
                  </button>
                  {dirError && <p style={{ fontSize: 10, color: "#f87171", marginTop: 2, textAlign: "center" }}>{dirError}</p>}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}