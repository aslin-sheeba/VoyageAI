import axios from "axios";

export async function geocodeCity(city) {
  const apiKey = process.env.GEOAPIFY_KEY;
  const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(
    city
  )}&type=city&format=json&apiKey=${apiKey}`;

  const { data } = await axios.get(url);

  if (!data.results || data.results.length === 0) {
    throw new Error("City not found in Geoapify");
  }

  const best = data.results[0];
  return { lat: best.lat, lon: best.lon };
}

export async function fetchPlacesByCategory({ lat, lon, categories, limit = 20, radiusM = 5000 }) {
  const apiKey = process.env.GEOAPIFY_KEY;
  // Places API docs: https://api.geoapify.com/v2/places?PARAMS :contentReference[oaicite:0]{index=0}
  const url = `https://api.geoapify.com/v2/places?categories=${encodeURIComponent(
    categories
  )}&filter=circle:${lon},${lat},${radiusM}&bias=proximity:${lon},${lat}&limit=${limit}&apiKey=${apiKey}`;

  const { data } = await axios.get(url);

  const features = data.features || [];
  return features
    .map((f) => ({
      name: f.properties?.name || "Unknown",
      lat: f.geometry?.coordinates?.[1],
      lng: f.geometry?.coordinates?.[0],
      address: f.properties?.formatted || "",
      categories: f.properties?.categories || [],
    }))
    .filter((p) => typeof p.lat === "number" && typeof p.lng === "number");
}
