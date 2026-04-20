# Complete Deployment Guide
### rep — FastAPI + React → Render + Vercel (Free Tier)

> **Who this is for**: Beginners with no prior DevOps experience.  
> Every single step is explained. Nothing is skipped.

---

## Table of Contents

1. [Overview & Architecture](#overview)
2. [Before You Start — Checklist](#before-you-start)
3. [Part A — Database (Neon PostgreSQL)](#part-a--database)
4. [Part B — Redis (Upstash)](#part-b--redis)
5. [Part C — Backend on Render](#part-c--backend-on-render)
6. [Part D — Frontend on Vercel](#part-d--frontend-on-vercel)
7. [Part E — Wire Frontend ↔ Backend](#part-e--wire-frontend--backend)
8. [Part F — Stripe Webhook](#part-f--stripe-webhook)
9. [Part G — Custom Domain (Optional)](#part-g--custom-domain-optional)
10. [Common Errors & Fixes](#common-errors--fixes)
11. [Full Environment Variable Reference](#full-environment-variable-reference)
12. [End-to-End Test Checklist](#end-to-end-test-checklist)

---

## Overview

```
Browser
  │
  ├── https://your-app.vercel.app   ← React SPA (Vercel, free)
  │       │ VITE_API_BASE_URL
  │       ▼
  └── https://rep-api.onrender.com  ← FastAPI (Render, free)
              │
              ├── Neon PostgreSQL   (free forever, 512 MB)
              ├── Upstash Redis     (free, 10K ops/day)
              └── Stripe Webhooks   (test mode)
```

**Why these platforms?**

| Platform | What it does | Free limits |
|---|---|---|
| **Vercel** | Hosts the React SPA | Unlimited static deploys |
| **Render** | Runs FastAPI + Celery | 1 free web service (sleeps after 15 min) |
| **Neon** | PostgreSQL database | 512 MB, no expiry |
| **Upstash** | Redis cache + queue | 10,000 commands/day, 256 MB |

> **Free tier note**: The Render free web service "sleeps" after 15 minutes of no traffic.  
> The first request after sleep takes ~30 seconds. This is normal for free tier.

---

## Before You Start

Make sure you have all of these ready before deploying:

- [ ] Your code is pushed to GitHub (`git push origin main`)
- [ ] You have your Stripe test keys (from [dashboard.stripe.com/test/apikeys](https://dashboard.stripe.com/test/apikeys))
- [ ] You have accounts (or will create them): GitHub, Neon, Upstash, Render, Vercel

Generate a secure JWT secret key now — you will need it in Step C:
```bash
openssl rand -hex 32
```
Copy the output (looks like: `b97be9ef53f89cc9...`). Save it somewhere.

---

## Part A — Database

**Service**: [neon.tech](https://neon.tech) (free forever, better than Render's free DB which expires in 90 days)

### A1. Create a Neon account

1. Go to [neon.tech](https://neon.tech).
2. Click **Sign Up** → sign in with GitHub (easiest).
3. Neon creates a default project automatically. You can use it.

### A2. Create the database

1. In the Neon dashboard, click **Create Project** (or use the default one).
2. Give it a name: `rep`
3. Choose a region closest to you (e.g., `US East` or `EU Frankfurt`).
4. Click **Create Project**.

### A3. Get the connection string

1. You are now on the project dashboard.
2. In the **Connection Details** panel (top-right area), click the **connection string** tab.
3. Make sure **Pooled connection** is **off** (toggle it off) — we use SQLAlchemy's own pooling.
4. Copy the connection string. It looks like:
   ```
   postgresql://rep_owner:AbCdEfGh@ep-cool-fog-123456.us-east-2.aws.neon.tech/rep?sslmode=require
   ```

### A4. Create two URL variants

You need the same URL in two formats — one for async code, one for sync Alembic migrations.

Take your Neon URL and create both:

**Async (for the app)** — replace `postgresql://` with `postgresql+asyncpg://`:
```
postgresql+asyncpg://rep_owner:AbCdEfGh@ep-cool-fog-123456.us-east-2.aws.neon.tech/rep?sslmode=require
```

**Sync (for Alembic migrations)** — replace `postgresql://` with `postgresql+psycopg://`:
```
postgresql+psycopg://rep_owner:AbCdEfGh@ep-cool-fog-123456.us-east-2.aws.neon.tech/rep?sslmode=require
```

Save both. You will paste them into Render in Part C.

---

## Part B — Redis

**Service**: [upstash.com](https://upstash.com) — serverless Redis, free tier.

### B1. Create an Upstash account

1. Go to [upstash.com](https://upstash.com).
2. Click **Sign Up** → use GitHub login.

### B2. Create a Redis database

1. In the Upstash console, click **Create Database**.
2. Settings:
   - **Name**: `rep-redis`
   - **Type**: `Regional` (not Global — Global costs money)
   - **Region**: Pick the same region as your Neon database
   - **TLS**: Make sure TLS is **enabled** (it is by default)
3. Click **Create**.

### B3. Get the Redis URL

1. Click on your new database name.
2. Scroll down to **Connect** section.
3. Click **Redis Client** tab.
4. Copy the URL that starts with `rediss://` (two `s` at the end — that means TLS). It looks like:
   ```
   rediss://default:AbCdEfGh123@caring-corgi-12345.upstash.io:6380
   ```

### B4. Create three URL variants

From this single URL, you need three env vars:

```
REDIS_URL=rediss://default:AbCdEfGh123@caring-corgi-12345.upstash.io:6380

CELERY_BROKER_URL=rediss://default:AbCdEfGh123@caring-corgi-12345.upstash.io:6380/1

CELERY_RESULT_BACKEND=rediss://default:AbCdEfGh123@caring-corgi-12345.upstash.io:6380/2
```

Notice: `CELERY_BROKER_URL` ends with `/1` and `CELERY_RESULT_BACKEND` ends with `/2`.  
These are separate Redis "database slots" — Redis supports up to 16 isolated namespaces (0–15).

---

## Part C — Backend on Render

**Service**: [render.com](https://render.com)

### C1. Create a Render account

1. Go to [render.com](https://render.com).
2. Click **Get Started for Free**.
3. Sign up with GitHub — this automatically links your GitHub account so Render can access your repos.

### C2. Create a new Web Service

1. In the Render dashboard, click **New +** (top right).
2. Select **Web Service**.
3. On the "Connect a repository" page:
   - You will see a list of your GitHub repos.
   - Find `rep` (or `Suneethk16/rep`) and click **Connect**.

   > If you don't see your repo, click **Configure account** and grant Render access to it.

### C3. Configure the Web Service

You will see a configuration form. Fill in **exactly** as follows:

| Field | Value |
|---|---|
| **Name** | `rep-backend` |
| **Region** | Same region as Neon and Upstash |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Environment** | `Docker` |
| **Instance Type** | `Free` |

> **Root Directory = `backend`** is critical. This tells Render to look for the `Dockerfile` inside the `backend/` folder, not the project root.

Leave **Build Command** and **Start Command** empty — Docker handles this.

### C4. Add Environment Variables

Scroll down to **Environment Variables** and click **Add Environment Variable** for each one below.

> Click **Add Environment Variable**, type the key, paste the value, repeat.

**Copy this table and fill in your values:**

| Key | Value | Notes |
|---|---|---|
| `APP_ENV` | `production` | Tells FastAPI it's in production mode |
| `DEBUG` | `false` | Disables debug output |
| `JWT_SECRET_KEY` | _(your `openssl rand -hex 32` output)_ | Must be at least 32 chars |
| `DATABASE_URL` | _(asyncpg URL from A4)_ | Starts with `postgresql+asyncpg://` |
| `DATABASE_URL_SYNC` | _(psycopg URL from A4)_ | Starts with `postgresql+psycopg://` |
| `REDIS_URL` | _(from B4 — base URL)_ | Starts with `rediss://` |
| `CELERY_BROKER_URL` | _(from B4 — with `/1`)_ | Starts with `rediss://` |
| `CELERY_RESULT_BACKEND` | _(from B4 — with `/2`)_ | Starts with `rediss://` |
| `CORS_ORIGINS` | `https://your-app.vercel.app` | **Update after Part D** |
| `STRIPE_SECRET_KEY` | `sk_test_...` | From Stripe dashboard |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_...` | From Stripe dashboard |
| `STRIPE_WEBHOOK_SECRET` | _(leave blank for now)_ | Fill in after Part F |
| `STRIPE_CURRENCY` | `inr` | Change to `usd` etc. if needed |
| `FIRST_ADMIN_EMAIL` | `admin@example.com` | Auto-creates admin account on boot |
| `FIRST_ADMIN_PASSWORD` | `Admin1234!` | Change this to something secure |

> **Tip**: For `CORS_ORIGINS`, put a placeholder like `https://placeholder.vercel.app` for now.  
> You will update it after Vercel gives you a real URL in Part D.

### C5. Deploy

1. Click **Create Web Service** at the bottom.
2. Render starts building your Docker image. This takes 3–5 minutes the first time.
3. Watch the **Logs** tab — you should see:
   ```
   INFO  [alembic.runtime.migration] Running upgrade  -> 0001_initial
   INFO  [alembic.runtime.migration] Running upgrade 0001_initial -> 0002_profile_addresses
   INFO  [alembic.runtime.migration] Running upgrade 0002_profile_addresses -> 0003_stripe_payment
   INFO  Application startup complete.
   ```
   The `alembic upgrade head` line means the database tables were created automatically.

4. Once the status shows **Live** (green dot), your backend is running.

### C6. Get your backend URL

At the top of the Web Service page, you will see:
```
https://rep-backend-xxxx.onrender.com
```
Copy this URL. You will use it in Part D and Part E.

### C7. Test the API

Open your browser and visit:
```
https://rep-backend-xxxx.onrender.com/docs
```

You should see the **Swagger UI** — an interactive list of all API endpoints. If this page loads, the backend is working correctly.

> If you see "Service Unavailable", wait 30 seconds — the container may still be starting.

### C8. Create the Celery Worker (optional but recommended)

Celery handles background jobs (order confirmation emails, etc.). Without it, those jobs just won't run — the main app still works.

If you want it:

1. In Render dashboard, click **New + → Background Worker**.
2. Connect the same `rep` GitHub repo.
3. Settings:
   - **Name**: `rep-celery`
   - **Root Directory**: `backend`
   - **Environment**: `Docker`
   - **Instance Type**: `Free`
4. Override the Docker start command. In **Docker Command** field:
   ```
   celery -A app.workers.celery_app worker --loglevel=info --concurrency=2
   ```
5. Add the **same environment variables** as the Web Service (all of them).
6. Click **Create Background Worker**.

---

## Part D — Frontend on Vercel

**Service**: [vercel.com](https://vercel.com)

### D1. Create a Vercel account

1. Go to [vercel.com](https://vercel.com).
2. Click **Sign Up** → **Continue with GitHub**.
3. Authorize Vercel to access your GitHub account.

### D2. Import the project

1. In the Vercel dashboard, click **Add New… → Project**.
2. On the "Import Git Repository" screen, find `rep` and click **Import**.

### D3. Configure the project

Vercel tries to auto-detect the framework. You need to set it manually because the project root is a monorepo (frontend lives in a subfolder).

| Field | Value |
|---|---|
| **Framework Preset** | `Vite` |
| **Root Directory** | `frontend` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

To set Root Directory: click **Edit** next to "Root Directory" and type `frontend`.  
After changing the root directory, the other fields may auto-fill correctly.

### D4. Add Environment Variables

Click **Environment Variables** to expand that section. Add these two:

| Key | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://rep-backend-xxxx.onrender.com` _(your Render URL from C6)_ |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` _(your Stripe publishable key)_ |

> **Important**: `VITE_API_BASE_URL` must be the full URL including `https://` and **no trailing slash**.  
> ✅ `https://rep-backend-xxxx.onrender.com`  
> ❌ `https://rep-backend-xxxx.onrender.com/`  
> ❌ `rep-backend-xxxx.onrender.com`

### D5. Deploy

Click **Deploy**.

Vercel builds and deploys in about 1–2 minutes. You will see a success screen with a URL like:
```
https://rep-xxxx.vercel.app
```

Click **Visit** to open your live app.

### D6. Get your frontend URL

Copy the Vercel URL. You need to update Render with it now.

---

## Part E — Wire Frontend ↔ Backend

Now that both are deployed, you need to tell them about each other.

### E1. Update CORS on Render

The backend will refuse requests from the frontend unless you whitelist the Vercel domain.

1. Go to your Render Web Service → **Environment** tab.
2. Find `CORS_ORIGINS` and click **Edit**.
3. Replace the placeholder with your real Vercel URL:
   ```
   https://rep-xxxx.vercel.app
   ```
4. Click **Save Changes**.
5. Render automatically redeploys with the new value (takes ~1 minute).

### E2. Verify the connection

1. Open your Vercel app URL in the browser.
2. Try to register an account.
3. Open browser DevTools (F12) → **Network** tab.
4. Look for API calls to `rep-backend-xxxx.onrender.com` — they should return `200` or `201`, not `CORS error`.

### E3. Handle the Render cold start

First request after the service sleeps (15 min idle) takes ~30 seconds.  
Symptoms: the page loads but the login/register button spins for a long time, then works.  
This is normal on the free tier. Once the service wakes up, all subsequent requests are fast.

---

## Part F — Stripe Webhook

Without this, orders are only created via the polling endpoint (`GET /payment/order/{pi_id}`), which works fine for most cases. But registering the webhook makes the system fully reliable.

### F1. Add the webhook in Stripe Dashboard

1. Go to [dashboard.stripe.com/test/webhooks](https://dashboard.stripe.com/test/webhooks).
2. Click **Add endpoint**.
3. Fill in:
   - **Endpoint URL**: `https://rep-backend-xxxx.onrender.com/api/v1/payment/webhook`
   - **Events**: Click **Select events** → search for and check `payment_intent.succeeded`
4. Click **Add endpoint**.

### F2. Copy the signing secret

1. Click on the webhook endpoint you just created.
2. Under **Signing secret**, click **Reveal** and copy the value. It starts with `whsec_`.

### F3. Update Render

1. Render Web Service → **Environment** tab.
2. Find `STRIPE_WEBHOOK_SECRET` and click **Edit**.
3. Paste the `whsec_...` value.
4. Click **Save Changes** and wait for redeploy.

---

## Part G — Custom Domain (Optional)

### G1. Custom domain on Vercel (frontend)

1. Vercel dashboard → your project → **Settings → Domains**.
2. Type your domain (e.g., `shop.yourdomain.com`) and click **Add**.
3. Vercel shows you a CNAME record:
   ```
   CNAME  shop  cname.vercel-dns.com
   ```
4. Log in to wherever you bought your domain (GoDaddy, Namecheap, Cloudflare, etc.).
5. Find the **DNS settings** for your domain.
6. Add a CNAME record exactly as Vercel showed you.
7. DNS propagation takes 5–30 minutes. After that, Vercel provisions a free TLS certificate automatically.

After adding a custom domain, update `CORS_ORIGINS` on Render to use your custom domain:
```
https://shop.yourdomain.com
```

### G2. Custom domain on Render (backend)

1. Render Web Service → **Settings → Custom Domains**.
2. Click **Add Custom Domain**.
3. Type `api.yourdomain.com` and click **Save**.
4. Render shows you a CNAME record to add at your DNS provider.
5. Add it, wait for propagation.
6. Update `VITE_API_BASE_URL` on Vercel to `https://api.yourdomain.com` and redeploy frontend.

### G3. Auto-deploy on git push

Both Render and Vercel automatically redeploy when you push to `main`. This is already set up — no extra configuration needed.

To push changes:
```bash
git add .
git commit -m "your message"
git push origin main
```
Vercel redeploys in ~1 minute. Render redeploys in ~3 minutes.

---

## Common Errors & Fixes

### ❌ CORS Error in browser
**Symptom**: Browser console shows: `Access to fetch at '...' from origin '...' has been blocked by CORS policy`

**Causes and fixes**:

1. `CORS_ORIGINS` on Render is wrong or still the placeholder value  
   → Go to Render → Environment → update `CORS_ORIGINS` to your exact Vercel URL

2. `CORS_ORIGINS` has a trailing slash  
   → ❌ `https://rep.vercel.app/` → ✅ `https://rep.vercel.app`

3. You updated CORS_ORIGINS but Render hasn't redeployed yet  
   → Wait 1–2 minutes, or manually trigger a redeploy in Render

4. You're testing with `http://` but CORS requires `https://`  
   → Always use `https://` in the env var

---

### ❌ 404 on API calls
**Symptom**: All API requests return 404

**Causes and fixes**:

1. `VITE_API_BASE_URL` is wrong on Vercel  
   → Check Vercel → Settings → Environment Variables  
   → It must be the full Render URL: `https://rep-backend-xxxx.onrender.com`  
   → After fixing, redeploy the Vercel project

2. `VITE_API_BASE_URL` has a trailing slash  
   → ❌ `https://rep-backend-xxxx.onrender.com/` → ✅ `https://rep-backend-xxxx.onrender.com`

3. API path is wrong — double check by opening `/docs` on the backend URL  
   → Visit `https://rep-backend-xxxx.onrender.com/docs` in the browser  
   → If that loads, the backend is fine. The issue is with the frontend URL configuration.

---

### ❌ 500 Error on backend startup
**Symptom**: Render logs show an error and the service crashes on deploy

**Common causes**:

1. Wrong `DATABASE_URL` format  
   → Must start with `postgresql+asyncpg://` not just `postgresql://`

2. Neon requires `?sslmode=require` at the end of the URL  
   → ✅ `postgresql+asyncpg://user:pass@host/db?sslmode=require`

3. Redis URL must use `rediss://` (with TLS) for Upstash  
   → ❌ `redis://` → ✅ `rediss://`

4. Missing required env var (`JWT_SECRET_KEY` is required and has no default)  
   → Check Render logs for: `ValidationError` or `field required`

---

### ❌ Page refresh gives 404 on Vercel
**Symptom**: App works when navigating through links, but hitting F5 on `/orders` gives "404 Not Found"

**Fix**: The file `frontend/public/vercel.json` must exist with this content:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```
This file already exists in your project. If you accidentally deleted it, recreate it and push.

---

### ❌ Database tables don't exist
**Symptom**: Backend logs show `relation "users" does not exist`

**Fix**: Alembic migrations should run automatically on startup (the start command includes `alembic upgrade head`).  
If they didn't run:

1. Check Render logs for any Alembic error
2. Common cause: `DATABASE_URL_SYNC` is missing or wrong (Alembic uses the sync URL)
3. Make sure `DATABASE_URL_SYNC` starts with `postgresql+psycopg://`

---

### ❌ Build fails on Render
**Symptom**: Render logs show `ERROR [build]` or Docker build fails

**Common causes**:

1. Wrong Root Directory — make sure it is set to `backend`, not the repo root
2. `requirements.txt` is missing a package
3. Python version mismatch — the Dockerfile uses Python 3.12, which is fine on Render

---

### ❌ Build fails on Vercel
**Symptom**: Vercel shows "Build failed"

**Common causes**:

1. Root Directory not set to `frontend`  
   → Vercel → Project Settings → General → Root Directory → set to `frontend`

2. TypeScript errors stop the build  
   → Check the Vercel build log for red error lines  
   → Fix the TS errors locally (`npm run typecheck`), then push

3. Missing env var at build time  
   → `VITE_*` variables must be set in Vercel's **Environment Variables** before deploying  
   → After adding/changing env vars, trigger a redeploy manually

---

### ❌ Stripe payment fails silently
**Symptom**: Payment appears to succeed but no order is created

**Fix**: `STRIPE_WEBHOOK_SECRET` is wrong or missing.  
1. Check Part F again.  
2. The app will still work via the polling endpoint, but the webhook is more reliable.

---

### ❌ Images disappear after Render restart
**Symptom**: Product images and profile avatars vanish after Render's service restarts

**Reason**: Render's free tier does not have persistent disk storage.  
Uploaded files at `/app/uploads/` are lost when the container restarts.

**Short-term workaround**: Only use images you upload fresh after each restart (fine for demos).  
**Long-term fix**: See the Cloudflare R2 section in [README.md](README.md#step-7--file-uploads-limitation).

---

## Full Environment Variable Reference

### Backend (set in Render → Environment)

```env
# App
APP_ENV=production
DEBUG=false

# Auth
JWT_SECRET_KEY=<output of: openssl rand -hex 32>

# Database (Neon)
DATABASE_URL=postgresql+asyncpg://USER:PASS@HOST/DB?sslmode=require
DATABASE_URL_SYNC=postgresql+psycopg://USER:PASS@HOST/DB?sslmode=require

# Redis (Upstash)
REDIS_URL=rediss://default:PASS@HOST:6380
CELERY_BROKER_URL=rediss://default:PASS@HOST:6380/1
CELERY_RESULT_BACKEND=rediss://default:PASS@HOST:6380/2

# CORS — must match your Vercel URL exactly
CORS_ORIGINS=https://your-app.vercel.app

# Stripe (test mode)
STRIPE_SECRET_KEY=sk_test_51...
STRIPE_PUBLISHABLE_KEY=pk_test_51...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CURRENCY=inr

# Optional: auto-create admin on first boot
FIRST_ADMIN_EMAIL=admin@yourdomain.com
FIRST_ADMIN_PASSWORD=SecurePassword123!
```

### Frontend (set in Vercel → Settings → Environment Variables)

```env
# URL of your Render backend (no trailing slash)
VITE_API_BASE_URL=https://rep-backend-xxxx.onrender.com

# Stripe publishable key (safe to expose in frontend)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51...
```

---

## End-to-End Test Checklist

Run through these after deployment to confirm everything works:

- [ ] Open `https://rep-xxxx.vercel.app` — homepage loads with products (or empty state)
- [ ] Open `https://rep-backend-xxxx.onrender.com/docs` — Swagger UI loads
- [ ] Register a new account — no error, you get redirected
- [ ] Log in with the account — JWT token is stored, navbar shows your name
- [ ] Visit the product catalog — products load (or "no products" message)
- [ ] Add a product to cart (if products exist)
- [ ] Go to checkout — address form shows your saved addresses (or empty)
- [ ] Add an address and proceed to payment
- [ ] Use Stripe test card: `4242 4242 4242 4242`, any future date, any CVV
- [ ] Payment succeeds → Order Confirmation page shows order ID and items
- [ ] Visit `/orders` — the order appears in the list
- [ ] Log in as admin (`FIRST_ADMIN_EMAIL`) → `/admin` dashboard accessible
- [ ] Admin can add a product — upload an image and fill in details
- [ ] Refresh the page (`F5`) while on `/orders` — page loads correctly (no 404)

If all boxes are checked, the deployment is complete and working.

---

## Quick Reference — Key URLs

After deployment, bookmark these:

| URL | What it is |
|---|---|
| `https://rep-xxxx.vercel.app` | Your live frontend |
| `https://rep-backend-xxxx.onrender.com/docs` | Backend Swagger UI |
| `https://rep-backend-xxxx.onrender.com/health` | Backend health check |
| `https://rep-backend-xxxx.onrender.com/api/v1/openapi.json` | OpenAPI spec |
| `https://console.neon.tech` | Database console |
| `https://console.upstash.com` | Redis console |
| `https://dashboard.stripe.com/test/payments` | Stripe test payments |
