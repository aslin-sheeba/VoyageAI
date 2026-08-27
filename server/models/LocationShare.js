import mongoose from "mongoose";

/**
 * LocationShare — stores the most recent GPS coordinates pushed by a user
 * during a live Guardian sharing session.
 *
 * MongoDB note:
 *  - `updatedAt` carries a TTL index of 86400 seconds (24 hours).
 *    MongoDB's TTL monitor runs every 60 seconds and automatically removes
 *    documents older than 24 hours, so stale location pings are cleaned up
 *    without any application code.
 *  - The unique index on `userId` means an upsert operation will replace the
 *    previous coordinates rather than accumulate rows — one document per user.
 */
const locationShareSchema = new mongoose.Schema(
  {
    userId: {
      type: String,    // Firebase UID
      required: true,
      unique: true,    // one record per user — upserted on every ping
      index: true,
    },
    lat: {
      type: Number,
      required: true,
    },
    lng: {
      type: Number,
      required: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false, // managed manually
  }
);

// TTL index: MongoDB will auto-delete documents 24 hours after `updatedAt`
locationShareSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 86400 });

export default mongoose.model("LocationShare", locationShareSchema);
