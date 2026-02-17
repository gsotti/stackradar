import db from '../db/database.js';

export interface AuditLogParams {
  userId: number;
  organizationId?: number;
  tenantId?: number;
  action: string;
  resourceType: string;
  resourceId?: string | number;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log a sensitive operation to the audit logs.
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    const {
      userId,
      organizationId,
      tenantId,
      action,
      resourceType,
      resourceId,
      oldValues,
      newValues,
      ipAddress,
      userAgent
    } = params;

    await db.query(
      `INSERT INTO audit_logs (
        user_id, organization_id, tenant_id, action,
        resource_type, resource_id, old_values, new_values,
        ip_address, user_agent
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        userId,
        organizationId || null,
        tenantId || null,
        action,
        resourceType,
        resourceId ? String(resourceId) : null,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress || null,
        userAgent || null
      ]
    );
  } catch (error) {
    // We don't want audit logging to break the main application flow,
    // so we just log the error and continue.
    console.error('Audit logging error:', error);
  }
}
