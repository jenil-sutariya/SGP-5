# SmartSched Architecture

## Overview

Feature-based modular monolith API with a React SPA client. PostgreSQL is the system of record. Prisma provides typed access and migrations.

## Backend layers

1. **Routes** — HTTP mapping, authz, validation
2. **Controllers** — request/response orchestration
3. **Services** — business logic
4. **Repositories / Prisma** — persistence
5. **Scheduler Engine** — pure algorithmic core (no HTTP)

## Frontend layers

1. **Pages** — feature screens
2. **Components** — UI + layout
3. **API** — Axios clients
4. **Store** — auth/theme (Zustand)
5. **Query** — server state (TanStack Query)

## Security

- Helmet, CORS, rate limiting, Zod validation
- Bcrypt password hashing (12 rounds)
- Short-lived JWT access + rotatable refresh tokens
- RBAC on every mutating route

## Scalability notes

- Stateless API (horizontal scale behind Nginx)
- Indexed FKs and unique composite keys for timetable integrity
- Cluster mode via PM2
- Async conflict detection after edits
