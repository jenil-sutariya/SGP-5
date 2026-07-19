import swaggerJsdoc from 'swagger-jsdoc';
import { config } from '../config';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'CHARUSAT Timetable API',
      version: '1.0.0',
      description:
        'CHARUSAT (Charotar University of Science and Technology) timetable generation API for students and professors',
      contact: { name: 'CHARUSAT Timetable', email: 'timetable@charusat.edu.in' },
    },
    servers: [{ url: `http://localhost:${config.port}${config.apiPrefix}`, description: 'Local' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth' },
      { name: 'Departments' },
      { name: 'Faculty' },
      { name: 'Students' },
      { name: 'Courses' },
      { name: 'Subjects' },
      { name: 'Rooms' },
      { name: 'Timetable' },
      { name: 'Scheduler' },
      { name: 'Analytics' },
    ],
  },
  apis: ['./src/modules/**/*.routes.ts', './src/routes/*.ts', './src/swagger/*.yaml'],
};

export const swaggerSpec = swaggerJsdoc(options);
