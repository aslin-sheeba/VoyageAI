import express from "express";
import { getActivityLog } from "../controllers/activityController.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.get("/:tripId", verifyToken, getActivityLog);

export default router;
