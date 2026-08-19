const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export async function fetchTrips(userId) {
  const res = await fetch(`${BASE_URL}/api/trips/${userId}`);
  if (!res.ok) throw new Error("Failed to fetch trips");
  return res.json();
}

export async function saveTrip(trip) {
  const res = await fetch(`${BASE_URL}/api/trips`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(trip),
  });
  if (!res.ok) throw new Error("Failed to save trip");
  return res.json();
}
