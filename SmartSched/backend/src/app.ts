import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import { swaggerSpec } from './swagger/swagger';
import routes from './routes';
import devRoutes from './routes/dev.routes';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { globalRateLimiter } from './middlewares/rateLimiter';
import { logger } from './utils/logger';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      // In development allow any origin (so Vite's dynamic port works).
      // In production restrict to the configured frontend URL.
      origin: config.isDev ? true : config.frontendUrl,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    })
  );
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(
    morgan(config.isDev ? 'dev' : 'combined', {
      stream: { write: (msg) => logger.info(msg.trim()) },
    })
  );
  app.use(globalRateLimiter);

  app.get('/', (_req, res) => {
    res.json({
      name: 'CHARUSAT Timetable API',
      version: '1.0.0',
      university: 'Charotar University of Science and Technology',
      docs: '/api/docs',
      health: `${config.apiPrefix}/health`,
    });
  });

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));
  app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));

  app.use(config.apiPrefix, routes);

  // Dev-only: seed/reset endpoint (never expose in production)
  if (config.isDev) {
    app.use(`${config.apiPrefix}/dev`, devRoutes);
    logger.info(`[DEV] Seed endpoint: POST ${config.apiPrefix}/dev/reset-seed`);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
