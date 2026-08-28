import { getAuthHeaders } from "./authHeaders";

const BASE = import.meta.env.VITE_API_BASE_URL || (typeof window !== "undefined" ? window.location.origin : "");

export async function createSettlement(payload) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/settlements`, {
    method: "POST", headers, body: JSON.stringify(payload),
  });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Failed to create settlement"); }
  return res.json();
}

export async function listSettlements(tripId) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/settlements/trip/${tripId}`, { headers });
  if (!res.ok) throw new Error("Failed to fetch settlements");
  return res.json();
}

export async function markSettled(settlementId) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/settlements/${settlementId}/settle`, {
    method: "PATCH", headers,
  });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Failed to mark settled"); }
  return res.json();
}
