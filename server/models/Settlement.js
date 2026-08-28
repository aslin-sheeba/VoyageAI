import mongoose from "mongoose";

const settlementSchema = new mongoose.Schema(
  {
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
      required: true,
      index: true,
    },
    fromUserId: { type: String, required: true },
    fromUserName: { type: String, default: "" },
    toUserId: { type: String, required: true },
    toUserName: { type: String, default: "" },
    amount: { type: Number, required: true, min: 0.01 },
    status: {
      type: String,
      enum: ["pending", "settled"],
      default: "pending",
    },
    settledAt: { type: Date },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

settlementSchema.index({ tripId: 1, status: 1 });

export default mongoose.model("Settlement", settlementSchema);
