# Deployment Guide

## Docker Compose (recommended)

```bash
cp backend/.env.production backend/.env
# edit secrets
docker compose up -d --build
docker compose exec backend npx prisma db seed
```

## Ubuntu VPS

1. Install Docker Engine + Compose plugin
2. Clone repo, configure DNS to host
3. Place TLS termination on Nginx/Caddy in front of compose port 80
4. Use GitHub Actions `deploy.yml` to build on push to `main`

## Render / Railway

- Backend: Web Service from `backend/`, start `node dist/server.js`, add PostgreSQL addon
- Frontend: Static site from `frontend/dist` with `VITE_API_URL` pointing to API
- Run migrations as release command: `npx prisma migrate deploy`

## AWS / Azure / DigitalOcean

- Push images to ECR/ACR/DOCR
- Run Postgres managed service
- Deploy backend + frontend containers behind ALB/App Gateway/Load Balancer

## PM2 (bare metal Node)

```bash
cd backend
npm ci
npx prisma migrate deploy
npm run build
npm run start:pm2
```
