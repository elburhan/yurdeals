// ============================================
// Server Entry Point — YurDeals Backend
// ============================================

import app from './app';
import { env, prisma } from './config';
import { logger } from './utils';

async function main(): Promise<void> {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('Database connected successfully');

    // Start HTTP server
    const server = app.listen(env.PORT, () => {
      logger.info(`Server running on port ${env.PORT}`, {
        environment: env.NODE_ENV,
        apiVersion: env.API_VERSION,
        url: `http://localhost:${env.PORT}/api/${env.API_VERSION}`,
      });
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);
      server.close(async () => {
        await prisma.$disconnect();
        logger.info('Database disconnected. Server shut down gracefully.');
        process.exit(0);
      });

      // Force shutdown after 10s
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : String(error),
    });
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
