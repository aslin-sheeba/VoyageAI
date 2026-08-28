/**
 * server.js — VoyageAI Express + Socket.io server
 *
 * ═══════════════════════════════════════════════════════════════
 * HOW SOCKET.IO IS WIRED (for reference):
 *
 *  1. We wrap Express in Node's http.createServer() so that both
 *     HTTP routes AND WebSocket upgrades share the same TCP port.
 *
 *  2. socket.io attaches to that HTTP server (not Express directly).
 *
 *  3. The Socket.io instance is stored in socketManager.js via setIO()
 *     so any controller can call getIO() without circular imports.
 *
 *  4. On each socket connection the client must send a Firebase ID
 *     token in the handshake auth: { token: "<firebase-id-token>" }.
 *     The server verifies it with firebase-admin before allowing any
 *     further events.
 *
 *  5. Rooms:
 *       "trip:<tripId>"  — everyone in a trip (group chat, activities)
 *       "user:<uid>"     — personal notifications
 *
 *  6. Events emitted BY the server:
 *       "group_message"  — new group chat message
 *       "notification"   — personal notification
 *       "activity"       — trip activity feed update
 *
 *  CLIENT-SIDE WIRING (in GroupChatModal.jsx / App.jsx):
 *       import { io } from "socket.io-client";
 *       const socket = io(VITE_API_BASE_URL, {
 *         auth: { token: await user.getIdToken() }
 *       });
 *       socket.emit("join_trip", tripId);
 *       socket.on("group_message", (msg) => { ... });
 * ═══════════════════════════════════════════════════════════════
 */

import http    from "http";
import express from "express";
import cors    from "cors";
import dotenv  from "dotenv";
import path    from "path";
import { fileURLToPath } from "url";
import { Server as SocketIOServer } from "socket.io";
import admin   from "firebase-admin";

// Routes
import tripRoutes        from "./routes/tripRoutes.js";
import aiRoutes          from "./routes/ai.routes.js";
import placeRoutes       from "./routes/placeRoutes.js";
import guardianRoutes    from "./routes/guardianRoutes.js";
import userRoutes        from "./routes/userRoutes.js";
import expenseRoutes     from "./routes/expenseRoutes.js";
import memberRoutes      from "./routes/memberRoutes.js";
import settlementRoutes  from "./routes/settlementRoutes.js";
import groupChatRoutes   from "./routes/groupChatRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import activityRoutes    from "./routes/activityRoutes.js";

// Socket manager
import { setIO } from "./services/socketManager.js";
import Trip from "./models/Trip.js";
import { connectDB } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

/* ─── Express app ───────────────────────────────────────────── */
const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

/* ─── HTTP server (wraps Express so Socket.io can share port) ── */
const httpServer = http.createServer(app);

/* ─── Socket.io setup ───────────────────────────────────────── */
const io = new SocketIOServer(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ["websocket", "polling"],
});

// Make io available to all controllers via the singleton
setIO(io);

/* ── Socket.io auth middleware ──────────────────────────────── */
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication token missing"));

    const decoded = await admin.auth().verifyIdToken(token);
    socket.uid   = decoded.uid;
    socket.email = decoded.email || "";
    socket.name  = decoded.name  || decoded.displayName || "Traveler";
    next();
  } catch (err) {
    console.warn("Socket auth failed:", err.message);
    next(new Error("Authentication failed"));
  }
});

/* ── Socket.io connection handler ───────────────────────────── */
io.on("connection", (socket) => {
  console.log(`🔌 Socket connected: ${socket.uid}`);

  // Each authenticated user joins their personal room for notifications
  socket.join(`user:${socket.uid}`);

  /* join_trip — client calls this after opening a trip */
  socket.on("join_trip", async (tripId) => {
    try {
      await connectDB();
      const trip = await Trip.findById(tripId).lean();
      if (!trip) return;

      // Verify membership server-side — NEVER trust the client
      const isOwner  = trip.userId === socket.uid;
      const isMember = (trip.participants || []).some(
        p => p.userId === socket.uid && p.status === "accepted"
      );

      if (isOwner || isMember) {
        socket.join(`trip:${tripId}`);
        console.log(`   → ${socket.uid} joined trip room: ${tripId}`);
      } else {
        socket.emit("error", { message: "You are not a member of this trip" });
      }
    } catch (err) {
      console.error("join_trip error:", err.message);
    }
  });

  /* leave_trip — client calls this when navigating away */
  socket.on("leave_trip", (tripId) => {
    socket.leave(`trip:${tripId}`);
  });

  socket.on("disconnect", () => {
    console.log(`🔌 Socket disconnected: ${socket.uid}`);
  });
});

/* ─── HTTP Routes ───────────────────────────────────────────── */
app.use("/api/trips",         tripRoutes);
app.use("/api/ai",            aiRoutes);
app.use("/api/places",        placeRoutes);
app.use("/api/guardian",      guardianRoutes);
app.use("/api/users",         userRoutes);
app.use("/api/expenses",      expenseRoutes);
app.use("/api",               memberRoutes);
app.use("/api/settlements",   settlementRoutes);
app.use("/api/group-chat",    groupChatRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/activity",      activityRoutes);

/* Health check */
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, message: "VoyageAI backend is running", socketio: true });
});

/* ─── Export for Vercel (serverless — Socket.io won't work in serverless) ── */
export default app;

/* ─── Local dev server ──────────────────────────────────────── */
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5000;
  // Use httpServer (not app.listen) so Socket.io gets the upgrade events
  httpServer.listen(PORT, () => {
    console.log(`🚀 VoyageAI server running at http://localhost:${PORT}`);
    console.log(`🔌 Socket.io ready on ws://localhost:${PORT}`);
  });
}