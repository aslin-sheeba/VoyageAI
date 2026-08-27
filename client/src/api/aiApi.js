import { getAuthHeaders } from "./authHeaders";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || (typeof window !== "undefined" ? window.location.origin : "");

/** Send a message to the AI assistant and receive an action-aware reply */
export async function sendMessage(message, tripId) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/api/ai/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({ message, tripId }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || "AI chat request failed");
    }
    return data.data;
  } catch (err) {
    console.error("sendMessage error:", err);
    throw err;
  }
}

/** Fetch persisted chat history for a trip from MongoDB */
export async function getChatHistory(tripId) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/api/ai/chat/${tripId}`, { headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to fetch chat history");
    }
    // Map DB schema { role, text } → widget schema { role, text }
    return (data.messages || []).map((m) => ({ role: m.role, text: m.text }));
  } catch (err) {
    console.error("getChatHistory error:", err);
    return []; // non-fatal — widget will just start fresh
  }
}
