import http from 'http';
import { Server as SocketServer } from 'socket.io';
import { createApp } from './app';
import { config } from './config';
import { connectDatabase, disconnectDatabase } from './database/prisma';
import { logger } from './utils/logger';
import { registerJobs } from './jobs';

async function bootstrap() {
  await connectDatabase();

  const app = createApp();
  const server = http.createServer(app);

  const io = new SocketServer(server, {
    cors: { origin: config.frontendUrl, credentials: true },
  });

  io.on('connection', (socket) => {
    logger.debug(`Socket connected: ${socket.id}`);
    socket.on('join', (userId: string) => {
      socket.join(`user:${userId}`);
    });
    socket.on('disconnect', () => logger.debug(`Socket disconnected: ${socket.id}`));
  });

  registerJobs();

  server.listen(config.port, () => {
    logger.info(`SmartSched API running on port ${config.port} [${config.env}]`);
    logger.info(`Swagger docs: http://localhost:${config.port}/api/docs`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error('Failed to start server', { err });
  process.exit(1);
});
