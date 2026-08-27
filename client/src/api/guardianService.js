import { getAuthHeaders } from "./authHeaders";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (typeof window !== "undefined" ? window.location.origin : "");

/** Fetch nearby emergency services (hospital / police / fire) */
export async function getNearbyEmergency(lat, lng, type = "hospital") {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/api/guardian/nearby?lat=${lat}&lng=${lng}&type=${type}`, {
      method: "GET",
      headers,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to load nearby services: ${res.status} ${text}`);
    }

    const data = await res.json();
    return data.results || [];
  } catch (err) {
    console.error("getNearbyEmergency error:", err);
    throw err;
  }
}

/** Push current GPS coordinates to the server (upserted, TTL 24h) */
export async function shareLocation(lat, lng) {
  try {
    const headers = await getAuthHeaders();
    await fetch(`${BASE_URL}/api/guardian/share-location`, {
      method:  "POST",
      headers,
      body:    JSON.stringify({ lat, lng }),
    });
  } catch (err) {
    console.error("shareLocation error:", err);
    // Non-fatal — silently ignore network blips during live tracking
  }
}

/** Dispatch an SOS alert; the server will SMS trip co-members */
export async function triggerSOS(lat, lng, tripId) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}/api/guardian/sos`, {
    method:  "POST",
    headers,
    body:    JSON.stringify({ lat, lng, tripId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "SOS dispatch failed");
  return data;
}
