import { getAuthHeaders } from "./authHeaders";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export async function discoverPlaces(tripId, category, query = "") {
  try {
    const headers = await getAuthHeaders();
    const url = new URL(`${BASE_URL}/api/places/discover`);
    url.searchParams.append("tripId", tripId);
    url.searchParams.append("category", category);
    if (query) {
      url.searchParams.append("query", query);
    }

    const res = await fetch(url.toString(), {
      method: "GET",
      headers,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Discover places failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    return data.results || [];
  } catch (err) {
    console.error("discoverPlaces error:", err);
    throw err;
  }
}

export async function addPlace(tripId, type, query, day = 1) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/api/places/add`, {
      method: "POST",
      headers,
      body: JSON.stringify({ tripId, type, query, day }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Add place failed: ${res.status} ${text}`);
    }

    return await res.json();
  } catch (err) {
    console.error("addPlace error:", err);
    throw err;
  }
}

export async function addVerifiedPlace(payload) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/api/places/add`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload), // payload can include name, lat, lng, cost, type, day, tripId
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Add verified place failed: ${res.status} ${text}`);
    }

    return await res.json();
  } catch (err) {
    console.error("addVerifiedPlace error:", err);
    throw err;
  }
}
