import express from "express";
import { addPlaceToTrip, discoverPlaces } from "../controllers/placeController.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// Search real locations
router.get("/discover", verifyToken, discoverPlaces);

// Add location manually to trip
router.post("/add", verifyToken, addPlaceToTrip);

export default router;
