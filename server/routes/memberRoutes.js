import express from "express";
import { verifyToken } from "../middleware/auth.js";
import {
  inviteMember,
  listMembers,
  removeMember,
  listInvitations,
  acceptInvitation,
  declineInvitation,
} from "../controllers/memberController.js";

const router = express.Router();

// Trip-scoped member management
router.post(  "/trips/:tripId/members",              verifyToken, inviteMember);
router.get(   "/trips/:tripId/members",              verifyToken, listMembers);
router.delete("/trips/:tripId/members/:targetUserId", verifyToken, removeMember);

// Invitation center (global, for the authenticated user)
router.get( "/invitations",               verifyToken, listInvitations);
router.post("/invitations/:tripId/accept",  verifyToken, acceptInvitation);
router.post("/invitations/:tripId/decline", verifyToken, declineInvitation);

export default router;
