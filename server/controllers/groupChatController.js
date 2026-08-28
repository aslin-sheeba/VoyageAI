import GroupMessage from "../models/GroupMessage.js";
import Trip         from "../models/Trip.js";
import { connectDB } from "../db.js";
import { getIO } from "../services/socketManager.js";

/* Verify the user is an accepted member of the trip */
const checkMembership = async (tripId, userId) => {
  const trip = await Trip.findById(tripId);
  if (!trip) throw new Error("Trip not found");
  const isOwner  = trip.userId === userId;
  const isMember = trip.participants?.some(p => p.userId === userId && p.status === "accepted");
  if (!isOwner && !isMember) throw new Error("Forbidden: You are not a member of this trip");
  return trip;
};

/* ─── GET /api/group-chat/:tripId ─────────────────────────── */
export const getMessages = async (req, res) => {
  try {
    await connectDB();
    const { tripId } = req.params;
    const userId = req.user.uid;

    try { await checkMembership(tripId, userId); }
    catch (err) { return res.status(err.message.includes("Forbidden") ? 403 : 404).json({ success: false, error: err.message }); }

    const limit = Math.min(Number(req.query.limit) || 100, 200);
    const messages = await GroupMessage.find({ tripId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({ success: true, messages: messages.reverse() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ─── POST /api/group-chat/:tripId ────────────────────────── */
export const sendMessage = async (req, res) => {
  try {
    await connectDB();
    const { tripId } = req.params;
    const userId = req.user.uid;
    const { message } = req.body;

    if (!message?.trim()) return res.status(400).json({ success: false, error: "Message cannot be empty" });
    if (message.length > 2000) return res.status(400).json({ success: false, error: "Message is too long (max 2000 chars)" });

    let trip;
    try { trip = await checkMembership(tripId, userId); }
    catch (err) { return res.status(err.message.includes("Forbidden") ? 403 : 404).json({ success: false, error: err.message }); }

    const member = (trip.participants || []).find(p => p.userId === userId);

    const msg = await GroupMessage.create({
      tripId,
      senderId:    userId,
      senderName:  member?.name || req.user.displayName || "Traveler",
      senderPhoto: member?.photoURL || req.user.picture || "",
      message:     message.trim(),
    });

    // Broadcast to trip room via Socket.io
    const io = getIO();
    if (io) {
      io.to(`trip:${tripId}`).emit("group_message", msg);
    }

    res.status(201).json({ success: true, message: msg });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
