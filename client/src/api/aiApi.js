import { getAuthHeaders } from "./authHeaders";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

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
      throw new Error(data.error || "AI chat request failed");
    }
    return data;
  } catch (err) {
    console.error("sendMessage error:", err);
    throw err;
  }
}
