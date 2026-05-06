// ============================================
// Health Check Route — /api/v1/health
// ============================================

import { Router, Request, Response } from 'express';
import { testDatabaseConnection } from '../config';

const router = Router();

/**
 * GET /api/v1/health
 * Returns system health status including database connectivity.
 */
router.get('/', async (_req: Request, res: Response) => {
  const dbConnected = await testDatabaseConnection();

  const healthData = {
    status: dbConnected ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: process.env['npm_package_version'] ?? '0.1.0',
    uptime: Math.floor(process.uptime()),
    database: dbConnected ? 'connected' : 'disconnected',
    environment: process.env['NODE_ENV'] ?? 'development',
  };

  const statusCode = dbConnected ? 200 : 503;

  res.status(statusCode).json({
    success: dbConnected,
    data: healthData,
    message: dbConnected ? 'All systems operational' : 'Database connection failed',
  });
});

export default router;
