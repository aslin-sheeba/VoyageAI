import { askGemini } from "../services/gemini.service.js";
import Trip from "../models/Trip.js";
import axios from "axios";
import { connectDB } from "../db.js";

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

function extractPlaceData(feature) {
  if (!feature) return null;
  const p      = feature.properties || {};
  const coords = getCoords(feature);
  return {
    placeId:    p.place_id || "",
    name:       p.name    || "",
    address:    p.formatted || "",
    lat:        coords.lat,
    lng:        coords.lng,
    websiteUrl: p.website || p.contact?.website || "",
  };
}

/** Rebuild the flat locations array from the full itinerary (includes websiteUrl, address, placeId) */
function rebuildLocations(itinerary) {
  const seen = new Set();
  const locations = [];
  itinerary.forEach(day => {
    day.activities.forEach(act => {
      const key = `${act.name}|${act.coords?.lat}|${act.coords?.lng}`;
      if (!seen.has(key)) {
        seen.add(key);
        locations.push({
          placeId:    act.placeId    || "",
          name:       act.name,
          lat:        act.coords?.lat || 0,
          lng:        act.coords?.lng || 0,
          cost:       act.cost       || 0,
          type:       act.type === "food" ? "restaurant" : "attraction",
          address:    act.address    || "",
          websiteUrl: act.websiteUrl || "",
          day:        day.day,
        });
      }
    });
    if (day.hotel && day.hotel.name) {
      const key = `${day.hotel.name}|${day.hotel.coords?.lat}|${day.hotel.coords?.lng}`;
      if (!seen.has(key)) {
        seen.add(key);
        locations.push({
          placeId:    day.hotel.placeId    || "",
          name:       day.hotel.name,
          lat:        day.hotel.coords?.lat || 0,
          lng:        day.hotel.coords?.lng || 0,
          cost:       day.hotel.cost       || 0,
          type:       "hotel",
          address:    day.hotel.address    || "",
          websiteUrl: day.hotel.websiteUrl || "",
          day:        day.day,
        });
      }
    }
  });
  return locations;
}

