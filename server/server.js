import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

import tripRoutes    from "./routes/tripRoutes.js";
import aiRoutes      from "./routes/ai.routes.js";
import placeRoutes   from "./routes/placeRoutes.js";
import guardianRoutes from "./routes/guardianRoutes.js";
import userRoutes    from "./routes/userRoutes.js";
import expenseRoutes from "./routes/expenseRoutes.js";
import memberRoutes  from "./routes/memberRoutes.js";

/* 1️⃣ Load env variables FIRST */
dotenv.config();

/* 2️⃣ Initialize App */
const app = express();

/* 3️⃣ Middleware */
app.use(cors());
app.use(express.json());

/* 4️⃣ Connect MongoDB */
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/voyageai";

if (!process.env.MONGO_URI) {
  console.warn("⚠️ MONGO_URI not set — falling back to local MongoDB");
}

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ Mongo Error:", err.message));

/* 5️⃣ Routes */
app.use("/api/trips",    tripRoutes);
app.use("/api/ai",       aiRoutes);
app.use("/api/places",   placeRoutes);
app.use("/api/guardian", guardianRoutes);
app.use("/api/users",    userRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api",          memberRoutes);   // /api/trips/:id/members, /api/invitations

/* Health check */
app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "VoyageAI backend is running ✅" });
});

/* Start server */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});