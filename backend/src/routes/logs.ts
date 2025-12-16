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
  tenant?: string;
  environment?: string;
  application?: string;
  application_id?: string;
  start_time?: string;
  end_time?: string;
  limit?: string;
  offset?: string;
  before_id?: string;
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
      tenant,
      environment,
      application,
      application_id,
      start_time,
      end_time,
      limit = '100',
      offset = '0',
      before_id
    } = req.query;

    // Get all system IDs limited to the user's tenant mappings
    const tenantIds = req.userTenantIds || [];
    const userSystemsResult = await db.query<Pick<System, 'id'>>(
      'SELECT id FROM systems WHERE tenant_id = ANY($1)',
      [tenantIds]
    );
    const userSystemIds = userSystemsResult.rows.map(s => s.id);

    if (userSystemIds.length === 0) {
      res.json({ logs: [], total: 0, limit: parseInt(limit), offset: parseInt(offset) });
      return;
    }

    // If specific system requested, check access
    if (system_id && !userSystemIds.includes(Number(system_id))) {
      res.status(403).json({ detail: 'Access denied to this system' });
      return;
    }

    const filterSystemIds = system_id ? [Number(system_id)] : userSystemIds;

    // Build query dynamically
    const params: any[] = [filterSystemIds];
    let paramIndex = 2;
    // Join through environments -> applications -> systems to scope by system access
    let whereClause = `s.id = ANY($1)`;

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

    if (before_id) {
      // Load logs older than a specific id for infinite scroll
      whereClause += ` AND le.id < $${paramIndex}`;
      params.push(parseInt(before_id));
      paramIndex++;
    }

    if (tenant) {
      whereClause += ` AND s.tenant_id = $${paramIndex}`;
      params.push(tenant);
      paramIndex++;
    }

    if (environment) {
      whereClause += ` AND e.name ILIKE $${paramIndex}`;
      params.push(`%${environment}%`);
      paramIndex++;
    }

    if (application_id) {
      whereClause += ` AND a.id = $${paramIndex}`;
      params.push(parseInt(application_id));
      paramIndex++;
    } else if (application) {
      whereClause += ` AND a.name ILIKE $${paramIndex}`;
      params.push(`%${application}%`);
      paramIndex++;
    }

    const countResult = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM log_entries le
       LEFT JOIN environments e ON e.id = le.environment_id
       LEFT JOIN applications a ON a.id = e.application_id
       LEFT JOIN systems s ON s.id = a.system_id
       WHERE ${whereClause}`,
       params
    );

    // Get logs
    /*
     LEFT JOIN environments e ON e.id = le.environment_id
     LEFT JOIN applications a ON a.id = e.application_id
     LEFT JOIN systems s ON s.id = a.system_id
   */

    const logsResult = await db.query<LogEntry>(
      `SELECT le.*
       FROM log_entries le
       LEFT JOIN environments e ON e.id = le.environment_id
       LEFT JOIN applications a ON a.id = e.application_id
       LEFT JOIN systems s ON s.id = a.system_id
       WHERE ${whereClause}
       ORDER BY le.timestamp DESC
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
  system_id?: number;
  hours?: string;
  tenant_id?: number;
  environment_id?: number;
  application_id?: number;
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
    const { system_id, hours = '24', tenant_id, environment_id, application_id } = req.query;

    // Get all system IDs limited to the user's tenant mappings
    const tenantIds = req.userTenantIds || [];
    const userSystemsResult = await db.query<Pick<System, 'id'>>(
      'SELECT id FROM systems WHERE tenant_id = ANY($1)',
      [tenantIds]
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

    if (system_id && !userSystemIds.includes(Number(system_id))) {
      res.status(403).json({ detail: 'Access denied to this system' });
      return;
    }

    const filterSystemIds = system_id ? [Number(system_id)] : userSystemIds;
    const since = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000).toISOString();

    // Build filter conditions
    const params: any[] = [filterSystemIds, since];
    let paramIndex = 3;
    let filterClause = '';

    if (tenant_id) {
      filterClause += ` AND s.tenant_id = $${paramIndex}`;
      params.push(Number(tenant_id));
      paramIndex++;
    }

    if (environment_id) {
      filterClause += ` AND e.id = $${paramIndex}`;
      params.push(Number(environment_id));
      paramIndex++;
    }

    if (application_id) {
      filterClause += ` AND a.id = $${paramIndex}`;
      params.push(Number(application_id));
      paramIndex++;
    }

    const totalResult = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM log_entries le
       LEFT JOIN environments e ON e.id = le.environment_id
       LEFT JOIN applications a ON a.id = e.application_id
       LEFT JOIN systems s ON s.id = a.system_id
       WHERE s.id = ANY($1) AND le.timestamp >= $2${filterClause}`,
      params
    );

    // Logs by level
    const levelCountsResult = await db.query<LevelCount>(
      `SELECT le.level, COUNT(*)::int as count FROM log_entries le
       LEFT JOIN environments e ON e.id = le.environment_id
       LEFT JOIN applications a ON a.id = e.application_id
       LEFT JOIN systems s ON s.id = a.system_id
       WHERE s.id = ANY($1) AND le.timestamp >= $2${filterClause}
       GROUP BY le.level`,
      params
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

      const hourParams: any[] = [filterSystemIds, hourStart.toISOString(), hourEnd.toISOString()];
      let hourParamIndex = 4;
      let hourFilterClause = '';

      if (tenant_id) {
        hourFilterClause += ` AND s.tenant_id = $${hourParamIndex}`;
        hourParams.push(Number(tenant_id));
        hourParamIndex++;
      }

      if (environment_id) {
        hourFilterClause += ` AND e.id = $${hourParamIndex}`;
        hourParams.push(Number(environment_id));
        hourParamIndex++;
      }

      if (application_id) {
        hourFilterClause += ` AND a.id = $${hourParamIndex}`;
        hourParams.push(Number(application_id));
        hourParamIndex++;
      }

      const count = await db.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM log_entries le
         LEFT JOIN environments e ON e.id = le.environment_id
         LEFT JOIN applications a ON a.id = e.application_id
         LEFT JOIN systems s ON s.id = a.system_id
         WHERE s.id = ANY($1)
         AND le.timestamp >= $2 AND le.timestamp < $3${hourFilterClause}`,
        hourParams
      );

      logs_per_hour.push({
        hour: hourEnd.toISOString().slice(11, 16),
        count: parseInt(count.rows[0].count)
      });
    }

    // Top sources
    const topSourcesResult = await db.query<SourceCount>(
      `SELECT le.source, COUNT(*)::int as count FROM log_entries le
       LEFT JOIN environments e ON e.id = le.environment_id
       LEFT JOIN applications a ON a.id = e.application_id
       LEFT JOIN systems s ON s.id = a.system_id
       WHERE s.id = ANY($1)
       AND le.timestamp >= $2${filterClause}
       AND le.source IS NOT NULL
       GROUP BY le.source
       ORDER BY count DESC
       LIMIT 10`,
      params
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
