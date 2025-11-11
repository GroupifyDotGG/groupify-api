import mongoose from 'mongoose';

const GuildSchema = new mongoose.Schema({
  guildId: { type: String, index: true, unique: true },
  name: String,
  icon: String,           // optional cache
  // Settings
  adminRoleId: String,
  paymentText: String,
  listingChannelId: String,
  ordersChannelId: String,
  splitsChannelId: String,
  opsChannelId: String,
  categoryId: String,
  // Bot install marker (set by /setup or by check)
  botInstalledAt: Date,
}, { timestamps: true });

export default mongoose.model('Guild', GuildSchema, 'guilds');
