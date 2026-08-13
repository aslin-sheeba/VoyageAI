import mongoose from "mongoose";

/* =========================
   MEMBER SUBDOCUMENT
   ========================= */
const memberSchema = new mongoose.Schema(
  {
    userId:   { type: String, required: true },
    name:     { type: String, default: "" },
    email:    { type: String, required: true },
    photoURL: { type: String, default: "" },
    role:     { type: String, enum: ["owner", "member"], default: "member" },
    status:   { type: String, enum: ["invited", "accepted", "declined"], default: "invited" },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

/* =========================
   LOCATION (Map Pins)
   ========================= */
const locationSchema = new mongoose.Schema(
  {
    placeId:    { type: String, default: "" },   // Geoapify place_id
    name:       { type: String, required: true },
    lat:        { type: Number, required: true },
    lng:        { type: Number, required: true },
    cost:       { type: Number, default: 0 },
    type:       { type: String, default: "other" }, // hotel | restaurant | attraction | activity | other
    category:   { type: String, default: "" },      // raw Geoapify category
    address:    { type: String, default: "" },
    websiteUrl: { type: String, default: "" },
    day:        { type: Number },
  },
  { _id: false }
);

/* =========================
   ACTIVITY (Timeline)
   ========================= */
const activitySchema = new mongoose.Schema(
  {
    type:       { type: String, required: true }, // sight | food | hotel
    name:       { type: String, required: true },
    cost:       { type: Number, default: 0 },
    image:      { type: String, default: "" },
    address:    { type: String, default: "" },
    websiteUrl: { type: String, default: "" },
    placeId:    { type: String, default: "" },
    coords: {
      lat: Number,
      lng: Number,
    },
  },
  { _id: false }
);

/* =========================
   DAY PLAN
   ========================= */
const daySchema = new mongoose.Schema(
  {
    day:        { type: Number, required: true },
    activities: { type: [activitySchema], default: [] },
    hotel: {
      name:       String,
      cost:       Number,
      image:      String,
      address:    String,
      websiteUrl: String,
      placeId:    String,
      coords: {
        lat: Number,
        lng: Number,
      },
    },
  },
  { _id: false }
);

/* =========================
   TRIP
   ========================= */
const tripSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true }, // Firebase UID of creator/owner

  tripName: { type: String, required: true },
  city:     { type: String, required: true },

  days:   { type: Number, default: 1 },
  budget: { type: Number, default: 0 },

  /* Participant list — replaces the flat `members` Number field */
  participants: { type: [memberSchema], default: [] },

  /* 🔴 Used by MapCanvas */
  locations: { type: [locationSchema], default: [] },

  /* 🟢 Used by Timeline (day-wise plan) */
  itinerary: { type: [daySchema], default: [] },

  /* 💰 Used by Budget Bar */
  budgetBreakdown: {
    userBudget:         Number,
    estimatedTotalCost: Number,
    status:             String, // Within Budget | Over Budget
    hotelCost:          Number,
    foodCost:           Number,
    sightCost:          Number,
  },

  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Trip", tripSchema);
