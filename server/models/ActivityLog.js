import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
  {
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
      required: true,
      index: true,
    },
    userId: { type: String, default: "" },     // Firebase UID; empty for AI actions
    userName: { type: String, default: "" },
    userPhoto: { type: String, default: "" },
    action: { type: String, required: true },   // e.g. "added expense ₹1,500 · Food"
    category: {
      type: String,
      enum: ["member", "expense", "itinerary", "ai", "general"],
      default: "general",
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

activityLogSchema.index({ tripId: 1, createdAt: -1 });

export default mongoose.model("ActivityLog", activityLogSchema);
