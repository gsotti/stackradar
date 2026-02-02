import { Request, Response, NextFunction } from 'express';
import db from '../db/database.js';
import { Site } from '../types/index.js';

// Extended request type for site
export interface SiteRequest extends Request {
  site?: Site;
}

// Validate API token middleware (for ingestion)
export async function validateApiToken(
  req: SiteRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { apiToken } = req.params;

    const result = await db.query<Site>(
      'SELECT * FROM sites WHERE api_token = $1',
      [apiToken]
    );
    const site = result.rows[0];

    if (!site) {
      res.status(401).json({ detail: 'Invalid API token' });
      return;
    }

    req.site = site;
    next();
  } catch (error) {
    console.error('API token validation error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
}
