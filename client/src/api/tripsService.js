// src/api/tripsService.js
import { getAuthHeaders } from "./authHeaders";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

/**
 * Fetch trips for the currently authenticated user (UID verified server-side)
 */
export async function getTrips() {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/api/trips`, {
      method: "GET",
      headers,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to fetch trips: ${res.status} ${text}`);
    }

    const data = await res.json();
    return data ?? [];
  } catch (err) {
    console.error("getTrips error:", err);
    return [];
  }
}

/**
 * Generate a new Trip using Gemini + Geoapify
 */
export async function generateTrip(payload) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/api/trips/generate`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to generate trip: ${res.status} ${text}`);
    }

    return await res.json();
  } catch (err) {
    console.error("generateTrip error:", err);
    throw err;
  }
}

/**
 * Update trip details (itinerary edits, budget adjustments, etc.)
 */
export async function updateTrip(tripId, payload) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/api/trips/${tripId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to update trip: ${res.status} ${text}`);
    }

    return await res.json();
  } catch (err) {
    console.error("updateTrip error:", err);
    throw err;
  }
}

/**
 * Delete a specific trip by ID
 */
export async function deleteTrip(tripId) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/api/trips/${tripId}`, {
      method: "DELETE",
      headers,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to delete trip: ${res.status} ${text}`);
    }

    return await res.json();
  } catch (err) {
    console.error("deleteTrip error:", err);
    throw err;
  }
}

/**
 * Clear all trips for the authenticated user
 */
export async function clearAllTrips() {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/api/trips/clear`, {
      method: "DELETE",
      headers,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to clear trips: ${res.status} ${text}`);
    }

    return await res.json();
  } catch (err) {
    console.error("clearAllTrips error:", err);
    throw err;
  }
}