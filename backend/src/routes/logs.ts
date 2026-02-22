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
  site?: string;
  environment?: string;
  system?: string;
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
      site,
      environment,
      system,
      start_time,
      end_time,
      limit = '100',
      offset = '0',
      before_id
    } = req.query;

    // Debug: Log received filter parameters (only in non-production)
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔍 [Backend /logs] Received query params:', {
        tenant,
        site,
        environment,
        system,
        system_id,
        level,
        search,
        limit,
        offset
      });
    }

    // Get all system IDs limited to the user's tenant mappings
    const tenantIds = req.userTenantIds || [];
    const userSystemsResult = await db.query<Pick<System, 'id'>>(
      `SELECT sys.id FROM systems sys
       JOIN environments e ON e.id = sys.environment_id
       JOIN sites si ON si.id = e.site_id
       WHERE si.tenant_id = ANY($1)`,
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
    // Join through systems -> environments -> sites to scope by system access
    let whereClause = `sys.id = ANY($1)`;

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
      whereClause += ` AND si.tenant_id = $${paramIndex}`;
      params.push(tenant);
      paramIndex++;
    }

    if (site) {
      // Check if site is a numeric ID or a text search
      const siteAsNumber = parseInt(site, 10);
      if (!isNaN(siteAsNumber)) {
        // If numeric, filter by site_id
        whereClause += ` AND si.id = $${paramIndex}`;
        params.push(siteAsNumber);
      } else {
        // If text, search in legacy text field
        whereClause += ` AND le.site ILIKE $${paramIndex}`;
        params.push(`%${site}%`);
      }
      paramIndex++;
    }

    if (environment) {
      // Check if environment is a numeric ID or a text search
      const environmentAsNumber = parseInt(environment, 10);
      if (!isNaN(environmentAsNumber)) {
        // If numeric, filter by environment_id
        whereClause += ` AND e.id = $${paramIndex}`;
        params.push(environmentAsNumber);
      } else {
        // If text, search in environment name or legacy text field
        whereClause += ` AND (e.name ILIKE $${paramIndex} OR le.environment ILIKE $${paramIndex})`;
        params.push(`%${environment}%`);
      }
      paramIndex++;
    }

    if (system) {
      // Check if system is a numeric ID or a text search
      const systemAsNumber = parseInt(system, 10);
      if (!isNaN(systemAsNumber)) {
        // If numeric, filter by system_id
        whereClause += ` AND sys.id = $${paramIndex}`;
        params.push(systemAsNumber);
      } else {
        // If text, search in legacy text field
        whereClause += ` AND le.system ILIKE $${paramIndex}`;
        params.push(`%${system}%`);
      }
      paramIndex++;
    }

    // Debug: Log final query details (only in non-production)
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔍 [Backend /logs] Query WHERE clause:', whereClause);
      console.log('🔍 [Backend /logs] Query params:', params);
    }

    const countResult = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM log_entries le
       LEFT JOIN systems sys ON sys.id = le.system_id
       LEFT JOIN environments e ON e.id = sys.environment_id
       LEFT JOIN sites si ON si.id = e.site_id
       WHERE ${whereClause}`,
       params
    );

    // Get logs
    const logsResult = await db.query<LogEntry>(
      `SELECT le.*
       FROM log_entries le
       LEFT JOIN systems sys ON sys.id = le.system_id
       LEFT JOIN environments e ON e.id = sys.environment_id
       LEFT JOIN sites si ON si.id = e.site_id
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
    const { system_id, hours = '24', tenant_id, environment_id } = req.query;

    // Validate query params are positive integers
    const parsedHours = parseInt(String(hours), 10);
    if (isNaN(parsedHours) || parsedHours <= 0) {
      res.status(400).json({ detail: 'hours must be a positive integer' });
      return;
    }
    if (system_id !== undefined) {
      const parsed = parseInt(String(system_id), 10);
      if (isNaN(parsed) || parsed <= 0) {
        res.status(400).json({ detail: 'system_id must be a positive integer' });
        return;
      }
    }
    if (tenant_id !== undefined) {
      const parsed = parseInt(String(tenant_id), 10);
      if (isNaN(parsed) || parsed <= 0) {
        res.status(400).json({ detail: 'tenant_id must be a positive integer' });
        return;
      }
    }
    if (environment_id !== undefined) {
      const parsed = parseInt(String(environment_id), 10);
      if (isNaN(parsed) || parsed <= 0) {
        res.status(400).json({ detail: 'environment_id must be a positive integer' });
        return;
      }
    }

    // Get all system IDs limited to the user's tenant mappings
    const tenantIds = req.userTenantIds || [];
    const userSystemsResult = await db.query<Pick<System, 'id'>>(
      `SELECT sys.id FROM systems sys
       JOIN environments e ON e.id = sys.environment_id
       JOIN sites si ON si.id = e.site_id
       WHERE si.tenant_id = ANY($1)`,
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
    const since = new Date(Date.now() - parsedHours * 60 * 60 * 1000).toISOString();

    // Build filter conditions
    const params: any[] = [filterSystemIds, since];
    let paramIndex = 3;
    let filterClause = '';

    if (tenant_id) {
      filterClause += ` AND si.tenant_id = $${paramIndex}`;
      params.push(Number(tenant_id));
      paramIndex++;
    }

    if (environment_id) {
      filterClause += ` AND e.id = $${paramIndex}`;
      params.push(Number(environment_id));
      paramIndex++;
    }

    const totalResult = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM log_entries le
       LEFT JOIN systems sys ON sys.id = le.system_id
       LEFT JOIN environments e ON e.id = sys.environment_id
       LEFT JOIN sites si ON si.id = e.site_id
       WHERE sys.id = ANY($1) AND le.timestamp >= $2${filterClause}`,
      params
    );

    // Logs by level
    const levelCountsResult = await db.query<LevelCount>(
      `SELECT le.level, COUNT(*)::int as count FROM log_entries le
       LEFT JOIN systems sys ON sys.id = le.system_id
       LEFT JOIN environments e ON e.id = sys.environment_id
       LEFT JOIN sites si ON si.id = e.site_id
       WHERE sys.id = ANY($1) AND le.timestamp >= $2${filterClause}
       GROUP BY le.level`,
      params
    );

    const logs_by_level: Record<string, number> = {};
    levelCountsResult.rows.forEach(row => {
      logs_by_level[row.level] = row.count;
    });

    // Logs per hour (last N hours)
    const logs_per_hour = [];
    const hoursToShow = Math.min(parsedHours, 24);

    for (let i = hoursToShow - 1; i >= 0; i--) {
      const hourStart = new Date(Date.now() - (i + 1) * 60 * 60 * 1000);
      const hourEnd = new Date(Date.now() - i * 60 * 60 * 1000);

      const hourParams: any[] = [filterSystemIds, hourStart.toISOString(), hourEnd.toISOString()];
      let hourParamIndex = 4;
      let hourFilterClause = '';

      if (tenant_id) {
        hourFilterClause += ` AND si.tenant_id = $${hourParamIndex}`;
        hourParams.push(Number(tenant_id));
        hourParamIndex++;
      }

      if (environment_id) {
        hourFilterClause += ` AND e.id = $${hourParamIndex}`;
        hourParams.push(Number(environment_id));
        hourParamIndex++;
      }

      const count = await db.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM log_entries le
         LEFT JOIN systems sys ON sys.id = le.system_id
         LEFT JOIN environments e ON e.id = sys.environment_id
         LEFT JOIN sites si ON si.id = e.site_id
         WHERE sys.id = ANY($1)
         AND le.timestamp >= $2 AND le.timestamp < $3${hourFilterClause}`,
        hourParams
      );

      logs_per_hour.push({
        hour: hourEnd.toISOString().slice(11, 16),
        count: parseInt(count.rows[0].count)
      });
    }

    // Top sources (grouped by system and environment)
    const topSourcesResult = await db.query<SourceCount>(
      `SELECT
         CONCAT(sys.name, ' (', e.name, ')') as source,
         COUNT(*)::int as count
       FROM log_entries le
       LEFT JOIN systems sys ON sys.id = le.system_id
       LEFT JOIN environments e ON e.id = sys.environment_id
       LEFT JOIN sites si ON si.id = e.site_id
       WHERE sys.id = ANY($1)
       AND le.timestamp >= $2${filterClause}
       GROUP BY sys.name, e.name
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
