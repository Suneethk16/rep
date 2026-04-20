# Rep — E-commerce Platform

React + FastAPI + Postgres + Redis + Celery, served behind a single Nginx reverse proxy. The whole stack comes up with one command.

## Quick start

Prerequisites: Docker 24+ and Docker Compose v2 (`docker compose`, not the legacy `docker-compose`).

```bash
cp .env.example .env
# Edit .env and set JWT_SECRET_KEY — generate with: openssl rand -hex 32
docker compose up --build
```

That's it. Once healthchecks settle:

| URL                          | What                                   |
|------------------------------|----------------------------------------|
| http://localhost             | React SPA                              |
| http://localhost/api/v1/...  | FastAPI (through the reverse proxy)    |
| http://localhost/docs        | Swagger UI                             |
| http://localhost/healthz     | Edge health probe                      |

To run in the background: `docker compose up -d --build`.
To stop: `docker compose down`. To wipe the database too: `docker compose down -v`.

## Services

| Service         | Image / Build          | Purpose                                         |
|-----------------|------------------------|-------------------------------------------------|
| `nginx`         | `nginx:1.27-alpine`    | Public reverse proxy (only service exposed)     |
| `frontend`      | `./frontend`           | React SPA, served by its own internal nginx     |
| `backend`       | `./backend`            | FastAPI (Gunicorn + Uvicorn workers)            |
| `celery-worker` | `./backend`            | Async jobs (emails, invoices, reindex)          |
| `postgres`      | `postgres:16-alpine`   | Primary datastore                               |
| `redis`         | `redis:7-alpine`       | Cache (db 0), Celery broker (db 1), results (2) |

Only `nginx` binds a host port. Everything else talks over the internal `rep-net` network.

## Request flow

```
browser ──▶ nginx :80 ──┬──▶ frontend :80    (SPA static files)
                        ├──▶ backend  :8000  (/api/*, /docs, /openapi.json)
                        └──▶ (self)          (/healthz)
```

The SPA and the API are same-origin from the browser's perspective, so no CORS preflight is needed for same-site requests. `CORS_ORIGINS` in `.env` only matters if you point the SPA at a different API host.

## Data persistence

Two named volumes survive `docker compose down`:

- `postgres_data` — the Postgres data directory
- `redis_data` — Redis AOF file (cart, session, Celery state)

Nuke everything with `docker compose down -v`.

## Migrations

The `backend` container runs `alembic upgrade head` before starting Gunicorn. No manual step needed on first boot. To create a new migration during development:

```bash
docker compose exec backend alembic revision --autogenerate -m "describe change"
docker compose exec backend alembic upgrade head
```

## Common commands

```bash
# Tail logs for one service
docker compose logs -f backend

# Open a shell in the backend
docker compose exec backend bash

# Run the backend test suite
docker compose exec backend pytest

# Rebuild after dependency changes
docker compose build backend
docker compose up -d backend

# psql into the database
docker compose exec postgres psql -U rep -d rep
```

## Environment variables

All config lives in `.env` at the repo root. See [.env.example](.env.example) for the full list. The only required value is `JWT_SECRET_KEY`; everything else has a working default.

## Troubleshooting

- **Port 80 already in use.** Set `HTTP_PORT=8080` (or any free port) in `.env` and hit http://localhost:8080.
- **Backend stuck on "waiting for postgres".** The backend depends on a healthy Postgres; check `docker compose ps` — if Postgres is `unhealthy`, inspect `docker compose logs postgres`.
- **SPA loads but API calls 502.** Usually the backend is still running migrations on a fresh volume. Wait ~30s or tail `docker compose logs -f backend`.
- **Changed `.env` but nothing updated.** Compose only re-reads env on container recreate: `docker compose up -d --force-recreate`.