export async function chatAI(req, res) {
  try {
    await connectDB();
    const { message, tripId } = req.body;
    const userId = req.user.uid;

    if (!message) return res.status(400).json({ success: false, error: "Message is required" });

    let trip = null;
    if (tripId) {
      trip = await Trip.findById(tripId);
      if (trip) {
        const isOwner  = trip.userId === userId;
        const isMember = trip.participants?.some(p => p.userId === userId && p.status === "accepted");
        if (!isOwner && !isMember) {
          return res.status(403).json({ success: false, error: "Forbidden: Access denied to this trip" });
        }
      }
    }

    // Accepted participant count
    const acceptedCount = trip
      ? (trip.participants?.filter(p => p.status === "accepted").length || 1)
      : 1;

    const SYSTEM_PROMPT = `
You are VoyageAI, an agentic travel assistant.
The user is asking questions or requesting updates about their trip.

Current Trip Context:
${trip ? JSON.stringify({
  city:         trip.city,
  budget:       trip.budget,
  days:         trip.days,
  participants: acceptedCount,
  budgetPerPerson: Math.round(trip.budget / acceptedCount),
  itinerary: trip.itinerary.map(day => ({
    day:        day.day,
    hotel:      day.hotel?.name,
    activities: day.activities.map(act => act.name)
  }))
}) : "No active trip selected."}

Instructions:
Analyze the user's message. Decide if they want to update the trip parameters or modify the itinerary.
Actions: ADD_PLACE, REMOVE_PLACE, UPDATE_BUDGET, REGENERATE_DAY, or null.
- ADD_PLACE: Identify type (food | hotel | sight), the query/name, and the day (default 1).
- REMOVE_PLACE: Identify the place name and the day.
- UPDATE_BUDGET: Identify the new total budget.
- REGENERATE_DAY: Identify the day number.

Respond ONLY with a valid JSON object. No markdown formatting.

JSON Template:
{
  "reply": "Friendly response",
  "action": "ADD_PLACE | REMOVE_PLACE | UPDATE_BUDGET | REGENERATE_DAY | null",
  "payload": {}
}
`;

    let rawResponse;
    try {
      rawResponse = await askGemini(`${SYSTEM_PROMPT}\nUser Request: ${message}`);
    } catch (err) {
      console.error("❌ AI Chatbot Gemini Request Failed:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to generate AI response"
      });
    }

    let cleanJson = rawResponse.trim();
    if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.replace(/^```(json)?/, "").replace(/```$/, "").trim();
    }

    let result;
    try {
      result = JSON.parse(cleanJson);
    } catch {
      return res.status(200).json({
        success: true,
        data: {
          reply: rawResponse.replace(/[{}\[\]"]/g, ""),
          action: null
        }
      });
    }

    const { action, payload } = result;

    if (trip && action && payload) {
      console.log(`🤖 AI Action: ${action}`, payload);

      // ── ADD_PLACE ──────────────────────────────────────────────
      if (action === "ADD_PLACE" && payload.query) {
        const { type, query, day } = payload;
        const targetDay  = Number(day || 1);
        const apiKey     = process.env.GEOAPIFY_KEY;

        // Use center of existing trip locations as anchor
        const center = trip.locations.find(l => l.lat && l.lng) || { lat: 0, lng: 0 };

        let category = "tourism.sights";
        if (type === "hotel") category = "accommodation.hotel";
        if (type === "food")  category = "catering.restaurant";

        const searchUrl = `https://api.geoapify.com/v2/places?text=${encodeURIComponent(query)}&filter=circle:${center.lng},${center.lat},50000&categories=${category}&limit=3&apiKey=${apiKey}`;
        const geoRes    = await axios.get(searchUrl).catch(() => ({ data: { features: [] } }));

        // Pick first feature that has a name
        const place = (geoRes.data?.features || []).find(f => f.properties?.name);

        if (place) {
          const info = extractPlaceData(place);
          const cost = type === "hotel" ? randInt(2000, 5000) : type === "food" ? randInt(200, 600) : randInt(100, 300);
          const img  = `https://image.pollinations.ai/prompt/${encodeURIComponent(`${type === "food" ? "delicious food" : "scenic view"} at ${info.name} in ${trip.city}`)}?width=800&height=600&nologo=true`;

          // Duplicate check by placeId or name+coords
          const isDuplicate = trip.itinerary.some(d =>
            d.activities.some(a =>
              (info.placeId && a.placeId === info.placeId) ||
              (a.name === info.name && Math.abs((a.coords?.lat || 0) - info.lat) < 0.0001)
            )
          );
          if (isDuplicate) {
            result.reply += `\n\n⚠️ "${info.name}" is already in your itinerary.`;
          } else {
            const targetDayPlan = trip.itinerary.find(d => d.day === targetDay) || trip.itinerary[0];
            if (type === "hotel") {
              targetDayPlan.hotel = { name: info.name, cost, image: img, address: info.address, websiteUrl: info.websiteUrl, placeId: info.placeId, coords: { lat: info.lat, lng: info.lng } };
            } else {
              targetDayPlan.activities.push({ type: type || "sight", name: info.name, cost, image: img, address: info.address, websiteUrl: info.websiteUrl, placeId: info.placeId, coords: { lat: info.lat, lng: info.lng } });
            }

            trip.locations = rebuildLocations(trip.itinerary);
            const spent = trip.locations.reduce((s, l) => s + Number(l.cost || 0), 0);
            trip.budgetBreakdown.estimatedTotalCost = spent;
            trip.budgetBreakdown.status = spent <= trip.budget ? "Within Budget" : "Over Budget";
            await trip.save();
            result.reply += `\n\n✅ Added "${info.name}" to Day ${targetDayPlan.day}.`;
            result.updatedTrip = trip;
          }
        } else {
          result.reply += `\n\n⚠️ Could not verify the location "${query}" on the map.`;
        }
      }

      // ── REMOVE_PLACE ───────────────────────────────────────────
      else if (action === "REMOVE_PLACE" && payload.name) {
        const { name, day } = payload;
        const targetDay = Number(day);
        let removed = false;
        trip.itinerary.forEach(d => {
          if (!targetDay || d.day === targetDay) {
            const len = d.activities.length;
            d.activities = d.activities.filter(a => !a.name.toLowerCase().includes(name.toLowerCase()));
            if (d.activities.length < len) removed = true;
            if (d.hotel && d.hotel.name.toLowerCase().includes(name.toLowerCase())) {
              d.hotel = undefined;
              removed = true;
            }
          }
        });
        if (removed) {
          trip.locations = rebuildLocations(trip.itinerary);
          const spent = trip.locations.reduce((s, l) => s + Number(l.cost || 0), 0);
          trip.budgetBreakdown.estimatedTotalCost = spent;
          trip.budgetBreakdown.status = spent <= trip.budget ? "Within Budget" : "Over Budget";
          await trip.save();
          result.reply += `\n\n✅ Removed "${name}" from the itinerary.`;
          result.updatedTrip = trip;
        } else {
          result.reply += `\n\n⚠️ Could not find "${name}" in your current plan.`;
        }
      }

      // ── UPDATE_BUDGET ──────────────────────────────────────────
      else if (action === "UPDATE_BUDGET" && payload.budget) {
        const newBudget = Number(payload.budget);
        if (newBudget > 0) {
          trip.budget = newBudget;
          trip.budgetBreakdown.userBudget = newBudget;
          const spent = trip.locations.reduce((s, l) => s + Number(l.cost || 0), 0);
          trip.budgetBreakdown.status = spent <= newBudget ? "Within Budget" : "Over Budget";
          await trip.save();
          result.reply += `\n\n✅ Updated trip budget to ₹${newBudget.toLocaleString("en-IN")}.`;
          result.updatedTrip = trip;
        }
      }

      // ── REGENERATE_DAY ─────────────────────────────────────────
      else if (action === "REGENERATE_DAY" && payload.day) {
        const targetDay = Number(payload.day);
        const dayPlan   = trip.itinerary.find(d => d.day === targetDay);
        if (dayPlan) {
          const apiKey = process.env.GEOAPIFY_KEY;
          const center = trip.locations.find(l => l.lat && l.lng) || { lat: 0, lng: 0 };
          const r      = 10000;
          const [sRes, fRes] = await Promise.all([
            axios.get(`https://api.geoapify.com/v2/places?categories=tourism.sights&filter=circle:${center.lng},${center.lat},${r}&limit=5&apiKey=${apiKey}`).catch(() => ({ data: { features: [] } })),
            axios.get(`https://api.geoapify.com/v2/places?categories=catering.restaurant&filter=circle:${center.lng},${center.lat},${r}&limit=5&apiKey=${apiKey}`).catch(() => ({ data: { features: [] } })),
          ]);
          const sights = sRes.data.features || [];
          const food   = fRes.data.features || [];
          if (sights.length > 0 && food.length > 0) {
            const sInfo = extractPlaceData(sights[randInt(0, sights.length - 1)]);
            const fInfo = extractPlaceData(food[randInt(0, food.length - 1)]);
            dayPlan.activities = [
              { type: "sight", name: sInfo.name, cost: randInt(200, 500), image: `https://image.pollinations.ai/prompt/${encodeURIComponent("sight " + sInfo.name)}?width=800&height=600&nologo=true`, address: sInfo.address, websiteUrl: sInfo.websiteUrl, placeId: sInfo.placeId, coords: { lat: sInfo.lat, lng: sInfo.lng } },
              { type: "food",  name: fInfo.name, cost: randInt(300, 600), image: `https://image.pollinations.ai/prompt/${encodeURIComponent("food " + fInfo.name)}?width=800&height=600&nologo=true`,  address: fInfo.address, websiteUrl: fInfo.websiteUrl, placeId: fInfo.placeId, coords: { lat: fInfo.lat, lng: fInfo.lng } },
            ];
            trip.locations = rebuildLocations(trip.itinerary);
            const spent = trip.locations.reduce((s, l) => s + Number(l.cost || 0), 0);
            trip.budgetBreakdown.estimatedTotalCost = spent;
            trip.budgetBreakdown.status = spent <= trip.budget ? "Within Budget" : "Over Budget";
            await trip.save();
            result.reply += `\n\n✅ Regenerated plans for Day ${targetDay}.`;
            result.updatedTrip = trip;
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error("AI Controller Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to generate AI response"
    });
  }
}
