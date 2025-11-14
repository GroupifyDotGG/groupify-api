// /var/www/groupify.gg/api/db.js
import mongoose from "mongoose";

export async function connectDB() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error("Mongo connect failed: Missing MONGO_URI (process.env.MONGO_URI is undefined)");
    return; // don't throw, just skip DB for now
  }

  try {
    console.log("Mongo connect: using URI:", uri);
    await mongoose.connect(uri);
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("Mongo connect failed:", err.message);
  }
}
