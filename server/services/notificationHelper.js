/**
 * notificationHelper.js
 * Centralised utility for creating notifications + emitting Socket.io events.
 * Import getIO() lazily to avoid circular dependency issues.
 */

import Notification from "../models/Notification.js";
import ActivityLog  from "../models/ActivityLog.js";

/**
 * Create a persistent notification for one or more users.
 * @param {Object} opts
 * @param {string|string[]} opts.userIds  - Firebase UIDs of recipients
 * @param {string} opts.tripId
 * @param {string} opts.type
 * @param {string} opts.title
 * @param {string} opts.message
 * @param {Object} [opts.metadata]
 * @param {Function} [opts.getIO] - socket.io server instance getter
 */
export async function createNotifications({ userIds, tripId, type, title, message, metadata = {}, getIO }) {
  const ids = Array.isArray(userIds) ? userIds : [userIds];
  const docs = ids
    .filter(Boolean)
    .map(userId => ({ userId, tripId: tripId || null, type, title, message, metadata }));

  if (docs.length === 0) return;

  const created = await Notification.insertMany(docs);

  // Emit real-time if socket.io is available
  if (typeof getIO === "function") {
    const io = getIO();
    if (io) {
      created.forEach(n => {
        io.to(`user:${n.userId}`).emit("notification", n);
      });
    }
  }
}

/**
 * Log an activity to the trip feed.
 */
export async function logActivity({ tripId, userId = "", userName = "", userPhoto = "", action, category = "general", metadata = {}, getIO }) {
  const log = await ActivityLog.create({ tripId, userId, userName, userPhoto, action, category, metadata });

  // Broadcast to trip room
  if (typeof getIO === "function") {
    const io = getIO();
    if (io) {
      io.to(`trip:${tripId}`).emit("activity", log);
    }
  }

  return log;
}
