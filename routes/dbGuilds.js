cat > /var/www/groupify.gg/api/routes/dbGuilds.js <<'EOF'
import { Router } from "express";
import Guild from "../models/Guild.js";

const r = Router();

// use the same session gate as the rest of the API
function requireAuth(req, res, next) {
  if (req.session?.discord) return next();
  return res.status(401).json({ error: "unauthorized" });
}

// GET /api/db/guilds/:guildId - fetch (create on first use if desired)
r.get("/db/guilds/:guildId", requireAuth, async (req, res) => {
  const { guildId } = req.params;
  try {
    const doc = await Guild.findOne({ guildId }).lean();
    return res.json(doc || {});
  } catch (e) {
    console.error("GET guild error:", e);
    return res.status(500).json({ error: "db_error" });
  }
});

// PATCH /api/db/guilds/:guildId - upsert settings
r.patch("/db/guilds/:guildId", requireAuth, async (req, res) => {
  const { guildId } = req.params;
  // only allow specific fields to be updated from the panel
  const allowed = [
    "adminRoleId",
    "paymentText",
    "categoryId",
    "listingsChannelId",
    "ordersChannelId",
    "splitsChannelId",
    "opsChannelId",
    "name",
  ];
  const update = {};
  for (const k of allowed) if (k in req.body) update[k] = req.body[k];

  try {
    const doc = await Guild.findOneAndUpdate(
      { guildId },
      { $set: update, $setOnInsert: { guildId } },
      { upsert: true, new: true }
    ).lean();
    return res.json(doc);
  } catch (e) {
    console.error("PATCH guild error:", e);
    return res.status(500).json({ error: "db_error" });
  }
});

export default r;
EOF
