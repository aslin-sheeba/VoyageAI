import { getAuthHeaders } from "./authHeaders";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000";

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
