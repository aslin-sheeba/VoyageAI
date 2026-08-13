import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";

// ── Default Leaflet marker fix ──────────────────────────────────────────────
import icon       from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
L.Marker.prototype.options.icon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41] });

// ── Typed custom div-icons ──────────────────────────────────────────────────
const ICON_CONFIG = {
  hotel:      { emoji: "🏨", bg: "#6366f1" },
  restaurant: { emoji: "🍴", bg: "#f59e0b" },
  food:       { emoji: "🍴", bg: "#f59e0b" },
  attraction: { emoji: "⭐", bg: "#0ea5e9" },
  sight:      { emoji: "📸", bg: "#0ea5e9" },
  activity:   { emoji: "🎯", bg: "#10b981" },
  transport:  { emoji: "🚗", bg: "#8b5cf6" },
  emergency:  { emoji: "🚨", bg: "#ef4444" },
  other:      { emoji: "📍", bg: "#64748b" },
};

function makeIcon(type) {
  const cfg = ICON_CONFIG[type] || ICON_CONFIG.other;
  return L.divIcon({
    className: "",
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
    html: `
      <div style="
        width:36px;height:36px;border-radius:50% 50% 50% 0;
        background:${cfg.bg};
        border:2px solid rgba(255,255,255,0.3);
        display:flex;align-items:center;justify-content:center;
        font-size:16px;
        box-shadow:0 2px 8px rgba(0,0,0,0.4);
        transform:rotate(-45deg);
      ">
        <span style="transform:rotate(45deg)">${cfg.emoji}</span>
      </div>`,
  });
}

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

// ── MAIN MAP ────────────────────────────────────────────────────────────────
export default function MapCanvas({ locations = [], zoomTo = null, selectedId = null }) {
  const markerRefs = useRef({});
  const defaultCenter = [20.5937, 78.9629];

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
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution="&copy; CARTO"
      />

      <FitBoundsHandler locations={valid} />
      <ZoomHandler zoomTo={zoomTo} selectedId={selectedId} markers={markerRefs} />
      <LocationMarker />

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
              <div style={{ fontFamily: "system-ui, sans-serif", minWidth: 220 }}>
                {/* Header */}
                <div style={{ background: ICON_CONFIG[type]?.bg || "#64748b", padding: "10px 12px", borderRadius: "8px 8px 0 0", marginBottom: 8 }}>
                  <div style={{ fontSize: 18, marginBottom: 2 }}>{ICON_CONFIG[type]?.emoji} <strong style={{ color: "#fff" }}>{loc.name}</strong></div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", textTransform: "capitalize" }}>{type} {loc.day ? `· Day ${loc.day}` : ""}</div>
                </div>

                <div style={{ padding: "0 4px 4px" }}>
                  {loc.address && <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>📍 {loc.address}</p>}
                  {loc.cost > 0 && <p style={{ fontSize: 12, color: "#34d399", fontWeight: "bold", marginBottom: 8 }}>₹{Number(loc.cost).toLocaleString("en-IN")}</p>}

                  {/* Action Buttons */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {loc.websiteUrl && (
                      <a
                        href={loc.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: "block", background: "#0ea5e9", color: "#fff", padding: "6px 10px", borderRadius: 6, fontSize: 11, fontWeight: "bold", textDecoration: "none", textAlign: "center" }}
                      >
                        🌐 Visit Website
                      </a>
                    )}
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(loc.lat + "," + loc.lng)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: "block", background: "#1e293b", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.1)", padding: "6px 10px", borderRadius: 6, fontSize: 11, fontWeight: "bold", textDecoration: "none", textAlign: "center" }}
                    >
                      🗺 Get Directions
                    </a>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}