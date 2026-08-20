import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ MONGO_URI is not configured in env");
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = {
    conn: null,
    promise: null,
  };
}

export async function connectDB() {
  if (!MONGO_URI) {
    throw new Error("MONGO_URI is not configured");
  }

  // Ready states: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    console.log("🔄 Connecting to MongoDB...");
    cached.promise = mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    }).then((m) => {
      console.log("✅ MongoDB Connected (ready state:", mongoose.connection.readyState, ")");
      return m;
    }).catch((err) => {
      console.error("❌ MongoDB Connection failed:", err.message);
      cached.promise = null;
      throw err;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}
