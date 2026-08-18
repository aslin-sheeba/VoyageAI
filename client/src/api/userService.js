import { getAuthHeaders } from "./authHeaders";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000";

export async function syncUser(profileData) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/api/users/sync`, {
      method: "POST",
      headers,
      body: JSON.stringify(profileData),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Sync profile failed: ${res.status} ${text}`);
    }

    return await res.json();
  } catch (err) {
    console.error("syncUser error:", err);
    throw err;
  }
}

export async function getUserProfile() {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/api/users/profile`, {
      method: "GET",
      headers,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Get profile failed: ${res.status} ${text}`);
    }

    return await res.json();
  } catch (err) {
    console.error("getUserProfile error:", err);
    throw err;
  }
}
