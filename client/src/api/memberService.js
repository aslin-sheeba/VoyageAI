import { getAuthHeaders } from "./authHeaders";

const BASE = import.meta.env.VITE_API_BASE_URL ?? (typeof window !== "undefined" ? window.location.origin : "");

/** Invite a member to a trip by email */
export async function inviteMember(tripId, email) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/trips/${tripId}/members`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to invite member");
  }
  return res.json();
}

/** List all members of a trip */
export async function listMembers(tripId) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/trips/${tripId}/members`, { headers });
  if (!res.ok) throw new Error("Failed to fetch members");
  return res.json();
}

/** Remove a member from a trip */
export async function removeMember(tripId, targetUserId) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/trips/${tripId}/members/${targetUserId}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to remove member");
  }
  return res.json();
}

/** Get pending invitations for the authenticated user */
export async function listInvitations() {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/invitations`, { headers });
  if (!res.ok) throw new Error("Failed to fetch invitations");
  return res.json();
}

/** Accept an invitation */
export async function acceptInvitation(tripId) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/invitations/${tripId}/accept`, {
    method: "POST",
    headers,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to accept invitation");
  }
  return res.json();
}

/** Decline an invitation */
export async function declineInvitation(tripId) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/invitations/${tripId}/decline`, {
    method: "POST",
    headers,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to decline invitation");
  }
  return res.json();
}
