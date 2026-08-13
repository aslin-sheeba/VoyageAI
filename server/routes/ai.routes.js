import express from "express";
import { chatAI } from "../controllers/ai.controller.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.post("/chat", verifyToken, chatAI);

export default router;