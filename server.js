import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fetch from 'node-fetch';

// ⬇️ DB pieces
import { connectDB } from './db.js';
import dbGuildRoutes from './routes/db.guilds.js';

const app = express();
const {
  PORT = 4005,
  SESSION_SECRET = 'changeme',
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_REDIRECT_URI,
  FRONTEND_ORIGIN = 'https://panel.groupify.gg',
  MONGO_URI
} = process.env;

app.set('trust proxy', 1);

app.use(cookieParser());
app.use(express.json());
app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));

app.use(session({
  name: 'gfy.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: true, // behind nginx + https
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

// 🔌 Connect Mongo early (non-blocking)
connectDB(MONGO_URI).catch(err => {
  console.error('Mongo connect failed:', err.message);
});

const DISCORD_OAUTH_AUTHORIZE = 'https://discord.com/api/oauth2/authorize';
const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';
const DISCORD_API = 'https://discord.com/api/v10';

function requireAuth(req, res, next) {
  if (req.session?.discord) return next();
  return res.status(401).json({ error: 'unauthorized' });
}

function oauthUrl() {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds'
  });
  return `${DISCORD_OAUTH_AUTHORIZE}?${params.toString()}`;
}

function botInviteUrl({ guild_id }) {
  const permissions = '268815424';
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    permissions,
    scope: 'bot applications.commands',
    guild_id,
    disable_guild_select: 'true'
  });
  return `${DISCORD_OAUTH_AUTHORIZE}?${params.toString()}`;
}

app.get('/api/health', (_, res) => res.json({ ok: true }));

// 💾 DB routes (persist settings, bot install flag, etc.)
app.use('/api/db/guilds', dbGuildRoutes);

app.get('/api/auth/discord/login', (_, res) => res.json({ url: oauthUrl() }));

app.get('/api/auth/discord/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing code');

  const body = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    client_secret: DISCORD_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: DISCORD_REDIRECT_URI
  });

  const tokenResp = await fetch(DISCORD_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!tokenResp.ok) {
    const txt = await tokenResp.text();
    return res.status(400).send(`Token exchange failed: ${txt}`);
  }

  const token = await tokenResp.json();

  const meResp = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${token.access_token}` }
  });
  const me = await meResp.json();

  const gResp = await fetch(`${DISCORD_API}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${token.access_token}` }
  });
  const guilds = await gResp.json();

  req.session.discord = {
    me,
    guilds,
    token: {
      access_token: token.access_token,
      token_type: token.token_type,
      scope: token.scope,
      expires_in: Date.now() + token.expires_in * 1000,
      refresh_token: token.refresh_token
    }
  };

  // ⬇️ Your SPA route (you currently use /guilds)
  res.redirect('/guilds');
});

app.post('/api/auth/logout', (req, res) =>
  req.session.destroy(() => res.json({ ok: true }))
);

app.get('/api/me', requireAuth, (req, res) => res.json(req.session.discord.me));

app.get('/api/guilds', requireAuth, (req, res) => {
  const guilds = (req.session.discord.guilds || []).filter(g => {
    try {
      const p = BigInt(g.permissions);
      return (p & 0x20n) || (p & 0x8n); // MANAGE_GUILD or ADMIN
    } catch {
      return false;
    }
  });
  res.json(guilds);
});

app.get('/api/guilds/:guildId/invite', requireAuth, (req, res) => {
  res.json({ url: botInviteUrl({ guild_id: req.params.guildId }) });
});

app.listen(PORT, () =>
  console.log(`✅ Groupify API (session mode) running on ${PORT}`)
);
