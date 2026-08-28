import mongoose from "mongoose";

/**
 * GroupMessage — real-time trip group chat messages.
 * One collection shared across all trips, indexed by tripId + createdAt.
 */
const groupMessageSchema = new mongoose.Schema(
  {
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
      required: true,
      index: true,
    },
    senderId: { type: String, required: true },   // Firebase UID
    senderName: { type: String, default: "" },
    senderPhoto: { type: String, default: "" },
    message: { type: String, required: true, maxlength: 2000 },
  },
  { timestamps: true }
);

groupMessageSchema.index({ tripId: 1, createdAt: 1 });

export default mongoose.model("GroupMessage", groupMessageSchema);
