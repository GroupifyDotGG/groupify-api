// /var/www/groupify.gg/api/server.js

import "dotenv/config";
import express from "express";
import session from "express-session";
import cors from "cors";
import cookieParser from "cookie-parser";
import fetch from "node-fetch";

import { connectDB } from "./db.js";
import dbGuildRoutes from "./routes/db.guilds.js";
import discordAuthRoutes from "./routes/auth.discord.js";
console.log("Server boot MONGO_URI:", process.env.MONGO_URI);

const app = express();

const {
  PORT = 4005,
  SESSION_SECRET = "changeme",
  FRONTEND_ORIGIN = "https://panel.groupify.gg",
  DISCORD_CLIENT_ID,
  DISCORD_REDIRECT_URI,
} = process.env;

// trust proxy for secure cookies behind Nginx
app.set("trust proxy", 1);

// connect DB (will warn if MONGO_URI missing)
connectDB();

// middleware
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
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: true, // HTTPS via Nginx
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);

// ---------------------------------------
// Health
// ---------------------------------------
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// ---------------------------------------
// Auth routes (we created auth.discord.js earlier)
// ---------------------------------------
app.use("/api/auth/discord", discordAuthRoutes);

// ---------------------------------------
// DB Guild config routes
// ---------------------------------------
app.use("/api/db/guilds", dbGuildRoutes);

// ---------------------------------------
// /api/guilds – list user's Discord guilds
// ---------------------------------------

app.get("/api/guilds", async (req, res) => {
  console.log("📥 GET /api/guilds, sessionID:", req.sessionID);
  console.log("📥 Session discordToken:", req.session?.discordToken);

  const token = req.session?.discordToken?.access_token;

  if (!token) {
    return res.status(401).json({ error: "Not logged in with Discord" });
  }

  try {
    const r = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!r.ok) {
      const text = await r.text();
      console.error("Discord guilds error", r.status, text);
      return res
        .status(500)
        .json({ error: "Failed to fetch guilds from Discord" });
    }

    const guilds = await r.json();
    return res.json(guilds);
  } catch (err) {
    console.error("Guilds endpoint error", err);
    return res.status(500).json({ error: "Internal error fetching guilds" });
  }
});

// ---------------------------------------
// /api/guilds/:guildId/invite – invite bot to a server
// ---------------------------------------
app.get("/api/guilds/:guildId/invite", (req, res) => {
  const { guildId } = req.params;

  if (!DISCORD_CLIENT_ID) {
    return res.status(500).json({ error: "DISCORD_CLIENT_ID not configured" });
  }

  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    scope: "bot applications.commands",
    permissions: "8", // admin-ish; tweak later
    guild_id: guildId,
    response_type: "code",
    redirect_uri: DISCORD_REDIRECT_URI || "",
  });

  const url = `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  return res.json({ url });
});

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
  console.log(`✅ Groupify API (session mode) running on ${PORT}`);
});
