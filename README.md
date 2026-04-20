# rep — E-Commerce Platform

Full-stack e-commerce application built with FastAPI, React, PostgreSQL, and Redis.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript + TailwindCSS |
| Backend | FastAPI + SQLAlchemy 2 + Alembic |
| Database | PostgreSQL 16 |
| Cache / Queue | Redis 7 (Celery broker) |
| Payments | Stripe (test mode) |
| Reverse Proxy | Nginx |
| Containers | Docker + Compose |

---

## Local Development

```bash
# 1. Copy and fill in secrets
cp .env.example .env

# 2. Start all services
docker compose up --build

# 3. Open the app
open http://localhost
```

API docs available at `http://localhost/docs`.

---

## Deployment Guide

### Architecture (production)

```
Vercel (SPA)  →  Render Web Service (FastAPI)  →  Neon (PostgreSQL)
                        │                       →  Upstash (Redis)
               Render Worker (Celery)
```

All services have **free tiers** that cover a demo/portfolio workload.

---

### Step 1 — PostgreSQL on Neon

Neon is free forever (512 MB, no 90-day expiry unlike Render's free DB).

1. Sign up at [neon.tech](https://neon.tech) and create a project named `rep`.
2. In the **Connection Details** panel, copy the **connection string**. It looks like:
   ```
   postgresql://rep_owner:PASSWORD@ep-xxx.us-east-2.aws.neon.tech/rep?sslmode=require
   ```
3. You will need **two variants** of this URL for the backend env vars:
   - `DATABASE_URL` — replace `postgresql://` with `postgresql+asyncpg://`
   - `DATABASE_URL_SYNC` — replace `postgresql://` with `postgresql+psycopg://`

   Example:
   ```
   DATABASE_URL=postgresql+asyncpg://rep_owner:PASSWORD@ep-xxx.us-east-2.aws.neon.tech/rep?sslmode=require
   DATABASE_URL_SYNC=postgresql+psycopg://rep_owner:PASSWORD@ep-xxx.us-east-2.aws.neon.tech/rep?sslmode=require
   ```

---

### Step 2 — Redis on Upstash

Upstash is free (10,000 commands/day, 256 MB). TLS is required.

1. Sign up at [upstash.com](https://upstash.com), create a **Redis** database (region: closest to your Render region).
2. Go to **Details → Connect** → copy the **Redis URL**. It looks like:
   ```
   rediss://default:PASSWORD@caring-corgi-12345.upstash.io:6380
   ```
3. You will set three env vars from this single URL:
   ```
   REDIS_URL=rediss://default:PASSWORD@HOST:6380
   CELERY_BROKER_URL=rediss://default:PASSWORD@HOST:6380/1
   CELERY_RESULT_BACKEND=rediss://default:PASSWORD@HOST:6380/2
   ```

---

### Step 3 — Backend on Render

Render supports Docker deploys directly from GitHub. The free Web Service sleeps after 15 minutes of inactivity (cold start ~30s).

#### 3a. Create the Web Service

1. Go to [render.com](https://render.com) → **New → Web Service**.
2. Connect your GitHub repo (`Suneethk16/rep`).
3. Settings:
   - **Root Directory**: `backend`
   - **Environment**: `Docker`
   - **Region**: Choose one close to your Neon/Upstash region
   - **Instance Type**: `Free`

4. Under **Environment Variables**, add every variable from the table below.

#### 3b. Backend environment variables

| Variable | Value |
|---|---|
| `APP_ENV` | `production` |
| `DEBUG` | `false` |
| `JWT_SECRET_KEY` | _(generate: `openssl rand -hex 32`)_ |
| `DATABASE_URL` | _(from Neon — asyncpg variant)_ |
| `DATABASE_URL_SYNC` | _(from Neon — psycopg variant)_ |
| `REDIS_URL` | _(from Upstash — base URL, no `/db` suffix)_ |
| `CELERY_BROKER_URL` | _(Upstash URL + `/1`)_ |
| `CELERY_RESULT_BACKEND` | _(Upstash URL + `/2`)_ |
| `CORS_ORIGINS` | `https://your-app.vercel.app` _(fill in after Step 4)_ |
| `STRIPE_SECRET_KEY` | `sk_test_...` |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | _(fill in after Step 6)_ |
| `STRIPE_CURRENCY` | `inr` |
| `FIRST_ADMIN_EMAIL` | _(optional, creates admin on first boot)_ |
| `FIRST_ADMIN_PASSWORD` | _(optional)_ |

5. **Start Command** (override Docker CMD — runs migrations then starts server):
   ```
   sh -c "alembic upgrade head && gunicorn app.main:app --worker-class uvicorn.workers.UvicornWorker --workers 2 --bind 0.0.0.0:8000"
   ```

6. Click **Create Web Service**. Render builds the Docker image and deploys.  
   Your backend URL will be: `https://rep-backend-xxxx.onrender.com`

#### 3c. Create the Celery Worker

1. **New → Background Worker** → same GitHub repo.
2. Settings:
   - **Root Directory**: `backend`
   - **Environment**: `Docker`
   - **Start Command**:
     ```
     celery -A app.workers.celery_app worker --loglevel=info --concurrency=2
     ```
3. Add the **same environment variables** as the Web Service (copy them).
4. Create — Celery connects to Upstash automatically.

---

### Step 4 — Frontend on Vercel

Vercel serves the Vite SPA as static files with CDN — no Docker needed.

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import `Suneethk16/rep`.
2. Settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

3. Under **Environment Variables**, add:

   | Variable | Value |
   |---|---|
   | `VITE_API_BASE_URL` | `https://rep-backend-xxxx.onrender.com` |
   | `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` |

4. Click **Deploy**.  
   Your frontend URL will be: `https://rep-xxxx.vercel.app`

5. **Go back to Render** and update `CORS_ORIGINS` to your Vercel URL:
   ```
   CORS_ORIGINS=https://rep-xxxx.vercel.app
   ```
   Then trigger a manual redeploy on the Render Web Service.

#### SPA routing on Vercel

Create `frontend/public/vercel.json` so that all routes serve `index.html`:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

---

### Step 5 — Stripe Webhook

Without a running Stripe CLI, configure the webhook in the Stripe Dashboard:

1. Go to [dashboard.stripe.com/test/webhooks](https://dashboard.stripe.com/test/webhooks).
2. **Add endpoint**:
   - URL: `https://rep-backend-xxxx.onrender.com/api/v1/payment/webhook`
   - Events to send: `payment_intent.succeeded`
3. Copy the **Signing secret** (`whsec_...`).
4. Update `STRIPE_WEBHOOK_SECRET` on Render and redeploy.

---

### Step 6 — Custom Domain (optional)

#### Vercel (frontend)
1. Vercel Dashboard → your project → **Settings → Domains**.
2. Add your domain (e.g., `shop.yourdomain.com`).
3. Vercel shows the CNAME record to add at your DNS provider.
4. TLS is provisioned automatically.

#### Render (backend)
1. Render Dashboard → your Web Service → **Settings → Custom Domain**.
2. Add `api.yourdomain.com`.
3. Add the CNAME at your DNS provider pointing to Render's DNS target.
4. Update `CORS_ORIGINS` on Render to include the new frontend domain if you changed it.

---

### Step 7 — File Uploads (limitation)

> **Important**: Render's free tier has an **ephemeral disk**. Product images and user avatars stored in `/app/uploads/` will be lost when the service restarts or sleeps.

For persistent uploads, migrate to [Cloudflare R2](https://developers.cloudflare.com/r2/) (free: 10 GB storage, 1 M write ops/month):

1. Create an R2 bucket in the Cloudflare dashboard.
2. Generate an API token with `Object Read & Write` permissions.
3. The `upload_service.py` currently writes to disk — replace with `boto3` pointing at the R2 S3-compatible endpoint:
   ```
   https://<ACCOUNT_ID>.r2.cloudflarestorage.com
   ```
4. Add env vars: `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.

This is not required for a demo/portfolio deployment where images are seeded once.

---

## Environment Variables Reference

### Backend (`.env` locally, Render env vars in production)

```env
APP_ENV=production
DEBUG=false
JWT_SECRET_KEY=<openssl rand -hex 32>

DATABASE_URL=postgresql+asyncpg://USER:PASS@HOST/DB?sslmode=require
DATABASE_URL_SYNC=postgresql+psycopg://USER:PASS@HOST/DB?sslmode=require

REDIS_URL=rediss://default:PASS@HOST:6380
CELERY_BROKER_URL=rediss://default:PASS@HOST:6380/1
CELERY_RESULT_BACKEND=rediss://default:PASS@HOST:6380/2

CORS_ORIGINS=https://your-frontend.vercel.app

STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CURRENCY=inr

FIRST_ADMIN_EMAIL=admin@example.com
FIRST_ADMIN_PASSWORD=changeme123
```

### Frontend (`.env.local` locally, Vercel env vars in production)

```env
VITE_API_BASE_URL=https://your-backend.onrender.com
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

---

## Deployment Checklist

- [ ] Neon database created and connection strings copied
- [ ] Upstash Redis created and URL copied
- [ ] Render Web Service deployed (backend)
- [ ] Render Background Worker deployed (Celery)
- [ ] Alembic migrations ran on first deploy (check Render logs)
- [ ] Vercel project deployed (frontend)
- [ ] `CORS_ORIGINS` updated on Render with Vercel URL
- [ ] `VITE_API_BASE_URL` set on Vercel with Render URL
- [ ] `frontend/public/vercel.json` committed (SPA routing)
- [ ] Stripe webhook endpoint created in Stripe Dashboard
- [ ] `STRIPE_WEBHOOK_SECRET` updated on Render
- [ ] Admin user created via `FIRST_ADMIN_EMAIL` / `FIRST_ADMIN_PASSWORD`
- [ ] Test checkout with Stripe card `4242 4242 4242 4242`

---

## Troubleshooting

**Backend returns 500 on startup**  
Check Render logs for `alembic upgrade head` errors. Usually a wrong `DATABASE_URL` format (`asyncpg` vs plain `postgresql`).

**CORS errors in browser**  
`CORS_ORIGINS` must exactly match the frontend origin including `https://` and no trailing slash. Redeploy backend after changing it.

**Stripe webhook signature verification fails**  
Ensure `STRIPE_WEBHOOK_SECRET` matches the signing secret shown for the specific endpoint in the Stripe Dashboard (not the API key).

**Redis connection refused**  
Upstash requires TLS — the URL must start with `rediss://` (double `s`). `CELERY_BROKER_URL` and `CELERY_RESULT_BACKEND` must also use `rediss://`.

**Vercel 404 on page refresh**  
`frontend/public/vercel.json` with the rewrite rule is missing or not committed.

**Images disappear after Render restart**  
Ephemeral disk — see Step 7 (Cloudflare R2) above.
