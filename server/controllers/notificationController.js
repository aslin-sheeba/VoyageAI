import Notification from "../models/Notification.js";
import { connectDB } from "../db.js";

/* ─── GET /api/notifications ──────────────────────────────── */
export const getNotifications = async (req, res) => {
  try {
    await connectDB();
    const userId = req.user.uid;
    const limit  = Math.min(Number(req.query.limit) || 50, 100);

    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const unreadCount = await Notification.countDocuments({ userId, read: false });

    res.json({ success: true, notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ─── PATCH /api/notifications/:id/read ──────────────────── */
export const markRead = async (req, res) => {
  try {
    await connectDB();
    const userId = req.user.uid;
    const { id } = req.params;

    const n = await Notification.findOne({ _id: id, userId });
    if (!n) return res.status(404).json({ success: false, error: "Notification not found" });

    n.read = true;
    await n.save();
    res.json({ success: true, notification: n });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ─── PATCH /api/notifications/read-all ─────────────────── */
export const markAllRead = async (req, res) => {
  try {
    await connectDB();
    const userId = req.user.uid;
    await Notification.updateMany({ userId, read: false }, { read: true });
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
