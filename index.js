// /var/www/groupify.gg/api/index.js

import "dotenv/config";
import express from "express";
import session from "express-session";
import cors from "cors";
import cookieParser from "cookie-parser";
import fetch from "node-fetch";

import { connectDB } from "./db.js";

// Load routes
import dbGuildRoutes from "./routes/db.guilds.js";
import discordAuthRoutes from "./routes/auth.discord.js";

const app = express();

const {
  PORT = 4005,
  SESSION_SECRET = "changeme",
  FRONTEND_ORIGIN = "https://panel.groupify.gg",
} = process.env;

// Trust proxy (needed behind NGINX for secure cookies)
app.set("trust proxy", 1);

// Connect DB
connectDB();

// Middleware
app.use(cookieParser());
app.use(express.json());
app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
  })
);

app.use(
  session({
    name: "gfy.sid",
    secret: SESSION_SECRET,
    saveUninitialized: false,
    resave: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: true, // because you're behind HTTPS
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);

// ---------------------------------------
// Health check
// ---------------------------------------
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// ---------------------------------------
// Routes
// ---------------------------------------
app.use("/api/db/guilds", dbGuildRoutes);
app.use("/api/auth/discord", discordAuthRoutes);

// ---------------------------------------
// 404 fallback
// ---------------------------------------
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ---------------------------------------
// Start server
// ---------------------------------------
app.listen(PORT, () => {
  console.log(`Groupify API running on port ${PORT}`);
});
