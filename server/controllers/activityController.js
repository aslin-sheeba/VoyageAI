import ActivityLog from "../models/ActivityLog.js";
import Trip        from "../models/Trip.js";
import { connectDB } from "../db.js";

/* ─── GET /api/activity/:tripId ──────────────────────────── */
export const getActivityLog = async (req, res) => {
  try {
    await connectDB();
    const { tripId } = req.params;
    const userId = req.user.uid;
    const { category } = req.query; // optional filter

    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ success: false, error: "Trip not found" });

    const isOwner  = trip.userId === userId;
    const isMember = trip.participants?.some(p => p.userId === userId && p.status === "accepted");
    if (!isOwner && !isMember) return res.status(403).json({ success: false, error: "Forbidden" });

    const query = { tripId };
    if (category && category !== "all") query.category = category;

    const logs = await ActivityLog.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
