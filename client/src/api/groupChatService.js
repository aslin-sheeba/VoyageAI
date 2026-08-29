import { getAuthHeaders } from "./authHeaders";

const BASE = import.meta.env.VITE_API_BASE_URL || (typeof window !== "undefined" ? window.location.origin : "");

export async function getMessages(tripId, limit = 100) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/group-chat/${tripId}?limit=${limit}`, { headers });
  if (!res.ok) throw new Error("Failed to fetch messages");
  const data = await res.json();
  return data.messages || [];
}

export async function sendMessage(tripId, message) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/group-chat/${tripId}`, {
    method: "POST", headers, body: JSON.stringify({ message }),
  });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Failed to send message"); }
  return res.json();
}

export async function clearMessages(tripId) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/group-chat/${tripId}`, { method: "DELETE", headers });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Failed to clear chat"); }
  return res.json();
}

