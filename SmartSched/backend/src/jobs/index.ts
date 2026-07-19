import cron from 'node-cron';
import prisma from '../database/prisma';
import { logger } from '../utils/logger';

export function registerJobs() {
  cron.schedule('0 2 * * *', async () => {
    try {
      const result = await prisma.refreshToken.deleteMany({
        where: {
          OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }],
        },
      });
      logger.info(`Job: cleaned ${result.count} refresh tokens`);
    } catch (err) {
      logger.error('Job: token cleanup failed', { err });
    }
  });

  logger.info('Background jobs registered');
}
