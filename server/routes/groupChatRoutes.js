import express from "express";
import { getMessages, sendMessage, clearMessages } from "../controllers/groupChatController.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.get(   "/:tripId", verifyToken, getMessages);
router.post(  "/:tripId", verifyToken, sendMessage);
router.delete("/:tripId", verifyToken, clearMessages);

export default router;
