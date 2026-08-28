import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true }, // Firebase UID of recipient
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
      default: null,
    },
    type: {
      type: String,
      enum: [
        "invitation",
        "member_joined",
        "expense_added",
        "itinerary_updated",
        "place_added",
        "chat_message",
        "settlement_requested",
        "settlement_completed",
        "general",
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }, // extra context (expenseId, settleId, etc.)
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
