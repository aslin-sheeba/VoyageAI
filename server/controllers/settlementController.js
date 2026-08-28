import Settlement from "../models/Settlement.js";
import Trip       from "../models/Trip.js";
import { connectDB } from "../db.js";
import { createNotifications, logActivity } from "../services/notificationHelper.js";
import { getIO } from "../services/socketManager.js";

const checkMembership = async (tripId, userId) => {
  const trip = await Trip.findById(tripId);
  if (!trip) throw new Error("Trip not found");
  const isOwner  = trip.userId === userId;
  const isMember = trip.participants?.some(p => p.userId === userId && p.status === "accepted");
  if (!isOwner && !isMember) throw new Error("Forbidden");
  return trip;
};

/* ─── POST /api/settlements ──────────────────────────────── */
export const createSettlement = async (req, res) => {
  try {
    await connectDB();
    const userId = req.user.uid;
    const { tripId, toUserId, toUserName, amount, note } = req.body;

    if (!tripId || !toUserId || !amount) {
      return res.status(400).json({ success: false, error: "tripId, toUserId, and amount are required" });
    }
    if (Number(amount) <= 0) {
      return res.status(400).json({ success: false, error: "Amount must be greater than 0" });
    }

    let trip;
    try { trip = await checkMembership(tripId, userId); }
    catch (err) { return res.status(err.message === "Forbidden" ? 403 : 404).json({ success: false, error: err.message }); }

    const fromMember = (trip.participants || []).find(p => p.userId === userId);
    const fromName = fromMember?.name || req.user.displayName || "Someone";

    const settlement = await Settlement.create({
      tripId,
      fromUserId: userId,
      fromUserName: fromName,
      toUserId,
      toUserName: toUserName || "",
      amount: Number(amount),
      note: note || "",
      status: "pending",
    });

    // Notify the creditor
    await createNotifications({
      userIds: [toUserId],
      tripId,
      type: "settlement_requested",
      title: "Settlement requested",
      message: `${fromName} is settling ₹${Number(amount).toLocaleString("en-IN")} with you`,
      metadata: { settlementId: settlement._id },
      getIO,
    });

    await logActivity({
      tripId, userId, userName: fromName,
      action: `requested settlement of ₹${Number(amount).toLocaleString("en-IN")} → ${toUserName}`,
      category: "expense",
      metadata: { settlementId: settlement._id },
      getIO,
    });

    res.status(201).json({ success: true, settlement });
  } catch (err) {
    console.error("createSettlement error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ─── GET /api/settlements/trip/:tripId ──────────────────── */
export const listSettlements = async (req, res) => {
  try {
    await connectDB();
    const { tripId } = req.params;
    const userId = req.user.uid;

    try { await checkMembership(tripId, userId); }
    catch (err) { return res.status(403).json({ success: false, error: err.message }); }

    const settlements = await Settlement.find({ tripId }).sort({ createdAt: -1 });
    res.json({ success: true, settlements });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ─── PATCH /api/settlements/:id/settle ─────────────────── */
export const markSettled = async (req, res) => {
  try {
    await connectDB();
    const { id } = req.params;
    const userId = req.user.uid;

    const settlement = await Settlement.findById(id);
    if (!settlement) return res.status(404).json({ success: false, error: "Settlement not found" });

    // Only from/to user or trip owner can mark as settled
    if (settlement.fromUserId !== userId && settlement.toUserId !== userId) {
      // Check if owner
      const trip = await Trip.findById(settlement.tripId);
      if (!trip || trip.userId !== userId) {
        return res.status(403).json({ success: false, error: "Forbidden: Only the involved members can mark this settled" });
      }
    }

    settlement.status    = "settled";
    settlement.settledAt = new Date();
    await settlement.save();

    // Notify the other party
    const otherUserId = settlement.fromUserId === userId ? settlement.toUserId : settlement.fromUserId;
    await createNotifications({
      userIds: [otherUserId],
      tripId: settlement.tripId,
      type: "settlement_completed",
      title: "Settlement completed",
      message: `Settlement of ₹${settlement.amount.toLocaleString("en-IN")} has been marked as settled`,
      metadata: { settlementId: settlement._id },
      getIO,
    });

    await logActivity({
      tripId: settlement.tripId, userId,
      userName: settlement.fromUserId === userId ? settlement.fromUserName : settlement.toUserName,
      action: `marked ₹${settlement.amount.toLocaleString("en-IN")} settlement as complete`,
      category: "expense",
      getIO,
    });

    res.json({ success: true, settlement });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
