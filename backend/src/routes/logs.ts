import { Router, Response } from 'express';
import db from '../db/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { AuthRequest, LogEntry, System } from '../types/index.js';

const router = Router();

interface LogQueryParams {
  system_id?: string;
  level?: string;
  search?: string;
  source?: string;
  start_time?: string;
  end_time?: string;
  limit?: string;
  offset?: string;
}

// Query logs
router.get('/', authMiddleware, async (
  req: AuthRequest<{}, {}, {}, LogQueryParams>,
  res: Response
): Promise<void> => {
  try {
    const {
      system_id,
      level,
      search,
      source,
      start_time,
      end_time,
      limit = '100',
      offset = '0'
    } = req.query;

    // Get user's system IDs
    const userSystemsResult = await db.query<Pick<System, 'id'>>(
      'SELECT id FROM systems WHERE user_id = $1',
      [req.userId]
    );
    const userSystemIds = userSystemsResult.rows.map(s => s.id);

    if (userSystemIds.length === 0) {
      res.json({ logs: [], total: 0, limit: parseInt(limit), offset: parseInt(offset) });
      return;
    }

    // If specific system requested, check access
    if (system_id && !userSystemIds.includes(parseInt(system_id))) {
      res.status(403).json({ detail: 'Access denied to this system' });
      return;
    }

    const filterSystemIds = system_id ? [parseInt(system_id)] : userSystemIds;

    // Build query dynamically
    const params: any[] = [filterSystemIds];
    let paramIndex = 2;
    let whereClause = `system_id = ANY($1)`;

    if (level) {
      whereClause += ` AND level = $${paramIndex}`;
      params.push(level.toUpperCase());
      paramIndex++;
    }

    if (search) {
      whereClause += ` AND message ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (source) {
      whereClause += ` AND source ILIKE $${paramIndex}`;
      params.push(`%${source}%`);
      paramIndex++;
    }

    if (start_time) {
      whereClause += ` AND timestamp >= $${paramIndex}`;
      params.push(start_time);
      paramIndex++;
    }

    if (end_time) {
      whereClause += ` AND timestamp <= $${paramIndex}`;
      params.push(end_time);
      paramIndex++;
    }

    // Get total count
    const countResult = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM log_entries WHERE ${whereClause}`,
      params
    );

    // Get logs
    const logsResult = await db.query<LogEntry>(
      `SELECT * FROM log_entries
       WHERE ${whereClause}
       ORDER BY timestamp DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    res.json({
      logs: logsResult.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Query logs error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

interface StatsQueryParams {
  system_id?: string;
  hours?: string;
}

interface LevelCount {
  level: string;
  count: number;
}

interface SourceCount {
  source: string;
  count: number;
}

// Get log statistics
router.get('/stats', authMiddleware, async (
  req: AuthRequest<{}, {}, {}, StatsQueryParams>,
  res: Response
): Promise<void> => {
  try {
    const { system_id, hours = '24' } = req.query;

    // Get user's system IDs
    const userSystemsResult = await db.query<Pick<System, 'id'>>(
      'SELECT id FROM systems WHERE user_id = $1',
      [req.userId]
    );
    const userSystemIds = userSystemsResult.rows.map(s => s.id);

    if (userSystemIds.length === 0) {
      res.json({
        total_logs: 0,
        logs_by_level: {},
        logs_per_hour: [],
        top_sources: []
      });
      return;
    }

    if (system_id && !userSystemIds.includes(parseInt(system_id))) {
      res.status(403).json({ detail: 'Access denied to this system' });
      return;
    }

    const filterSystemIds = system_id ? [parseInt(system_id)] : userSystemIds;
    const since = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000).toISOString();

    // Total logs
    const totalResult = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM log_entries
       WHERE system_id = ANY($1) AND timestamp >= $2`,
      [filterSystemIds, since]
    );

    // Logs by level
    const levelCountsResult = await db.query<LevelCount>(
      `SELECT level, COUNT(*)::int as count FROM log_entries
       WHERE system_id = ANY($1) AND timestamp >= $2
       GROUP BY level`,
      [filterSystemIds, since]
    );

    const logs_by_level: Record<string, number> = {};
    levelCountsResult.rows.forEach(row => {
      logs_by_level[row.level] = row.count;
    });

    // Logs per hour (last N hours)
    const logs_per_hour = [];
    const hoursToShow = Math.min(parseInt(hours), 24);

    for (let i = hoursToShow - 1; i >= 0; i--) {
      const hourStart = new Date(Date.now() - (i + 1) * 60 * 60 * 1000);
      const hourEnd = new Date(Date.now() - i * 60 * 60 * 1000);

      const count = await db.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM log_entries
         WHERE system_id = ANY($1)
         AND timestamp >= $2 AND timestamp < $3`,
        [filterSystemIds, hourStart.toISOString(), hourEnd.toISOString()]
      );

      logs_per_hour.push({
        hour: hourEnd.toISOString().slice(11, 16),
        count: parseInt(count.rows[0].count)
      });
    }

    // Top sources
    const topSourcesResult = await db.query<SourceCount>(
      `SELECT source, COUNT(*)::int as count FROM log_entries
       WHERE system_id = ANY($1)
       AND timestamp >= $2
       AND source IS NOT NULL
       GROUP BY source
       ORDER BY count DESC
       LIMIT 10`,
      [filterSystemIds, since]
    );

    res.json({
      total_logs: parseInt(totalResult.rows[0].count),
      logs_by_level,
      logs_per_hour,
      top_sources: topSourcesResult.rows
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
