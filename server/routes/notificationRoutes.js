import express from "express";
import { getNotifications, markRead, markAllRead } from "../controllers/notificationController.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.get("/",              verifyToken, getNotifications);
router.patch("/read-all",    verifyToken, markAllRead);
router.patch("/:id/read",   verifyToken, markRead);

export default router;
