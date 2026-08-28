import mongoose from "mongoose";

/* Split entry for each member who shares this expense */
const splitSchema = new mongoose.Schema(
  {
    userId:     { type: String, required: true },
    name:       { type: String, default: "" },
    amount:     { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    settled:    { type: Boolean, default: false },
  },
  { _id: false }
);

const expenseSchema = new mongoose.Schema(
  {
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
      required: true,
      index: true,
    },
    /* userId = the person who logged the expense (may differ from paidBy) */
    userId: {
      type: String,
      required: true,
      index: true,
    },

    /* title replaces old 'description' — both are kept for backward compatibility */
    title: { type: String, default: "" },
    description: { type: String, default: "" }, // legacy alias

    category: {
      type: String,
      enum: ["hotel", "food", "activities", "transportation", "shopping", "other"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    notes: { type: String, default: "" },

    /* ── Splitting ────────────────────────────────────── */
    paidBy: {
      userId: { type: String, default: "" },
      name:   { type: String, default: "" },
    },
    splitType: {
      type: String,
      enum: ["equal", "custom", "percentage", "none"],
      default: "none",
    },
    splits: { type: [splitSchema], default: [] },

    /* Optional receipt image URL (for future AI OCR) */
    receiptUrl: { type: String, default: "" },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Expense", expenseSchema);
