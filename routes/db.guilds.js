// /var/www/groupify.gg/api/routes/db.guilds.js
import express from "express";
import { GuildConfig } from "../models/GuildConfig.js";

const router = express.Router();

// GET /api/db/guilds/:guildId/config
router.get("/:guildId/config", async (req, res) => {
  try {
    const { guildId } = req.params;

    let config = await GuildConfig.findOne({ guildId });

    // If no config exists yet, create a default one
    if (!config) {
      config = await GuildConfig.create({ guildId });
    }

    res.json({ ok: true, config });
  } catch (err) {
    console.error("Error fetching guild config", err);
    res.status(500).json({ ok: false, error: "Failed to fetch guild config" });
  }
});

// PUT /api/db/guilds/:guildId/config
router.put("/:guildId/config", async (req, res) => {
  try {
    const { guildId } = req.params;
    const update = req.body || {};

    const config = await GuildConfig.findOneAndUpdate(
      { guildId },
      { $set: update },
      { new: true, upsert: true }
    );

    res.json({ ok: true, config });
  } catch (err) {
    console.error("Error updating guild config", err);
    res.status(500).json({ ok: false, error: "Failed to update guild config" });
  }
});

export default router;
