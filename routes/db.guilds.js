import { Router } from 'express';
import Guild from '../models/Guild.js';

const router = Router();

/**
 * GET /api/db/guilds/:guildId
 * Returns a guild doc (creates if missing).
 * Accepts optional ?name=&icon= to seed basic info.
 */
router.get('/:guildId', async (req, res) => {
  const { guildId } = req.params;
  const { name, icon } = req.query;

  try {
    let doc = await Guild.findOne({ guildId });
    if (!doc) {
      doc = await Guild.create({ guildId, name, icon });
    } else if (name || icon) {
      if (name) doc.name = name;
      if (icon) doc.icon = icon;
      await doc.save();
    }
    res.json(doc);
  } catch (err) {
    console.error('GET guild error:', err);
    res.status(500).json({ error: 'db_error' });
  }
});

/**
 * PATCH /api/db/guilds/:guildId
 * Body: { adminRoleId?, paymentText? }
 */
router.patch('/:guildId', async (req, res) => {
  const { guildId } = req.params;
  const { adminRoleId, paymentText } = req.body || {};

  try {
    const update = {};
    if (typeof adminRoleId === 'string') update.adminRoleId = adminRoleId;
    if (typeof paymentText === 'string') update.paymentText = paymentText;

    const doc = await Guild.findOneAndUpdate(
      { guildId },
      { $set: update },
      { new: true, upsert: true }
    );

    res.json(doc);
  } catch (err) {
    console.error('PATCH guild error:', err);
    res.status(500).json({ error: 'db_error' });
  }
});

/**
 * POST /api/db/guilds/:guildId/install
 * Marks the bot as installed (panel “Invite Bot” success).
 */
router.post('/:guildId/install', async (req, res) => {
  const { guildId } = req.params;
  try {
    const doc = await Guild.findOneAndUpdate(
      { guildId },
      { $set: { botInstalledAt: new Date() } },
      { new: true, upsert: true }
    );
    res.json(doc);
  } catch (err) {
    console.error('INSTALL mark error:', err);
    res.status(500).json({ error: 'db_error' });
  }
});

export default router;
