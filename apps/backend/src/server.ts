// ============================================
// Server Entry Point — YurDeals Backend
// ============================================

import app from './app';
import { env, isFlutterwaveEnabled, prisma } from './config';
import { logger } from './utils';

async function main(): Promise<void> {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('Database connection initialized');
    logger.info('Payment provider configuration loaded', {
      paystackEnabled: Boolean(env.PAYSTACK_SECRET_KEY && env.PAYSTACK_PUBLIC_KEY && env.PAYSTACK_CALLBACK_URL),
      flutterwaveEnabled: isFlutterwaveEnabled,
    });

    // Start HTTP server
    const server = app.listen(env.PORT, () => {
      logger.info(`Server running on port ${env.PORT}`, {
        environment: env.NODE_ENV,
        apiVersion: env.API_VERSION,
        url: `http://localhost:${env.PORT}/api/${env.API_VERSION}`,
      });
    });

    let isShuttingDown = false;

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      if (isShuttingDown) {
        logger.warn(`Ignoring duplicate ${signal} during active shutdown`);
        return;
      }

      isShuttingDown = true;
      logger.info(`${signal} received. Starting graceful shutdown...`);

      const forceShutdownTimer = setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);

      try {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        });

        await prisma.$disconnect();
        clearTimeout(forceShutdownTimer);
        logger.info('Database disconnected. Server shut down gracefully.');
        process.exit(0);
      } catch (error) {
        clearTimeout(forceShutdownTimer);

        try {
          await prisma.$disconnect();
        } catch {
          // Ignore disconnect error during shutdown failure path.
        }

        logger.error('Graceful shutdown failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        process.exit(1);
      }
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
