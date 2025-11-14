import mongoose from "mongoose";

const guildConfigSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },

    isMainServer: { type: Boolean, default: false },
    isBackupServer: { type: Boolean, default: false },

    defaultCategoryId: { type: String, default: null },
    defaultLogChannelId: { type: String, default: null },
    allowedRoleIds: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const GuildConfig = mongoose.model("GuildConfig", guildConfigSchema);
