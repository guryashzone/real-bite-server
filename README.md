# real-bite-server

NestJS API for Real Bite (PostgreSQL 16 + PostGIS via Drizzle). Specs: [`docs/11-backend-mvp1.md`](../../docs/11-backend-mvp1.md) and [`docs/02-architecture.md`](../../docs/02-architecture.md).

## Quick start

```bash
cp .env.example .env
npm install
npm run db:up        # Postgres + PostGIS in Docker (needs Docker running)
npm run start:dev
curl localhost:3000/v1/health   # 200 when the DB is reachable, 503 otherwise
```

Scripts and conventions are in [CLAUDE.md](CLAUDE.md).
