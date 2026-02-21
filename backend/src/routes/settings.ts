import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import db from '../db/database.js';

const router = Router();

// Returns non-sensitive public settings readable by any authenticated user
router.get('/public', authMiddleware, async (_req, res) => {
  try {
    const result = await db.query(
      `SELECT key, value FROM system_settings WHERE key IN ('registry_owner', 'app_url')`
    );
    const settings: Record<string, string> = {};
    for (const row of result.rows) {
      settings[row.key] = row.value;
    }
    if (!settings.app_url) {
      settings.app_url = process.env.APP_URL || '';
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

export default router;
