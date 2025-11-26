import express from "express";
import fetch from "node-fetch";

const router = express.Router();

const {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_REDIRECT_URI,
  FRONTEND_ORIGIN = "https://panel.groupify.gg",
} = process.env;

// Ping route (optional)
router.get("/ping", (req, res) => {
  res.json({ ok: true, message: "discord auth router live" });
});

// STEP 1: frontend calls this to start login
router.get("/login", (req, res) => {
  if (!DISCORD_CLIENT_ID || !DISCORD_REDIRECT_URI) {
    console.error("Missing DISCORD_CLIENT_ID or DISCORD_REDIRECT_URI");
    return res
      .status(500)
      .json({ error: "Discord OAuth not configured on server" });
  }

  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: "code",
    scope: "identify guilds",
    prompt: "consent",
  });

  const url = `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  return res.json({ url });
});

// STEP 2: Discord redirects back with ?code=
router.get("/callback", async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.status(400).send("Missing ?code from Discord");
  }

  try {
    const body = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: DISCORD_REDIRECT_URI,
    });

    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error("Discord token error:", tokenData);
      return res
        .status(500)
        .send(`Token exchange failed: ${JSON.stringify(tokenData)}`);
    }

    // stash tokens in session for /api/guilds to use
    req.session.discordToken = tokenData;

    console.log("✅ Discord callback OK, sessionID:", req.sessionID);
    console.log("✅ Discord token stored:", {
      access_token: tokenData.access_token,
      token_type: tokenData.token_type,
      expires_in: tokenData.expires_in,
    });

    // ensure session is saved before redirecting to panel
    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
      }
      return res.redirect(FRONTEND_ORIGIN + "/");
    });
  } catch (err) {
    console.error("Discord callback error:", err);
    return res.status(500).send("Internal error handling Discord callback");
  }
});

export default router;
