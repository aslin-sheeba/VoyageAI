import express from "express";
import {
  createExpense,
  getExpensesByTrip,
  getExpenseSummary,
  updateExpense,
  deleteExpense,
} from "../controllers/expenseController.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.post("/",                          verifyToken, createExpense);
router.get("/trip/:tripId",              verifyToken, getExpensesByTrip);
router.get("/trip/:tripId/summary",      verifyToken, getExpenseSummary);
router.put("/:id",                        verifyToken, updateExpense);
router.delete("/:id",                     verifyToken, deleteExpense);

export default router;
