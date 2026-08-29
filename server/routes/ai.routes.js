import express from "express";
import { chatAI, getChatHistory, clearChatHistory } from "../controllers/ai.controller.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// Send a message to the AI assistant
router.post("/chat", verifyToken, chatAI);

// Fetch persisted chat history for a trip
router.get("/chat/:tripId", verifyToken, getChatHistory);

// Clear AI chat history for a trip
router.delete("/chat/:tripId", verifyToken, clearChatHistory);

export default router;