import axios from "axios";
import Trip from "../models/Trip.js";

// Helper to rebuild locations from itinerary
function rebuildLocations(itinerary) {
  const locations = [];
  itinerary.forEach((day) => {
    day.activities.forEach((act) => {
      locations.push({
        name: act.name,
        lat: act.coords.lat,
        lng: act.coords.lng,
        cost: act.cost,
        type: act.type,
        day: day.day,
      });
    });
    if (day.hotel && day.hotel.name) {
      locations.push({
        name: day.hotel.name,
        lat: day.hotel.coords.lat,
        lng: day.hotel.coords.lng,
        cost: day.hotel.cost,
        type: "hotel",
        day: day.day,
      });
    }
  });
  return locations;
}

// GET /api/places/discover
export const discoverPlaces = async (req, res) => {
  try {
    const { tripId, category, query } = req.query;
    const userId = req.user.uid;

    if (!tripId) {
      return res.status(400).json({ success: false, error: "tripId is required" });
    }

    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({ success: false, error: "Trip not found" });
    }
    if (trip.userId !== userId) {
      return res.status(403).json({ success: false, error: "Forbidden: You do not own this trip" });
    }

    // Determine bias/filter center from trip locations
    const lat = trip.locations[0]?.lat || 20.5937;
    const lng = trip.locations[0]?.lng || 78.9629;

    const categoryMap = {
      attractions: "tourism.sights,entertainment",
      beaches: "beach",
      restaurants: "catering.restaurant",
      hotels: "accommodation.hotel",
      shopping: "commercial.shopping",
      entertainment: "entertainment",
      museums: "tourism.sights.museum",
      parks: "leisure.park",
      hospitals: "healthcare.hospital",
      police: "service.police",
      fire: "service.fire_station"
    };

    const categories = categoryMap[category] || "tourism.sights";
    const apiKey = process.env.GEOAPIFY_KEY;

    // Search query or nearby places
    let url = "https://api.geoapify.com/v2/places";
    const params = {
      categories,
      filter: `circle:${lng},${lat},20000`,
      bias: `proximity:${lng},${lat}`,
      limit: 15,
      apiKey,
    };

    if (query) {
      params.text = query;
    }

    const geoRes = await axios.get(url, { params });
    const features = geoRes.data.features || [];

    const results = features.map((f) => ({
      name: f.properties.name || f.properties.street || "Place Interest",
      address: f.properties.formatted || "",
      category: category,
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      cost: category === "hotels" ? Math.floor(Math.random() * 3000 + 2000) : category === "restaurants" ? Math.floor(Math.random() * 500 + 300) : Math.floor(Math.random() * 200),
    })).filter(item => item.name !== "Place Interest");

    res.json({ success: true, results });
  } catch (err) {
    console.error("Discover places error:", err.message);
    res.status(500).json({ success: false, error: "Failed to discover places" });
  }
};

// POST /api/places/add
export const addPlaceToTrip = async (req, res) => {
  try {
    const { tripId, type, query, day, lat, lng, cost, name } = req.body;
    const userId = req.user.uid;

    if (!tripId || !type) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({ success: false, error: "Trip not found" });
    }
    if (trip.userId !== userId) {
      return res.status(403).json({ success: false, error: "Forbidden: You do not own this trip" });
    }

    let finalName = name;
    let finalLat = lat;
    let finalLng = lng;
    let finalCost = cost || 0;

    // If coordinates are missing, search Geoapify
    if (!finalLat || !finalLng) {
      const geoRes = await axios.get("https://api.geoapify.com/v2/places", {
        params: {
          text: query || name,
          filter: `circle:${trip.locations[0]?.lng || 0},${trip.locations[0]?.lat || 0},50000`,
          categories:
            type === "hotel"
              ? "accommodation.hotel"
              : type === "restaurant"
              ? "catering.restaurant"
              : "tourism.sights",
          limit: 1,
          apiKey: process.env.GEOAPIFY_KEY,
        },
      });

      const place = geoRes.data.features?.[0];
      if (!place) {
        return res.status(404).json({ success: false, error: "Place could not be verified on the map" });
      }

      finalName = place.properties.name || query;
      finalLat = place.geometry.coordinates[1];
      finalLng = place.geometry.coordinates[0];
      if (!finalCost) {
        finalCost = type === "hotel" ? Math.floor(Math.random() * 3000 + 2000) : type === "restaurant" ? Math.floor(Math.random() * 500 + 300) : Math.floor(Math.random() * 300);
      }
    }

    const targetDay = Number(day || 1);
    const dayItem = trip.itinerary.find((d) => d.day === targetDay) || trip.itinerary[0];

    const imagePrompt = `${type === "restaurant" ? "delicious dinner" : "scenic travel photography"} at ${finalName} in ${trip.city}`;
    const image = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt)}?width=800&height=600&nologo=true`;

    if (type === "hotel") {
      dayItem.hotel = {
        name: finalName,
        cost: Number(finalCost),
        image,
        coords: { lat: Number(finalLat), lng: Number(finalLng) },
      };
    } else {
      dayItem.activities.push({
        type: type === "restaurant" ? "food" : "sight",
        name: finalName,
        cost: Number(finalCost),
        image,
        coords: { lat: Number(finalLat), lng: Number(finalLng) },
      });
    }

    trip.locations = rebuildLocations(trip.itinerary);
    
    // Recalculate estimated cost
    const totalSpent = trip.locations.reduce((sum, l) => sum + Number(l.cost || 0), 0);
    trip.budgetBreakdown.estimatedTotalCost = totalSpent;
    trip.budgetBreakdown.status = totalSpent <= trip.budget ? "Within Budget" : "Over Budget";

    await trip.save();

    res.status(201).json({
      success: true,
      trip,
    });
  } catch (err) {
    console.error("Add place error:", err.message);
    res.status(500).json({ success: false, error: "Failed to add place" });
  }
};
