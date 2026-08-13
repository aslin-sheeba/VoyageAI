import express from "express";
import { 
  generateTrip, 
  clearAllTrips, 
  getTripsByUser, 
  updateTrip, 
  deleteTrip 
} from "../controllers/TripController.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// 1. Generate Trip (Authenticated)
router.post("/generate", verifyToken, generateTrip);

// 2. Clear all user's trips (Authenticated)
router.delete("/clear", verifyToken, clearAllTrips);

// 3. Get currently authenticated user's trips
router.get("/", verifyToken, getTripsByUser);

// 4. Update a trip (Authenticated, ownership check inside controller)
router.put("/:id", verifyToken, updateTrip);

// 5. Delete a trip (Authenticated, ownership check inside controller)
router.delete("/:id", verifyToken, deleteTrip);

export default router;