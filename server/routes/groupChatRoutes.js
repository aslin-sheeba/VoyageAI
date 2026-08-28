import express from "express";
import { getMessages, sendMessage } from "../controllers/groupChatController.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.get("/:tripId",  verifyToken, getMessages);
router.post("/:tripId", verifyToken, sendMessage);

export default router;
