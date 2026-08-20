import Expense from "../models/Expense.js";
import Trip from "../models/Trip.js";
import { connectDB } from "../db.js";

// helper to verify trip ownership
const checkTripOwnership = async (tripId, userId) => {
  const trip = await Trip.findById(tripId);
  if (!trip) {
    throw new Error("Trip not found");
  }
  if (trip.userId !== userId) {
    throw new Error("Forbidden: You do not own this trip");
  }
  return trip;
};

// POST /api/expenses
export const createExpense = async (req, res) => {
  try {
    await connectDB();
    const { tripId, category, description, amount, date, notes } = req.body;
    const userId = req.user.uid;

    if (!tripId || !category || !description || amount === undefined) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    try {
      await checkTripOwnership(tripId, userId);
    } catch (err) {
      if (err.message.includes("Forbidden")) {
        return res.status(403).json({ success: false, error: err.message });
      }
      return res.status(404).json({ success: false, error: err.message });
    }

    const expense = await Expense.create({
      tripId,
      userId,
      category,
      description,
      amount: Number(amount),
      date: date || new Date(),
      notes: notes || "",
    });

    res.status(201).json({ success: true, expense });
  } catch (err) {
    console.error("Create expense error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/expenses/trip/:tripId
export const getExpensesByTrip = async (req, res) => {
  try {
    await connectDB();
    const { tripId } = req.params;
    const userId = req.user.uid;

    try {
      await checkTripOwnership(tripId, userId);
    } catch (err) {
      if (err.message.includes("Forbidden")) {
        return res.status(403).json({ success: false, error: err.message });
      }
      return res.status(404).json({ success: false, error: err.message });
    }

    const expenses = await Expense.find({ tripId }).sort({ date: -1 });
    res.json({ success: true, expenses });
  } catch (err) {
    console.error("Get expenses error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// PUT /api/expenses/:id
export const updateExpense = async (req, res) => {
  try {
    await connectDB();
    const { id } = req.params;
    const { category, description, amount, date, notes } = req.body;
    const userId = req.user.uid;

    const expense = await Expense.findById(id);
    if (!expense) {
      return res.status(404).json({ success: false, error: "Expense record not found" });
    }

    try {
      await checkTripOwnership(expense.tripId, userId);
    } catch (err) {
      return res.status(403).json({ success: false, error: "Forbidden: Access denied" });
    }

    if (category) expense.category = category;
    if (description) expense.description = description;
    if (amount !== undefined) expense.amount = Number(amount);
    if (date) expense.date = date;
    if (notes !== undefined) expense.notes = notes;

    await expense.save();

    res.json({ success: true, expense });
  } catch (err) {
    console.error("Update expense error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE /api/expenses/:id
export const deleteExpense = async (req, res) => {
  try {
    await connectDB();
    const { id } = req.params;
    const userId = req.user.uid;

    const expense = await Expense.findById(id);
    if (!expense) {
      return res.status(404).json({ success: false, error: "Expense record not found" });
    }

    try {
      await checkTripOwnership(expense.tripId, userId);
    } catch (err) {
      return res.status(403).json({ success: false, error: "Forbidden: Access denied" });
    }

    await Expense.findByIdAndDelete(id);

    res.json({ success: true, message: "Expense deleted successfully" });
  } catch (err) {
    console.error("Delete expense error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};
