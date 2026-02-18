import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';
import db from '../../db/database.js';
import { SmtpConfig } from '../../types/index.js';

// Cache for SMTP config to avoid frequent database queries
// Keyed by organization_id, or 'global' for the null/fallback row
const configCache = new Map<number | 'global', SmtpConfig | null>();
const cacheTimeMap = new Map<number | 'global', number>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get SMTP configuration for a specific organization.
 * Returns null if no config exists for that organization.
 */
export async function getSmtpConfig(organizationId?: number | null): Promise<SmtpConfig | null> {
  const now = Date.now();
  const cacheKey = organizationId ?? 'global';
  const cached = configCache.get(cacheKey);
  const cachedTime = cacheTimeMap.get(cacheKey) ?? 0;

  if (cached !== undefined && (now - cachedTime) < CACHE_TTL) {
    return cached;
  }

  try {
    const result = organizationId != null
      ? await db.query<SmtpConfig>('SELECT * FROM smtp_config WHERE organization_id = $1 LIMIT 1', [organizationId])
      : await db.query<SmtpConfig>('SELECT * FROM smtp_config WHERE organization_id IS NULL LIMIT 1');

    const config = result.rows[0] ?? null;
    configCache.set(cacheKey, config);
    cacheTimeMap.set(cacheKey, now);
    return config;
  } catch (error) {
    console.error('Failed to get SMTP config:', error);
    return null;
  }
}

/**
 * Clear SMTP config cache.
 * If organizationId is provided, clears only that org's cache entry.
 * If no argument, clears all cache entries.
 */
export function clearSmtpConfigCache(organizationId?: number | null): void {
  if (organizationId != null) {
    configCache.delete(organizationId);
    cacheTimeMap.delete(organizationId);
  } else if (organizationId === null) {
    // Explicit null means clear global
    configCache.delete('global');
    cacheTimeMap.delete('global');
  } else {
    // No argument — clear everything
    configCache.clear();
    cacheTimeMap.clear();
  }
}

/**
 * Create nodemailer transporter from SMTP config
 */
export async function createTransporter(organizationId?: number | null) {
  const config = await getSmtpConfig(organizationId);

  if (!config) {
    throw new Error('SMTP configuration not found');
  }

  const options: SMTPTransport.Options = {
    host: config.host,
    port: config.port,
    secure: config.secure,
  };

  // Add authentication if provided
  if (config.auth_user && config.auth_password) {
    options.auth = {
      user: config.auth_user,
      pass: config.auth_password,
    };
  }

  return nodemailer.createTransport(options);
}

/**
 * Send email with retry logic
 */
export async function sendEmail(
  to: string | string[],
  subject: string,
  htmlBody: string,
  textBody?: string,
  organizationId?: number | null
): Promise<void> {
  const config = await getSmtpConfig(organizationId);

  if (!config) {
    throw new Error('SMTP configuration not found');
  }

  const transporter = await createTransporter(organizationId);

  const recipients = Array.isArray(to) ? to.join(', ') : to;

  const mailOptions = {
    from: config.from_name
      ? `"${config.from_name}" <${config.from_email}>`
      : config.from_email,
    to: recipients,
    subject: subject,
    html: htmlBody,
    text: textBody || htmlBody.replace(/<[^>]*>/g, ''), // Strip HTML tags for text version
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

/**
 * Test SMTP configuration by sending a test email
 */
export async function testSmtpConfig(testEmail: string, organizationId?: number | null): Promise<void> {
  const config = await getSmtpConfig(organizationId);

  if (!config) {
    throw new Error('SMTP configuration not found');
  }

  const transporter = await createTransporter(organizationId);

  // Verify connection
  await transporter.verify();

  // Send test email
  await sendEmail(
    testEmail,
    'StackRadar SMTP Test',
    '<h1>SMTP Configuration Test</h1><p>This is a test email from StackRadar. If you received this, your SMTP configuration is working correctly.</p>',
    'SMTP Configuration Test\n\nThis is a test email from StackRadar. If you received this, your SMTP configuration is working correctly.',
    organizationId
  );
}
