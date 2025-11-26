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

const app = express();

const {
  PORT = 4005,
  SESSION_SECRET = "changeme",
  FRONTEND_ORIGIN = "https://panel.groupify.gg",
  DISCORD_CLIENT_ID,
  DISCORD_REDIRECT_URI,
} = process.env;

console.log("Server boot MONGO_URI:", process.env.MONGO_URI);

// trust proxy for correct IPs / headers behind nginx
app.set("trust proxy", 1);

// connect to Mongo (non-fatal if MONGO_URI missing, per db.js)
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

// session middleware
app.use(
  session({
    name: "gfy.sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      // host-only cookie for panel.groupify.gg (NO domain here)
      path: "/",
      sameSite: "lax",
      secure: false, // fine while debugging; can flip to true later
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);

// ----------------------
// Health check
// ----------------------
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// ----------------------
// Routes
// ----------------------
app.use("/api/auth/discord", discordAuthRoutes);
app.use("/api/db/guilds", dbGuildRoutes);

// ----------------------
// /api/guilds – list user's Discord servers
// ----------------------
// ----------------------
// /api/guilds – list user's Discord servers (admin/manage only)
// ----------------------
app.get("/api/guilds", async (req, res) => {
  console.log("📥 GET /api/guilds, sessionID:", req.sessionID);
  console.log("📥 Raw Cookie header:", req.headers.cookie);
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

    const rawGuilds = await r.json();

    // Permissions are a string; use BigInt for safety
    const ADMIN = 1n << 3n;        // 0x00000008
    const MANAGE_GUILD = 1n << 5n; // 0x00000020
    const ADMIN_LIKE = ADMIN | MANAGE_GUILD;

    const guilds = rawGuilds.filter((g) => {
      if (!g.permissions) return false;
      try {
        const perms = BigInt(g.permissions);
        return (perms & ADMIN_LIKE) !== 0n;
      } catch {
        return false;
      }
    });

    return res.json(guilds);
  } catch (err) {
    console.error("Guilds endpoint error", err);
    return res.status(500).json({ error: "Internal error fetching guilds" });
  }
});


// ----------------------
// /api/guilds/:guildId/invite – generate bot invite url
// ----------------------
app.get("/api/guilds/:guildId/invite", (req, res) => {
  const { guildId } = req.params;

  if (!DISCORD_CLIENT_ID) {
    return res.status(500).json({ error: "DISCORD_CLIENT_ID not configured" });
  }

  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    scope: "bot applications.commands",
    permissions: "8", // adjust later
    guild_id: guildId,
    response_type: "code",
    redirect_uri: DISCORD_REDIRECT_URI || "",
  });

  const url = `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  return res.json({ url });
});

// ----------------------
// 404 fallback
// ----------------------
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ----------------------
// Start server
// ----------------------
app.listen(PORT, () => {
  console.log(`✅ Groupify API (session mode) running on ${PORT}`);
});
