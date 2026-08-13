import express from "express";
import { syncUser, getProfile } from "../controllers/userController.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// Synchronize profile on login
router.post("/sync", verifyToken, syncUser);

// Retrieve profile
router.get("/profile", verifyToken, getProfile);

export default router;
