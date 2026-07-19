# CHARUSAT Timetable (SmartSched)

**Official timetable portal for Charotar University of Science and Technology (CHARUSAT)**

Built for **CHARUSAT students and professors** (CSPIT and campus departments). Login is restricted to `@charusat.edu.in` / `@charusat.ac.in` emails. The engine generates conflict-free academic timetables using constraint satisfaction, greedy optimization, backtracking, and genetic algorithm polishing.

## Architecture

| Layer | Technology |
| --- | --- |
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS + TanStack Query + Zustand |
| Backend | Node.js + Express + TypeScript |
| ORM | Prisma |
| Database | PostgreSQL |
| Auth | JWT access + refresh tokens, RBAC |
| Scheduling | CSP / Greedy / Backtracking / Genetic Algorithm |
| Docs | Swagger/OpenAPI at `/api/docs` |
| Deploy | Docker Compose + Nginx + PM2 + GitHub Actions |

```
SmartSched/
├── frontend/          # React SPA
├── backend/           # Express API + scheduling engine
├── docker/nginx/      # Reverse proxy config
├── docs/              # Architecture & deployment docs
├── scripts/           # Setup helpers
└── .github/workflows/ # CI/CD
```

## Features

- Role-based access: Admin, Department Head, Faculty, Student, Scheduler
- Full CRUD for departments, faculty, students, courses, subjects, rooms, labs, sections, semesters
- Faculty availability, preferences, and leave management
- Automatic timetable generation with hard/soft constraints
- Manual drag-and-drop editing with live conflict detection
- Export to Excel / PDF / print-friendly view
- Admin dashboard with charts and activity feed
- Dark / light mode glassmorphism UI

## Quick Start (Local)

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- npm

### 1. Database

```bash
createdb smartsched
# or use Docker only for Postgres:
docker compose up -d postgres
```

### 2. Backend

```bash
cd backend
cp .env.development .env
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev
```

API: `http://localhost:5000`  
Swagger: `http://localhost:5000/api/docs`

### 3. Frontend

```bash
cd frontend
cp .env.development .env
npm install
npm run dev
```

App: `http://localhost:5173`

## Seed Credentials (CHARUSAT only)

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@charusat.edu.in | Admin@123 |
| Timetable Officer | timetable@charusat.edu.in | Scheduler@123 |
| HOD (CE) | hod.ce@charusat.edu.in | Head@1234 |
| Professor | rahul.verma.ce@charusat.edu.in | Faculty@123 |
| Student | 23ce001@charusat.edu.in | Student@123 |

## Docker

```bash
docker compose up --build -d
```

- App: `http://localhost`
- API: `http://localhost/api/v1`
- Docs: `http://localhost/api/docs`

## Environment Variables

See `backend/.env.example` and `frontend/.env.example`.

Critical backend vars:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`
- `FRONTEND_URL`
- `SCHEDULER_MAX_ITERATIONS` / `SCHEDULER_POPULATION_SIZE`

## Scheduling Engine

1. Expand course offerings into session requests (theory hours + multi-slot labs)
2. Priority queue: labs and hard subjects first
3. Greedy assignment with hard constraint filtering
4. Limited-depth backtracking on failure
5. Optional genetic polish (crossover / mutation / fitness)
6. Persist entries, score, and detected conflicts

Hard constraints include faculty/room/lab/section clashes, lunch, working days, capacity, availability, and daily faculty limits.

## API Overview

Base path: `/api/v1`

- `POST /auth/login` `POST /auth/register` `POST /auth/refresh`
- `GET/POST /departments` `/faculty` `/students` `/courses` `/subjects` `/rooms` `/labs`
- `GET/POST /timetables` + entries, conflicts, export
- `POST /scheduler/generate` `POST /scheduler/optimize/:id`
- `GET /analytics/dashboard`

Full OpenAPI: `/api/docs`

## Deployment

Supported targets: Render, Railway, AWS, Azure, DigitalOcean, Ubuntu VPS.

Typical VPS flow:

1. Install Docker + Compose
2. Set production secrets in `.env.production`
3. `docker compose up -d --build`
4. Optionally run backend under PM2: `npm run start:pm2`

See `docs/DEPLOYMENT.md` for platform notes.

## Screenshots

> Placeholder — add UI screenshots of Dashboard, Timetable Grid, and Scheduler after first run.

## Testing

```bash
cd backend && npm test
cd frontend && npm test
```

## License

Proprietary — SmartSched University Timetable System.
