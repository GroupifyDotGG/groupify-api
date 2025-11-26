import express from "express";
import mongoose from "mongoose";
import fetch from "node-fetch";

const router = express.Router();

const { DISCORD_BOT_TOKEN } = process.env;

// Schema for per-guild Groupify config
const GuildConfigSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, index: true, unique: true },

    // Basic toggles
    enabled: { type: Boolean, default: true },
    prefix: { type: String, default: "!" },

    // Channels (store as raw IDs for now)
    groupBuyChannelId: { type: String, default: "" },
    logChannelId: { type: String, default: "" },

    // Role allowed to manage group buys (optional)
    managerRoleId: { type: String, default: "" },

    // Behaviour
    minParticipants: { type: Number, default: 5 },
    defaultCurrency: { type: String, default: "GBP" },
  },
  { timestamps: true }
);

const GuildConfig =
  mongoose.models.GuildConfig ||
  mongoose.model("GuildConfig", GuildConfigSchema);

const defaultConfig = {
  enabled: true,
  prefix: "!",
  groupBuyChannelId: "",
  logChannelId: "",
  managerRoleId: "",
  minParticipants: 5,
  defaultCurrency: "GBP",
};

function formatConfigResponse(config, guildId) {
  if (!config) {
    return {
      guildId,
      ...defaultConfig,
      _id: null,
      isDefault: true,
    };
  }

  return {
    guildId,
    enabled: config.enabled,
    prefix: config.prefix,
    groupBuyChannelId: config.groupBuyChannelId || "",
    logChannelId: config.logChannelId || "",
    managerRoleId: config.managerRoleId || "",
    minParticipants:
      typeof config.minParticipants === "number"
        ? config.minParticipants
        : defaultConfig.minParticipants,
    defaultCurrency: config.defaultCurrency || defaultConfig.defaultCurrency,
    _id: config._id,
    isDefault: false,
  };
}

// GET /api/db/guilds/:guildId – fetch config (or default)
router.get("/:guildId", async (req, res) => {
  const { guildId } = req.params;

  try {
    const config = await GuildConfig.findOne({ guildId }).lean();
    return res.json(formatConfigResponse(config, guildId));
  } catch (err) {
    console.error("GET guild config error", err);
    return res.status(500).json({ error: "Failed to load guild config" });
  }
});

// PATCH /api/db/guilds/:guildId – save config
router.patch("/:guildId", async (req, res) => {
  const { guildId } = req.params;
  const {
    enabled,
    prefix,
    groupBuyChannelId,
    logChannelId,
    managerRoleId,
    minParticipants,
    defaultCurrency,
  } = req.body;

  try {
    const update = {};

    if (typeof enabled === "boolean") update.enabled = enabled;
    if (typeof prefix === "string") update.prefix = prefix.trim() || "!";

    if (typeof groupBuyChannelId === "string") {
      update.groupBuyChannelId = groupBuyChannelId.trim();
    }

    if (typeof logChannelId === "string") {
      update.logChannelId = logChannelId.trim();
    }

    if (typeof managerRoleId === "string") {
      update.managerRoleId = managerRoleId.trim();
    }

    if (
      typeof minParticipants === "number" &&
      Number.isFinite(minParticipants) &&
      minParticipants > 0
    ) {
      update.minParticipants = Math.floor(minParticipants);
    }

    if (typeof defaultCurrency === "string") {
      update.defaultCurrency = defaultCurrency.toUpperCase() || "GBP";
    }

    const config = await GuildConfig.findOneAndUpdate(
      { guildId },
      { $set: update },
      { upsert: true, new: true }
    ).lean();

    return res.json(formatConfigResponse(config, guildId));
  } catch (err) {
    console.error("PATCH guild config error", err);
    return res.status(500).json({ error: "Failed to save guild config" });
  }
});

// POST /api/db/guilds/:guildId/setup – auto-create channels + role
router.post("/:guildId/setup", async (req, res) => {
  const { guildId } = req.params;

  if (!DISCORD_BOT_TOKEN) {
    return res
      .status(500)
      .json({ error: "DISCORD_BOT_TOKEN is not configured on the API" });
  }

  try {
    // If we already have config with all 3 set, just return it (avoid dupes)
    let existing = await GuildConfig.findOne({ guildId }).lean();
    if (
      existing &&
      existing.groupBuyChannelId &&
      existing.logChannelId &&
      existing.managerRoleId
    ) {
      console.log(
        `Setup requested for guild ${guildId}, but config already has channels/role – returning existing.`
      );
      return res.json(formatConfigResponse(existing, guildId));
    }

    const authHeader = {
      Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    };

    const apiBase = "https://discord.com/api";

    // 1) Create role
    const roleRes = await fetch(`${apiBase}/guilds/${guildId}/roles`, {
      method: "POST",
      headers: authHeader,
      body: JSON.stringify({
        name: "Groupify Manager",
        mentionable: true,
      }),
    });

    const roleJson = await roleRes.json();
    if (!roleRes.ok) {
      console.error("Create role error:", roleJson);
      return res
        .status(500)
        .json({ error: "Failed to create manager role in this server." });
    }

    const managerRoleId = roleJson.id;

    // 2) Create main group-buy channel
    const gbChanRes = await fetch(`${apiBase}/guilds/${guildId}/channels`, {
      method: "POST",
      headers: authHeader,
      body: JSON.stringify({
        name: "group-buys",
        type: 0, // text
        topic: "Groupify group buy coordination",
      }),
    });

    const gbChanJson = await gbChanRes.json();
    if (!gbChanRes.ok) {
      console.error("Create group-buys channel error:", gbChanJson);
      return res
        .status(500)
        .json({ error: "Failed to create group-buys channel in this server." });
    }

    const groupBuyChannelId = gbChanJson.id;

    // 3) Create log channel
    const logChanRes = await fetch(`${apiBase}/guilds/${guildId}/channels`, {
      method: "POST",
      headers: authHeader,
      body: JSON.stringify({
        name: "group-buys-log",
        type: 0, // text
        topic: "Groupify logs and status updates",
      }),
    });

    const logChanJson = await logChanRes.json();
    if (!logChanRes.ok) {
      console.error("Create log channel error:", logChanJson);
      return res
        .status(500)
        .json({ error: "Failed to create log channel in this server." });
    }

    const logChannelId = logChanJson.id;

    // 4) Save/update the config record
    const update = {
      enabled: true,
      groupBuyChannelId,
      logChannelId,
      managerRoleId,
    };

    const config = await GuildConfig.findOneAndUpdate(
      { guildId },
      { $set: update },
      { upsert: true, new: true }
    ).lean();

    console.log(
      `Auto-setup complete for guild ${guildId}. Channels: ${groupBuyChannelId}, ${logChannelId}, role: ${managerRoleId}`
    );

    return res.json(formatConfigResponse(config, guildId));
  } catch (err) {
    console.error("POST guild setup error", err);
    return res.status(500).json({
      error:
        "Failed to run setup. Make sure the bot is in this server and has Manage Channels / Manage Roles.",
    });
  }
});

export default router;
