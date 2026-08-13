import axios from "axios";
import Trip from "../models/Trip.js";
import User from "../models/User.js";
import { askGemini } from "../services/gemini.service.js";

// --- HELPERS ---
function daysBetween(startDate, endDate) {
  const s = new Date(startDate);
  const e = new Date(endDate);
  const diff = Math.ceil((e - s) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff + 1);
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getCoords(feature) {
  if (!feature) return { lat: 0, lng: 0 };
  if (feature.properties?.lat && feature.properties?.lon) {
    return { lat: feature.properties.lat, lng: feature.properties.lon };
  }
  if (feature.geometry && feature.geometry.coordinates) {
    return { lat: feature.geometry.coordinates[1], lng: feature.geometry.coordinates[0] };
  }
  return { lat: 0, lng: 0 };
}

/** Extract all useful Geoapify fields from a feature */
function extractPlace(feature) {
  if (!feature) return null;
  const p = feature.properties || {};
  const coords = getCoords(feature);
  return {
    placeId:    p.place_id || "",
    name:       p.name || "",
    address:    p.formatted || p.address_line2 || "",
    lat:        coords.lat,
    lng:        coords.lng,
    websiteUrl: p.website || p.contact?.website || "",
    category:   Array.isArray(p.categories) ? p.categories[0] : (p.categories || ""),
  };
}

// --- 1. GET TRIPS (own + member trips) ---
export const getTripsByUser = async (req, res) => {
  try {
    const uid = req.user.uid;
    const email = req.user.email || "";

    // Own trips + trips where user is an accepted member
    const trips = await Trip.find({
      $or: [
        { userId: uid },
        { "participants": { $elemMatch: { userId: uid, status: "accepted" } } },
        // Also match by email in case userId wasn't set yet at invite time
        ...(email ? [{ "participants": { $elemMatch: { email, status: "accepted" } } }] : []),
      ]
    });

    res.json(trips);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// --- 2. GENERATE TRIP (GEMINI + GEOAPIFY) ---
export const generateTrip = async (req, res) => {
  try {
    const userId  = req.user.uid;
    const userEmail = req.user.email || "";
    const userName  = req.user.name || req.user.displayName || "Traveler";
    const userPhoto = req.user.picture || "";

    const { city, budget, startDate, endDate, interests, preferences } = req.body;
    const apiKey = process.env.GEOAPIFY_KEY;

    // --- Input validation ---
    if (!city) return res.status(400).json({ success: false, error: "Destination city is required" });
    if (!startDate || !endDate) return res.status(400).json({ success: false, error: "Start and end dates are required" });

    const start = new Date(startDate);
    const end   = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ success: false, error: "Invalid date format" });
    }
    if (end < start) return res.status(400).json({ success: false, error: "End date must not be before start date" });

    const duration   = daysBetween(startDate, endDate);
    const userBudget = Number(budget);
    if (isNaN(userBudget) || userBudget <= 0) {
      return res.status(400).json({ success: false, error: "Budget must be a valid number greater than zero" });
    }

    // 1. Geocode City
    const geoUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(city)}&apiKey=${apiKey}`;
    const geoRes = await axios.get(geoUrl);
    if (!geoRes.data.features || geoRes.data.features.length === 0) {
      return res.status(404).json({ success: false, error: "City not found on the map" });
    }
    const { lat, lon } = geoRes.data.features[0].properties;

    // 2. Fetch real places from Geoapify
    const radius = 15000;
    const [sightsRes, foodRes, hotelRes] = await Promise.all([
      axios.get(`https://api.geoapify.com/v2/places?categories=tourism.sights,entertainment&filter=circle:${lon},${lat},${radius}&limit=15&apiKey=${apiKey}`).catch(() => ({ data: { features: [] } })),
      axios.get(`https://api.geoapify.com/v2/places?categories=catering.restaurant&filter=circle:${lon},${lat},${radius}&limit=15&apiKey=${apiKey}`).catch(() => ({ data: { features: [] } })),
      axios.get(`https://api.geoapify.com/v2/places?categories=accommodation.hotel&filter=circle:${lon},${lat},${radius}&limit=10&apiKey=${apiKey}`).catch(() => ({ data: { features: [] } })),
    ]);

    const geoSights      = sightsRes.data.features || [];
    const geoRestaurants = foodRes.data.features   || [];
    const geoHotels      = hotelRes.data.features  || [];

    if (geoHotels.length === 0 && geoSights.length === 0) {
      return res.status(404).json({ success: false, error: "Not enough locations found for this destination" });
    }

    // Rich lists with websiteUrl
    const hotelsList      = geoHotels.map(extractPlace).filter(h => h && h.name);
    const sightsList      = geoSights.map(extractPlace).filter(s => s && s.name);
    const restaurantsList = geoRestaurants.map(extractPlace).filter(r => r && r.name);

    // For Gemini we only pass safe serialisable slices
    const hotelsForAI      = hotelsList.slice(0, 5).map(h => ({ name: h.name, lat: h.lat, lng: h.lng, address: h.address }));
    const sightsForAI      = sightsList.slice(0, 10).map(s => ({ name: s.name, lat: s.lat, lng: s.lng, address: s.address }));
    const restaurantsForAI = restaurantsList.slice(0, 10).map(r => ({ name: r.name, lat: r.lat, lng: r.lng, address: r.address }));

    // Creator is participant #1
    const initialParticipants = 1; // only the owner at creation

    // 3. Gemini itinerary
    const SYSTEM_PROMPT = `
You are VoyageAI, an expert travel organizer.
Construct a day-by-day travel plan for a trip to ${city}.

Trip Specifications:
- Duration: ${duration} Days
- Participants: ${initialParticipants} (owner only at this point)
- Total Budget: ₹${userBudget} INR
- Interests/Preferences: ${interests || "None specified"}, Travel Style: ${preferences || "Balanced"}

Select hotels, sights, and restaurants ONLY from the following verified Geoapify results:
HOTELS:
${JSON.stringify(hotelsForAI)}
SIGHTS:
${JSON.stringify(sightsForAI)}
RESTAURANTS:
${JSON.stringify(restaurantsForAI)}

Rules:
1. Select exactly ONE hotel for the entire trip duration. Estimate a realistic cost per night in INR.
2. For each day, assign exactly 2 sights and 2 restaurants from the lists.
3. Distribute the budget: allocate costs (INR) for hotel nights, meals, and sights. Sum must equal estimatedTotalCost.
4. Respond ONLY with a valid clean JSON object. No markdown fences, no extra text.

Required JSON Structure:
{
  "tripSummary": { "title": "Trip Title", "description": "Brief description" },
  "budgetBreakdown": { "estimatedTotalCost": 24000, "hotelCost": 12000, "foodCost": 8000, "sightCost": 4000 },
  "itinerary": [
    {
      "day": 1,
      "hotel": { "name": "Hotel Name", "cost": 3000, "lat": 15.5, "lng": 73.7 },
      "activities": [
        { "type": "sight", "name": "Sights Name", "cost": 500, "lat": 15.52, "lng": 73.72 },
        { "type": "food",  "name": "Restaurant Name", "cost": 1000, "lat": 15.53, "lng": 73.73 }
      ]
    }
  ]
}
`;

    let generatedItinerary = null;
    try {
      const geminiResponse = await askGemini(SYSTEM_PROMPT);
      let clean = geminiResponse.trim();
      if (clean.startsWith("```")) {
        clean = clean.replace(/^```(json)?/, "").replace(/```$/, "").trim();
      }
      generatedItinerary = JSON.parse(clean);
    } catch (aiErr) {
      console.warn("⚠️ Gemini parsing failed. Falling back to programmatic generation.", aiErr.message);
    }

    // 4. Fallback programmatic generation
    if (!generatedItinerary || !generatedItinerary.itinerary || generatedItinerary.itinerary.length === 0) {
      const hotelBase = randInt(2500, 5000);
      const foodBase  = randInt(300, 700);
      const sightBase = randInt(100, 300);
      const nights    = Math.max(1, duration - 1);
      const totalHotelCost = hotelBase * nights;
      const totalFoodCost  = foodBase * initialParticipants * 2 * duration;
      const totalSights    = Math.min(geoSights.length, duration * 2);
      const totalSightCost = sightBase * initialParticipants * totalSights;
      const estimatedTotalCost = totalHotelCost + totalFoodCost + totalSightCost;

      const itinerary = [];
      let si = 0, ri = 0;
      const pickedHotel       = hotelsList[0] || { name: "City Hotel", lat: 0, lng: 0, address: "" };
      const pickedHotelCoords = { lat: pickedHotel.lat, lng: pickedHotel.lng };

      for (let d = 1; d <= duration; d++) {
        const acts = [];
        for (let i = 0; i < 2; i++) {
          const s = sightsList[si % (sightsList.length || 1)] || { name: "Local Spot", lat, lng: lon, address: "" };
          si++;
          acts.push({ type: "sight", name: s.name, cost: sightBase * initialParticipants, lat: s.lat, lng: s.lng });
        }
        for (let i = 0; i < 2; i++) {
          const r = restaurantsList[ri % (restaurantsList.length || 1)] || { name: "Local Eatery", lat, lng: lon, address: "" };
          ri++;
          acts.push({ type: "food", name: r.name, cost: foodBase * initialParticipants, lat: r.lat, lng: r.lng });
        }
        itinerary.push({
          day: d,
          hotel: { name: pickedHotel.name, cost: d === 1 ? totalHotelCost : 0, lat: pickedHotelCoords.lat, lng: pickedHotelCoords.lng },
          activities: acts,
        });
      }
      generatedItinerary = {
        tripSummary:     { title: `${city} Custom Getaway`, description: `A vacation to ${city} for ${duration} days.` },
        budgetBreakdown: { estimatedTotalCost, hotelCost: totalHotelCost, foodCost: totalFoodCost, sightCost: totalSightCost },
        itinerary,
      };
    }

    // 5. Format itinerary and enrich with websiteUrl from the lookup tables
    const hotelLookup      = Object.fromEntries(hotelsList.map(h => [h.name, h]));
    const sightLookup      = Object.fromEntries(sightsList.map(s => [s.name, s]));
    const restaurantLookup = Object.fromEntries(restaurantsList.map(r => [r.name, r]));

    const formattedItinerary = generatedItinerary.itinerary.map(dayItem => {
      const dayHotel = dayItem.hotel || {};
      const hotelInfo   = hotelLookup[dayHotel.name] || {};
      const hotelPrompt = `luxury hotel room ${dayHotel.name || "Hotel"} in ${city}, interior design`;
      const hotelImage  = `https://image.pollinations.ai/prompt/${encodeURIComponent(hotelPrompt)}?width=800&height=600&nologo=true`;

      const dayActivities = (dayItem.activities || []).map(act => {
        const lookup = act.type === "food" ? restaurantLookup : sightLookup;
        const info   = lookup[act.name] || {};
        const prompt = `${act.type === "food" ? "delicious meals" : "beautiful view"} at ${act.name} in ${city}, travel photography, 4k`;
        return {
          type:       act.type || "sight",
          name:       act.name,
          cost:       Number(act.cost || 0),
          image:      `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=800&height=600&nologo=true`,
          address:    info.address || "",
          websiteUrl: info.websiteUrl || "",
          placeId:    info.placeId  || "",
          coords: {
            lat: Number(act.lat || info.lat || lat),
            lng: Number(act.lng || info.lng || lon),
          },
        };
      });

      return {
        day: dayItem.day,
        activities: dayActivities,
        hotel: {
          name:       dayHotel.name || "City Accommodation",
          cost:       Number(dayHotel.cost || 0),
          image:      dayHotel.image || hotelImage,
          address:    hotelInfo.address    || "",
          websiteUrl: hotelInfo.websiteUrl || "",
          placeId:    hotelInfo.placeId    || "",
          coords: {
            lat: Number(dayHotel.lat || hotelInfo.lat || lat),
            lng: Number(dayHotel.lng || hotelInfo.lng || lon),
          },
        },
      };
    });

    // 6. Build flat locations array (deduplicated by name+coords)
    const locationsSeen = new Set();
    const locations = [];
    formattedItinerary.forEach(day => {
      day.activities.forEach(act => {
        const key = `${act.name}|${act.coords.lat}|${act.coords.lng}`;
        if (!locationsSeen.has(key) && act.coords.lat && act.coords.lng) {
          locationsSeen.add(key);
          locations.push({
            placeId:    act.placeId,
            name:       act.name,
            lat:        act.coords.lat,
            lng:        act.coords.lng,
            cost:       act.cost,
            type:       act.type === "food" ? "restaurant" : "attraction",
            address:    act.address,
            websiteUrl: act.websiteUrl,
            day:        day.day,
          });
        }
      });
      if (day.hotel && day.hotel.name) {
        const key = `${day.hotel.name}|${day.hotel.coords.lat}|${day.hotel.coords.lng}`;
        if (!locationsSeen.has(key) && day.hotel.coords.lat && day.hotel.coords.lng) {
          locationsSeen.add(key);
          locations.push({
            placeId:    day.hotel.placeId,
            name:       day.hotel.name,
            lat:        day.hotel.coords.lat,
            lng:        day.hotel.coords.lng,
            cost:       day.hotel.cost,
            type:       "hotel",
            address:    day.hotel.address,
            websiteUrl: day.hotel.websiteUrl,
            day:        day.day,
          });
        }
      }
    });

    const bd       = generatedItinerary.budgetBreakdown || {};
    const finalEst = Number(bd.estimatedTotalCost) || (Number(bd.hotelCost || 0) + Number(bd.foodCost || 0) + Number(bd.sightCost || 0));
    const status   = finalEst <= userBudget ? "Within Budget" : "Over Budget";

    // 7. Resolve owner profile from MongoDB
    const ownerUser = await User.findOne({ uid: userId }).lean();

    const newTrip = await Trip.create({
      userId,
      tripName: generatedItinerary.tripSummary?.title || `${city} Trip`,
      city,
      days:     duration,
      budget:   userBudget,
      participants: [{
        userId:   userId,
        name:     ownerUser?.name  || userName,
        email:    ownerUser?.email || userEmail,
        photoURL: ownerUser?.photoURL || userPhoto,
        role:     "owner",
        status:   "accepted",
        joinedAt: new Date(),
      }],
      locations,
      itinerary: formattedItinerary,
      budgetBreakdown: {
        userBudget,
        estimatedTotalCost: finalEst,
        status,
        hotelCost: Number(bd.hotelCost || 0),
        foodCost:  Number(bd.foodCost  || 0),
        sightCost: Number(bd.sightCost || 0),
      },
    });

    res.status(201).json({ success: true, savedTripId: newTrip._id, trip: newTrip });

  } catch (err) {
    console.error("❌ Generate Trip Controller Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// --- 3. UPDATE TRIP (AUTHENTICATED) ---
export const updateTrip = async (req, res) => {
  try {
    const { id }    = req.params;
    const userId    = req.user.uid;
    const { tripName, budget, itinerary, locations, budgetBreakdown, participants } = req.body;

    const trip = await Trip.findById(id);
    if (!trip)                return res.status(404).json({ success: false, error: "Trip not found" });

    const isOwner  = trip.userId === userId;
    const isMember = trip.participants?.some(m => m.userId === userId && m.status === "accepted");
    if (!isOwner && !isMember) {
      return res.status(403).json({ success: false, error: "Forbidden: You do not have access to this trip" });
    }

    if (tripName)                      trip.tripName     = tripName;
    if (budget !== undefined)          trip.budget       = Number(budget);
    if (itinerary)                     trip.itinerary    = itinerary;
    if (locations)                     trip.locations    = locations;
    if (budgetBreakdown)               trip.budgetBreakdown = budgetBreakdown;
    // Only owner can update participants directly via this route
    if (participants && isOwner)       trip.participants = participants;

    await trip.save();
    res.json({ success: true, message: "Trip updated successfully", trip });
  } catch (err) {
    console.error("❌ Update Trip Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// --- 4. DELETE TRIP (OWNER ONLY) ---
export const deleteTrip = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;

    const trip = await Trip.findById(id);
    if (!trip) return res.status(404).json({ success: false, error: "Trip not found" });

    if (trip.userId !== userId) {
      return res.status(403).json({ success: false, error: "Forbidden: Only the trip owner can delete this trip" });
    }

    await Trip.findByIdAndDelete(id);
    res.json({ success: true, message: "Trip deleted successfully" });
  } catch (err) {
    console.error("❌ Delete Trip Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// --- 5. CLEAR ALL TRIPS ---
export const clearAllTrips = async (req, res) => {
  try {
    const userId = req.user.uid;
    await Trip.deleteMany({ userId });
    res.json({ success: true, message: "💥 All your trips have been deleted!" });
  } catch (err) {
    console.error("❌ Clear Trips Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};