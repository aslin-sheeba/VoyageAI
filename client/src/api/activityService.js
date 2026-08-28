import { getAuthHeaders } from "./authHeaders";

const BASE = import.meta.env.VITE_API_BASE_URL || (typeof window !== "undefined" ? window.location.origin : "");

export async function getActivityLog(tripId, category = "all") {
  const headers = await getAuthHeaders();
  const url = `${BASE}/api/activity/${tripId}${category !== "all" ? `?category=${category}` : ""}`;
  const res = await fetch(url, { headers });
  if (!res.ok) return { logs: [] };
  return res.json();
}
