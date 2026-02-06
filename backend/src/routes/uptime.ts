import { Router, Response } from 'express';
import db from '../db/database.js';
import { authMiddleware, editorMiddleware } from '../middleware/auth.js';
import { AuthRequest, UptimeMonitor, UptimeCheck } from '../types/index.js';
import { triggerManualCheck } from '../services/uptime/checker.js';

const router = Router();

// List all monitors (with optional site/tenant filters)
router.get('/monitors/all', authMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { tenant, site, environment } = req.query;

    let query = `
      SELECT m.*,
        (SELECT response_time_ms FROM uptime_checks WHERE monitor_id = m.id ORDER BY checked_at DESC LIMIT 1) as last_response_time,
        s.name as site_name,
        to_char(m.last_checked_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as last_checked_at_iso,
        to_char(m.last_status_change AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as last_status_change_iso,
        to_char(m.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at_iso,
        to_char(m.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at_iso
      FROM uptime_monitors m
      INNER JOIN sites s ON s.id = m.site_id
      WHERE s.tenant_id = ANY($1)
    `;

    const params: any[] = [req.userTenantIds || []];

    if (tenant) {
      params.push(tenant);
      query += ` AND s.tenant_id = $${params.length}`;
    }

    if (site) {
      params.push(site);
      query += ` AND s.id = $${params.length}`;
    }

    if (environment) {
      params.push(environment);
      query += ` AND EXISTS (
        SELECT 1 FROM environments e
        WHERE e.site_id = s.id AND e.id = $${params.length}
      )`;
    }

    query += ` ORDER BY m.current_status = 'down' DESC, m.current_status = 'degraded' DESC, m.name ASC`;

    const result = await db.query<UptimeMonitor>(query, params);

    // Replace timestamp fields with ISO formatted versions
    const monitors = result.rows.map((m: any) => ({
      ...m,
      last_checked_at: m.last_checked_at_iso || m.last_checked_at,
      last_status_change: m.last_status_change_iso || m.last_status_change,
      created_at: m.created_at_iso || m.created_at,
      updated_at: m.updated_at_iso || m.updated_at,
      last_checked_at_iso: undefined,
      last_status_change_iso: undefined,
      created_at_iso: undefined,
      updated_at_iso: undefined,
    }));

    res.json(monitors);
  } catch (error) {
    console.error('Get all monitors error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// List monitors for a site
router.get('/monitors', authMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { site_id } = req.query;

    if (!site_id) {
      res.status(400).json({ detail: 'site_id is required' });
      return;
    }

    // Verify site access
    const siteResult = await db.query(
      'SELECT id FROM sites WHERE id = $1 AND tenant_id = ANY($2)',
      [site_id, req.userTenantIds || []]
    );

    if (siteResult.rows.length === 0) {
      res.status(404).json({ detail: 'Site not found' });
      return;
    }

    const result = await db.query<UptimeMonitor>(
      `SELECT m.*,
        (SELECT response_time_ms FROM uptime_checks WHERE monitor_id = m.id ORDER BY checked_at DESC LIMIT 1) as last_response_time,
        to_char(m.last_checked_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as last_checked_at_iso,
        to_char(m.last_status_change AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as last_status_change_iso,
        to_char(m.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at_iso,
        to_char(m.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at_iso
       FROM uptime_monitors m
       WHERE m.site_id = $1
       ORDER BY m.is_main DESC, m.name ASC`,
      [site_id]
    );

    // Replace timestamp fields with ISO formatted versions
    const monitors = result.rows.map((m: any) => ({
      ...m,
      last_checked_at: m.last_checked_at_iso || m.last_checked_at,
      last_status_change: m.last_status_change_iso || m.last_status_change,
      created_at: m.created_at_iso || m.created_at,
      updated_at: m.updated_at_iso || m.updated_at,
      last_checked_at_iso: undefined,
      last_status_change_iso: undefined,
      created_at_iso: undefined,
      updated_at_iso: undefined,
    }));

    res.json(monitors);
  } catch (error) {
    console.error('Get monitors error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Get single monitor with recent status
router.get('/monitors/:id', authMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const result = await db.query<UptimeMonitor>(
      `SELECT m.*,
        to_char(m.last_checked_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as last_checked_at_iso,
        to_char(m.last_status_change AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as last_status_change_iso,
        to_char(m.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at_iso,
        to_char(m.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at_iso
       FROM uptime_monitors m
       INNER JOIN sites s ON s.id = m.site_id
       WHERE m.id = $1 AND s.tenant_id = ANY($2)`,
      [req.params.id, req.userTenantIds || []]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ detail: 'Monitor not found' });
      return;
    }

    // Get recent checks
    const checksResult = await db.query<UptimeCheck>(
      `SELECT *,
        to_char(checked_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as checked_at_iso
       FROM uptime_checks
       WHERE monitor_id = $1
       ORDER BY checked_at DESC
       LIMIT 10`,
      [req.params.id]
    );

    const monitor: any = result.rows[0];
    const checks = checksResult.rows.map((c: any) => ({
      ...c,
      checked_at: c.checked_at_iso || c.checked_at,
      checked_at_iso: undefined,
    }));

    res.json({
      ...monitor,
      last_checked_at: monitor.last_checked_at_iso || monitor.last_checked_at,
      last_status_change: monitor.last_status_change_iso || monitor.last_status_change,
      created_at: monitor.created_at_iso || monitor.created_at,
      updated_at: monitor.updated_at_iso || monitor.updated_at,
      last_checked_at_iso: undefined,
      last_status_change_iso: undefined,
      created_at_iso: undefined,
      updated_at_iso: undefined,
      recent_checks: checks,
    });
  } catch (error) {
    console.error('Get monitor error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Create monitor
router.post('/monitors', authMiddleware, editorMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      site_id,
      name,
      url,
      method = 'GET',
      interval_seconds = 300,
      timeout_ms = 10000,
      expected_status = 200,
      failure_threshold = 3,
      is_main = false,
    } = req.body;

    if (!site_id || !name || !url) {
      res.status(400).json({ detail: 'site_id, name, and url are required' });
      return;
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      res.status(400).json({ detail: 'Invalid URL format' });
      return;
    }

    // Verify site access
    const siteResult = await db.query(
      'SELECT id FROM sites WHERE id = $1 AND tenant_id = ANY($2)',
      [site_id, req.userTenantIds || []]
    );

    if (siteResult.rows.length === 0) {
      res.status(404).json({ detail: 'Site not found' });
      return;
    }

    // Validate method
    const validMethods = ['GET', 'HEAD', 'POST'];
    if (!validMethods.includes(method)) {
      res.status(400).json({ detail: 'Invalid method. Must be GET, HEAD, or POST' });
      return;
    }

    // Validate interval
    const validIntervals = [60, 300, 900, 1800, 3600];
    if (!validIntervals.includes(interval_seconds)) {
      res.status(400).json({ detail: 'Invalid interval. Must be 60, 300, 900, 1800, or 3600' });
      return;
    }

    // If setting as main, clear other main monitors for this site
    if (is_main) {
      await db.query(
        'UPDATE uptime_monitors SET is_main = false WHERE site_id = $1',
        [site_id]
      );
    }

    const result = await db.query<UptimeMonitor>(
      `INSERT INTO uptime_monitors
       (site_id, name, url, method, interval_seconds, timeout_ms, expected_status, failure_threshold, is_main)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [site_id, name, url, method, interval_seconds, timeout_ms, expected_status, failure_threshold, is_main]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create monitor error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Update monitor
router.put('/monitors/:id', authMiddleware, editorMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, url, method, interval_seconds, timeout_ms, expected_status, failure_threshold, is_main, enabled } = req.body;

    // Verify access
    const existingResult = await db.query<UptimeMonitor>(
      `SELECT m.* FROM uptime_monitors m
       INNER JOIN sites s ON s.id = m.site_id
       WHERE m.id = $1 AND s.tenant_id = ANY($2)`,
      [req.params.id, req.userTenantIds || []]
    );

    if (existingResult.rows.length === 0) {
      res.status(404).json({ detail: 'Monitor not found' });
      return;
    }

    const existing = existingResult.rows[0];

    // Validate URL if provided
    if (url) {
      try {
        new URL(url);
      } catch {
        res.status(400).json({ detail: 'Invalid URL format' });
        return;
      }
    }

    // Validate method if provided
    if (method) {
      const validMethods = ['GET', 'HEAD', 'POST'];
      if (!validMethods.includes(method)) {
        res.status(400).json({ detail: 'Invalid method. Must be GET, HEAD, or POST' });
        return;
      }
    }

    // Validate interval if provided
    if (interval_seconds !== undefined) {
      const validIntervals = [60, 300, 900, 1800, 3600];
      if (!validIntervals.includes(interval_seconds)) {
        res.status(400).json({ detail: 'Invalid interval. Must be 60, 300, 900, 1800, or 3600' });
        return;
      }
    }

    // If setting as main, clear other main monitors for this site
    if (is_main && !existing.is_main) {
      await db.query(
        'UPDATE uptime_monitors SET is_main = false WHERE site_id = $1',
        [existing.site_id]
      );
    }

    const result = await db.query<UptimeMonitor>(
      `UPDATE uptime_monitors SET
        name = COALESCE($1, name),
        url = COALESCE($2, url),
        method = COALESCE($3, method),
        interval_seconds = COALESCE($4, interval_seconds),
        timeout_ms = COALESCE($5, timeout_ms),
        expected_status = COALESCE($6, expected_status),
        failure_threshold = COALESCE($7, failure_threshold),
        is_main = COALESCE($8, is_main),
        enabled = COALESCE($9, enabled),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *`,
      [name, url, method, interval_seconds, timeout_ms, expected_status, failure_threshold, is_main, enabled, req.params.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update monitor error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Delete monitor
router.delete('/monitors/:id', authMiddleware, editorMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Verify access
    const existingResult = await db.query(
      `SELECT m.id FROM uptime_monitors m
       INNER JOIN sites s ON s.id = m.site_id
       WHERE m.id = $1 AND s.tenant_id = ANY($2)`,
      [req.params.id, req.userTenantIds || []]
    );

    if (existingResult.rows.length === 0) {
      res.status(404).json({ detail: 'Monitor not found' });
      return;
    }

    await db.query('DELETE FROM uptime_monitors WHERE id = $1', [req.params.id]);

    res.json({ message: 'Monitor deleted' });
  } catch (error) {
    console.error('Delete monitor error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Get monitor history (paginated)
router.get('/monitors/:id/history', authMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { limit = '50', offset = '0' } = req.query;

    // Verify access
    const monitorResult = await db.query(
      `SELECT m.id FROM uptime_monitors m
       INNER JOIN sites s ON s.id = m.site_id
       WHERE m.id = $1 AND s.tenant_id = ANY($2)`,
      [req.params.id, req.userTenantIds || []]
    );

    if (monitorResult.rows.length === 0) {
      res.status(404).json({ detail: 'Monitor not found' });
      return;
    }

    const result = await db.query<UptimeCheck>(
      `SELECT *,
        to_char(checked_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as checked_at_iso
       FROM uptime_checks
       WHERE monitor_id = $1
       ORDER BY checked_at DESC
       LIMIT $2 OFFSET $3`,
      [req.params.id, parseInt(limit as string), parseInt(offset as string)]
    );

    const countResult = await db.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM uptime_checks WHERE monitor_id = $1',
      [req.params.id]
    );

    // Replace timestamp fields with ISO formatted versions
    const checks = result.rows.map((c: any) => ({
      ...c,
      checked_at: c.checked_at_iso || c.checked_at,
      checked_at_iso: undefined,
    }));

    res.json({
      checks,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    console.error('Get monitor history error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Trigger manual check
router.post('/monitors/:id/check', authMiddleware, editorMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Verify access
    const monitorResult = await db.query(
      `SELECT m.id FROM uptime_monitors m
       INNER JOIN sites s ON s.id = m.site_id
       WHERE m.id = $1 AND s.tenant_id = ANY($2)`,
      [req.params.id, req.userTenantIds || []]
    );

    if (monitorResult.rows.length === 0) {
      res.status(404).json({ detail: 'Monitor not found' });
      return;
    }

    const result = await triggerManualCheck(parseInt(req.params.id));

    res.json(result);
  } catch (error) {
    console.error('Manual check error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Get main monitor status for site overview
router.get('/site/:siteId/status', authMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Verify site access
    const siteResult = await db.query(
      'SELECT id FROM sites WHERE id = $1 AND tenant_id = ANY($2)',
      [req.params.siteId, req.userTenantIds || []]
    );

    if (siteResult.rows.length === 0) {
      res.status(404).json({ detail: 'Site not found' });
      return;
    }

    // Get main monitor status
    const result = await db.query<UptimeMonitor & { last_response_time: number }>(
      `SELECT m.*,
        (SELECT response_time_ms FROM uptime_checks WHERE monitor_id = m.id ORDER BY checked_at DESC LIMIT 1) as last_response_time,
        to_char(m.last_checked_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as last_checked_at_iso,
        to_char(m.last_status_change AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as last_status_change_iso,
        to_char(m.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at_iso,
        to_char(m.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at_iso
       FROM uptime_monitors m
       WHERE m.site_id = $1 AND m.is_main = true
       LIMIT 1`,
      [req.params.siteId]
    );

    if (result.rows.length === 0) {
      res.json(null);
      return;
    }

    const monitor: any = result.rows[0];
    res.json({
      status: monitor.current_status,
      ...monitor,
      last_checked_at: monitor.last_checked_at_iso || monitor.last_checked_at,
      last_status_change: monitor.last_status_change_iso || monitor.last_status_change,
      created_at: monitor.created_at_iso || monitor.created_at,
      updated_at: monitor.updated_at_iso || monitor.updated_at,
      last_checked_at_iso: undefined,
      last_status_change_iso: undefined,
      created_at_iso: undefined,
      updated_at_iso: undefined,
    });
  } catch (error) {
    console.error('Get site status error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Get global stats for dashboard
router.get('/stats', authMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { tenant, site, environment } = req.query;

    let query = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE m.current_status = 'up') as up,
        COUNT(*) FILTER (WHERE m.current_status = 'down') as down,
        COUNT(*) FILTER (WHERE m.current_status = 'degraded') as degraded,
        COUNT(*) FILTER (WHERE m.current_status = 'unknown' OR m.current_status IS NULL) as unknown
      FROM uptime_monitors m
      INNER JOIN sites s ON s.id = m.site_id
      WHERE s.tenant_id = ANY($1)
    `;

    const params: any[] = [req.userTenantIds || []];

    if (tenant) {
      params.push(tenant);
      query += ` AND s.tenant_id = $${params.length}`;
    }

    if (site) {
      params.push(site);
      query += ` AND s.id = $${params.length}`;
    }

    if (environment) {
      params.push(environment);
      query += ` AND EXISTS (
        SELECT 1 FROM environments e
        WHERE e.site_id = s.id AND e.id = $${params.length}
      )`;
    }

    const result = await db.query(query, params);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get uptime stats error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
