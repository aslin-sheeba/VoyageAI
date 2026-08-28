import { getAuthHeaders } from "./authHeaders";

const BASE = import.meta.env.VITE_API_BASE_URL || (typeof window !== "undefined" ? window.location.origin : "");

export async function getNotifications(limit = 50) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/notifications?limit=${limit}`, { headers });
  if (!res.ok) return { notifications: [], unreadCount: 0 };
  return res.json();
}

export async function markRead(id) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/notifications/${id}/read`, { method: "PATCH", headers });
  if (!res.ok) throw new Error("Failed to mark notification as read");
  return res.json();
}

export async function markAllRead() {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/notifications/read-all`, { method: "PATCH", headers });
  if (!res.ok) throw new Error("Failed to mark all as read");
  return res.json();
}
