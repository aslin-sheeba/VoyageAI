import { getAuthHeaders } from "./authHeaders";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export async function getExpenses(tripId) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/api/expenses/trip/${tripId}`, {
      method: "GET",
      headers,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to fetch expenses: ${res.status} ${text}`);
    }

    const data = await res.json();
    return data.expenses || [];
  } catch (err) {
    console.error("getExpenses error:", err);
    return [];
  }
}

export async function addExpense(payload) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/api/expenses`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to log expense: ${res.status} ${text}`);
    }

    return await res.json();
  } catch (err) {
    console.error("addExpense error:", err);
    throw err;
  }
}

export async function updateExpense(id, payload) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/api/expenses/${id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to update expense: ${res.status} ${text}`);
    }

    return await res.json();
  } catch (err) {
    console.error("updateExpense error:", err);
    throw err;
  }
}

export async function deleteExpense(id) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/api/expenses/${id}`, {
      method: "DELETE",
      headers,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to delete expense: ${res.status} ${text}`);
    }

    return await res.json();
  } catch (err) {
    console.error("deleteExpense error:", err);
    throw err;
  }
}
