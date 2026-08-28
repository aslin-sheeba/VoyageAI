import express from "express";
import { createSettlement, listSettlements, markSettled } from "../controllers/settlementController.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.post("/",                      verifyToken, createSettlement);
router.get("/trip/:tripId",           verifyToken, listSettlements);
router.patch("/:id/settle",           verifyToken, markSettled);

export default router;
