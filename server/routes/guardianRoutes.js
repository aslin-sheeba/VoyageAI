import express from "express";
import { fetchPlacesByCategory } from "../services/geoapifyService.js";
import { verifyToken } from "../middleware/auth.js";
import LocationShare from "../models/LocationShare.js";
import Trip from "../models/Trip.js";
import { connectDB } from "../db.js";

const router = express.Router();

// ── GET /api/guardian/nearby?lat=..&lng=..&type=hospital ──────────────────────
router.get("/nearby", verifyToken, async (req, res) => {
  try {
    const lat  = Number(req.query.lat);
    const lng  = Number(req.query.lng);
    const type = (req.query.type || "hospital").toLowerCase();

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ success: false, error: "Invalid lat/lng parameters" });
    }

    const categoryMap = {
      hospital: "healthcare.hospital",
      police:   "service.police",
      fire:     "service.fire_station",
    };

    const categories = categoryMap[type] || categoryMap.hospital;
    const results    = await fetchPlacesByCategory({ lat, lon: lng, categories, limit: 10, radiusM: 5000 });

    res.json({ ok: true, type, results });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── POST /api/guardian/share-location ─────────────────────────────────────────
// Upserts the authenticated user's latest GPS coordinates.
// The LocationShare model has a 24-hour TTL, so stale records are removed
// automatically by MongoDB without any extra cleanup code needed.
router.post("/share-location", verifyToken, async (req, res) => {
  try {
    await connectDB();
    const userId = req.user.uid;
    const { lat, lng } = req.body;

    if (typeof lat !== "number" || typeof lng !== "number") {
      return res.status(400).json({ success: false, error: "lat and lng are required numbers" });
    }

    await LocationShare.findOneAndUpdate(
      { userId },
      { lat, lng, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    res.json({ ok: true, message: "Location updated" });
  } catch (err) {
    console.error("share-location error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/guardian/sos ────────────────────────────────────────────────────
// Dispatches an emergency SMS to all trip co-members using Twilio.
// If TWILIO_* env vars are not configured, it logs the SOS and returns a warning.
router.post("/sos", verifyToken, async (req, res) => {
  try {
    await connectDB();
    const userId = req.user.uid;
    const email  = req.user.email || "";
    const { lat, lng, tripId } = req.body;

    if (isNaN(Number(lat)) || isNaN(Number(lng))) {
      return res.status(400).json({ success: false, error: "lat and lng are required" });
    }

    const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;

    // Try to build recipient list from the active trip
    let recipients = [];
    if (tripId) {
      const trip = await Trip.findById(tripId).lean();
      if (trip) {
        // Notify all accepted participants except the sender
        recipients = (trip.participants || [])
          .filter((p) => p.status === "accepted" && p.userId !== userId && p.email)
          .map((p) => p.email);
      }
    }

    const senderName = req.user.name || email || "A VoyageAI traveler";
    const sosMessage = `🚨 EMERGENCY SOS from ${senderName}! They need help at: ${mapsUrl}`;

    // ── Twilio SMS dispatch ───────────────────────────────────────────────────
    const {
      TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN,
      TWILIO_PHONE_NUMBER,
    } = process.env;

    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
      const twilio = (await import("twilio")).default;
      const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

      // NOTE: In production the recipient list should be registered phone numbers,
      // not email addresses. This implementation is a placeholder that sends to any
      // phone numbers stored on trip participants.
      const phoneRecipients = (await Trip.findById(tripId).lean())?.participants
        ?.filter((p) => p.status === "accepted" && p.userId !== userId && p.phone)
        ?.map((p) => p.phone) || [];

      await Promise.allSettled(
        phoneRecipients.map((phone) =>
          client.messages.create({
            body: sosMessage,
            from: TWILIO_PHONE_NUMBER,
            to: phone,
          })
        )
      );

      console.log(`🚨 SOS dispatched by ${senderName} at ${mapsUrl} — ${phoneRecipients.length} SMS sent.`);
    } else {
      // Twilio not configured — log for debugging
      console.warn("⚠️  Twilio not configured. SOS logged but SMS not sent.");
      console.log(`🚨 SOS EVENT | user: ${userId} | location: ${mapsUrl}`);
    }

    res.json({
      ok: true,
      message: "SOS alert dispatched",
      mapsUrl,
      recipientCount: recipients.length,
      twilioEnabled: !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN),
    });
  } catch (err) {
    console.error("sos error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
