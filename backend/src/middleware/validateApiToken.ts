import { Request, Response, NextFunction } from 'express';
import db from '../db/database.js';
import { System } from '../types/index.js';

// Extended request type for system
export interface SystemRequest extends Request {
  system?: System;
}

// Validate API token middleware (for ingestion)
export async function validateApiToken(
  req: SystemRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { apiToken } = req.params;

    const result = await db.query<System>(
      'SELECT * FROM systems WHERE api_token = $1',
      [apiToken]
    );
    const system = result.rows[0];

    if (!system) {
      res.status(401).json({ detail: 'Invalid API token' });
      return;
    }

    req.system = system;
    next();
  } catch (error) {
    console.error('API token validation error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
}
