import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';
import db from '../../db/database.js';
import { SmtpConfig } from '../../types/index.js';

// Cache for SMTP config to avoid frequent database queries
let cachedConfig: SmtpConfig | null = null;
let cacheTime: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get SMTP configuration from database
 */
export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const now = Date.now();

  // Return cached config if still valid
  if (cachedConfig && (now - cacheTime) < CACHE_TTL) {
    return cachedConfig;
  }

  try {
    const result = await db.query<SmtpConfig>(
      'SELECT * FROM smtp_config LIMIT 1'
    );

    if (result.rows.length === 0) {
      cachedConfig = null;
      cacheTime = now;
      return null;
    }

    cachedConfig = result.rows[0];
    cacheTime = now;
    return cachedConfig;
  } catch (error) {
    console.error('Failed to get SMTP config:', error);
    return null;
  }
}

/**
 * Clear SMTP config cache (call after updating config)
 */
export function clearSmtpConfigCache(): void {
  cachedConfig = null;
  cacheTime = 0;
}

/**
 * Create nodemailer transporter from SMTP config
 */
export async function createTransporter() {
  const config = await getSmtpConfig();

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
  textBody?: string
): Promise<void> {
  const config = await getSmtpConfig();

  if (!config) {
    throw new Error('SMTP configuration not found');
  }

  const transporter = await createTransporter();

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
export async function testSmtpConfig(testEmail: string): Promise<void> {
  const config = await getSmtpConfig();

  if (!config) {
    throw new Error('SMTP configuration not found');
  }

  const transporter = await createTransporter();

  // Verify connection
  await transporter.verify();

  // Send test email
  await sendEmail(
    testEmail,
    'LogRadar SMTP Test',
    '<h1>SMTP Configuration Test</h1><p>This is a test email from LogRadar. If you received this, your SMTP configuration is working correctly.</p>',
    'SMTP Configuration Test\n\nThis is a test email from LogRadar. If you received this, your SMTP configuration is working correctly.'
  );
}
