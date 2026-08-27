import mongoose from "mongoose";

/**
 * ChatMessage — persists all AI assistant conversations per trip.
 *
 * MongoDB note:
 *  - A compound index { tripId, timestamp } is created automatically so that
 *    fetching history for a trip is always fast (index scan, not collection scan).
 *  - No TTL is applied here — messages are permanent until the trip is deleted.
 *    If you want automatic cleanup, add `expireAfterSeconds` to the timestamp
 *    index (see comment below).
 */
const chatMessageSchema = new mongoose.Schema(
  {
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
      required: true,
      index: true,
    },
    senderId: {
      type: String,          // Firebase UID — empty string for AI messages
      default: "",
      index: true,
    },
    role: {
      type: String,
      enum: ["user", "ai"],
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      // To auto-delete messages older than 90 days, uncomment the next line:
      // index: { expireAfterSeconds: 7776000 }
    },
  },
  {
    timestamps: false, // we manage timestamp ourselves
  }
);

// Compound index: fetch all messages for a trip sorted by time efficiently
chatMessageSchema.index({ tripId: 1, timestamp: 1 });

export default mongoose.model("ChatMessage", chatMessageSchema);
