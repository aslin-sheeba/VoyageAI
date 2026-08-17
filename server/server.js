import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

import tripRoutes from "./routes/tripRoutes.js";
import aiRoutes from "./routes/ai.routes.js";
import placeRoutes from "./routes/placeRoutes.js";
import guardianRoutes from "./routes/guardianRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import expenseRoutes from "./routes/expenseRoutes.js";
import memberRoutes from "./routes/memberRoutes.js";

dotenv.config();

const app = express();

/* Middleware */
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());

/* MongoDB connection */
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("MONGO_URI is not configured");
} else {
  mongoose
    .connect(MONGO_URI)
    .then(() => console.log("MongoDB Connected"))
    .catch((err) => console.error("MongoDB Error:", err.message));
}

/* Routes */
app.use("/api/trips", tripRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/places", placeRoutes);
app.use("/api/guardian", guardianRoutes);
app.use("/api/users", userRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api", memberRoutes);

/* Health check */
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    message: "VoyageAI backend is running",
  });
});

/*
 * Export Express app for Vercel
 */
export default app;

/*
 * Run local server only when executed directly.
 */
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}