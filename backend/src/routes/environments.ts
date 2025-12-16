import { Router, Response } from 'express';
import db from '../db/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

interface EnvQueryParams {
  tenant_id?: string;
  system_id?: string;
  application_id?: string;
}

// List environments scoped by tenant/system/application
router.get('/', authMiddleware, async (
  req: AuthRequest<{}, {}, {}, EnvQueryParams>,
  res: Response
): Promise<void> => {
  try {
    const { tenant_id, system_id, application_id } = req.query;

    const params: any[] = [];
    let where = '';
    let idx = 1;

    // Always enforce user tenant scoping
    where += where ? ` AND s.tenant_id = ANY($${idx++})` : ` WHERE s.tenant_id = ANY($${idx++})`;
    params.push(req.userTenantIds || []);

    if (application_id) {
      // Append correctly based on existing WHERE
      where += where ? ` AND e.application_id = $${idx++}` : ` WHERE e.application_id = $${idx++}`;
      params.push(parseInt(application_id));
    } else if (system_id) {
      // environments under applications that belong to given system
      where += where ? ` AND a.system_id = $${idx++}` : ` WHERE a.system_id = $${idx++}`;
      params.push(parseInt(system_id));
    } else if (tenant_id) {
      // environments under systems that belong to tenant
      where += where ? ` AND s.tenant_id = $${idx++}` : ` WHERE s.tenant_id = $${idx++}`;
      params.push(parseInt(tenant_id));
    }

    const result = await db.query<{ name: string }>(
      `SELECT DISTINCT e.name as name
       FROM environments e
       JOIN applications a ON a.id = e.application_id
       JOIN systems s ON s.id = a.system_id
       ${where}
       ORDER BY name ASC`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    console.error('List environments error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
