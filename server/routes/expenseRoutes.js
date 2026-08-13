import express from "express";
import { 
  createExpense, 
  getExpensesByTrip, 
  updateExpense, 
  deleteExpense 
} from "../controllers/expenseController.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// Create new expense
router.post("/", verifyToken, createExpense);

// Get expenses for a trip
router.get("/trip/:tripId", verifyToken, getExpensesByTrip);

// Update expense
router.put("/:id", verifyToken, updateExpense);

// Delete expense
router.delete("/:id", verifyToken, deleteExpense);

export default router;
