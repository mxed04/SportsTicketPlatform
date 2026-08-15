# 🎟️ SportsTicketPlatform API — Phase 3 (Backend Implementation)

[![Python](https://img.shields.io/badge/Python-3.11-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111.0-009688.svg)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-5.0.6-DC382D.svg)](https://redis.io/)
[![Celery](https://img.shields.io/badge/Celery-Durable%20Task%20Queue-37814A.svg)](https://docs.celeryq.dev/)
[![Pytest](https://img.shields.io/badge/Tests-Pytest-0A9EDC.svg)](https://docs.pytest.org/)
![License](https://img.shields.io/badge/License-Academic%20Project-lightgrey.svg)

The Phase 3 deliverable turns the Phase 1 database design into a working RESTful backend: a **FastAPI** application that talks to **PostgreSQL** with raw SQL (no ORM, connection‑pooled via `psycopg2`), uses **Redis** as a cache‑aside speed layer for ticket search, a short‑lived store for OTP codes, a queue for sold-out-ticket waitlists, and an idempotency cache for payments, and runs reservation lifecycle management (payment reminders + auto‑cancellation) as durable **Celery** tasks backed by Redis.

**New in this revision** (confirmed directly against the full `app/routes/*.py` and `app/schemas/*.py` trees, plus `main.py`, `config.py`, `database.py`, `redis_client.py`, `security.py`, `rate_limiter.py`, and `requirements.txt`):
- Fuzzy "did you mean" ticket search (already documented last revision) is unchanged.
- **Dynamic surge pricing** on both ticket endpoints when remaining capacity runs low.
- **Per-endpoint rate limiting** (`slowapi`) on OTP requests and ticket search.
- **Idempotent payments** via a required `Idempotency-Key` header.
- **QR-code digital tickets** returned on successful payment.
- **A Redis-backed waitlist** for sold-out tickets, with a new `POST /api/reservations/waitlist` endpoint.
- **`POST /api/reservations/` now checks both `users.is_active` and `tickets.is_active`** — closing two long-open items from previous revisions (see §6).
- **A new `POST /api/auth/reset-password` endpoint.**

This document covers, for the backend service itself:

1. [How to set up and run the server](#1-setup--running-the-server)
2. [How to configure the database and Redis connections](#2-database--redis-configuration)
3. [The complete API reference, with input/output parameters](#3-complete-api-reference)
4. [How to test the APIs, with Postman and curl](#4-testing-the-apis)

Plus supporting sections: the automated `pytest` suite, an honest, revision-by-revision changelog of what's been fixed vs. what's still open, and the license.

---

## Table of Contents

1. [Setup & Running the Server](#1-setup--running-the-server)
   - [1.1 Prerequisites](#11-prerequisites)
   - [1.2 Option A — Run with Docker Compose (verified, recommended)](#12-option-a--run-with-docker-compose-verified-recommended)
   - [1.3 Option B — Run Locally (venv), Against Dockerized Postgres/Redis](#13-option-b--run-locally-venv-against-dockerized-postgresredis)
   - [1.4 Verifying the Server Is Up](#14-verifying-the-server-is-up)
2. [Database & Redis Configuration](#2-database--redis-configuration)
   - [2.1 Environment Variables](#21-environment-variables)
   - [2.2 PostgreSQL Connection Pooling](#22-postgresql-connection-pooling)
   - [2.3 Redis Client & Cache Keys](#23-redis-client--cache-keys)
   - [2.4 CORS Configuration](#24-cors-configuration)
   - [2.5 Background Job Processing (Celery)](#25-background-job-processing-celery)
   - [2.6 Database Schema Quick Reference](#26-database-schema-quick-reference)
   - [2.7 Rate Limiting](#27-rate-limiting)
3. [Complete API Reference](#3-complete-api-reference)
   - [3.1 System Health](#31-system-health)
   - [3.2 Authentication — `/api/auth`](#32-authentication--apiauth)
   - [3.3 Tickets & Locations — `/api/tickets`, `/api`](#33-tickets--locations--apitickets-api)
   - [3.4 Reservations & Waitlist — `/api/reservations`](#34-reservations--waitlist--apireservations)
   - [3.5 Payments & Cancellations — `/api/payments`](#35-payments--cancellations--apipayments)
   - [3.6 User Profile — `/api/user`](#36-user-profile--apiuser)
   - [3.7 Reports & Support — `/api/reports`](#37-reports--support--apireports)
   - [3.8 Admin Dashboard — `/api/admin`](#38-admin-dashboard--apiadmin)
4. [Testing the APIs](#4-testing-the-apis)
   - [4.1 Testing with Postman](#41-testing-with-postman)
   - [4.2 Testing with curl — Full User Journey](#42-testing-with-curl--full-user-journey)
5. [Automated Test Suite (pytest)](#5-automated-test-suite-pytest)
6. [Implementation Notes Worth Knowing](#6-implementation-notes-worth-knowing)
7. [License](#7-license)

---

## 1. Setup & Running the Server

### 1.1 Prerequisites

- Python 3.11+
- Docker + Docker Compose (recommended path — see §1.2) **or** a standalone PostgreSQL 16 instance and Redis v5+ instance reachable from your machine
- A running **Celery worker** process — required for reservation payment reminders and auto-cancellation to actually fire (see [§2.5](#25-background-job-processing-celery)); without it, `pending` reservations will never expire
- `pip`, if installing dependencies locally rather than via Docker

> ℹ️ **Confirmed from `requirements.txt` this revision:** three new dependencies have been added beyond what was previously documented — `qrcode==7.4.2` and `Pillow==10.3.0` (QR-code image generation for digital tickets, §3.5) and `slowapi==0.1.9` (per-endpoint rate limiting, §2.7). All three are pure add-ons pulled in automatically by `pip install -r requirements.txt` or the Docker build — no extra system packages or environment variables are required for any of them.

### 1.2 Option A — Run with Docker Compose (verified, recommended)

The repository's `docker-compose.yml` defines four services and is now the confirmed, working setup:

| Service | Image / Build | Container name | Port mapping | Waits for |
|---|---|---|---|---|
| `postgres_db` | `postgres:16-alpine` | `sports_ticket_postgres` | `5433:5432` (host:container) | — |
| `redis` | `redis:alpine` | `sports_ticket_redis` | `6379:6379` | — |
| `api` | built from `./backend` | `sports_ticket_api` | `8000:8000` | `postgres_db` and `redis` healthy |
| `celery_worker` | built from `./backend` (same image as `api`) | `sports_ticket_celery` | — (no exposed port) | `postgres_db` and `redis` healthy |

**1. Create a `.env` file** in the same directory as `docker-compose.yml` (both `api` and `celery_worker` load it via `env_file: .env`). Since these two services run *inside* the Compose network, use the **service names**, not `localhost`, and the **container-internal** ports:
```env
DB_HOST=postgres_db
DB_PORT=5432
DB_NAME=sports_ticket_db
DB_USER=postgres
DB_PASSWORD=<your_postgres_password>
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_DB=0
REDIS_URL=redis://redis:6379/0
JWT_SECRET_KEY=<a_long_random_secret>
```
> `redis://sports_ticket_redis:6379/0` (the hardcoded default in `app/core/celery_app.py`) also resolves correctly here, since Compose registers each service's `container_name` as a DNS alias on the same network in addition to its service name — but setting `REDIS_URL` explicitly in `.env` is clearer and doesn't depend on that container name staying unchanged.
>
> ⚠️ `postgres_db`'s actual password is set directly in `docker-compose.yml` (`POSTGRES_PASSWORD`) — don't commit a real production-grade secret there or in `.env` to a public repository. Change it before pushing if the current value is anything you use elsewhere.

**2. Bring everything up:**
```bash
docker compose up --build -d
```

**3. Database schema initialization is automatic on first boot.** `docker-compose.yml` mounts `./database/init.sh` to `/docker-entrypoint-initdb.d/01-init.sh` and `./database/scripts` to `/scripts` inside the `postgres_db` container. The official Postgres image automatically runs any script in `/docker-entrypoint-initdb.d/` the **first** time its data directory is empty — so a fresh `docker compose up` should already apply the Phase 1 schema (and whatever else `init.sh` runs from `/scripts`) with no manual step. This only happens once per `postgres_data` volume: if you need to re-run it (e.g., after changing the schema), remove the volume first with `docker compose down -v`.

**4. Check everyone's healthy:**
```bash
docker compose ps
docker compose logs -f api celery_worker
```

**5. Reaching Postgres/Redis from your host machine** (e.g., a GUI DB client) uses the **host-mapped** ports, which differ from the container-internal ones above: Postgres is on `localhost:5433` (not `5432`), Redis is on `localhost:6379` (unchanged).

To tear everything down (keeping data): `docker compose down`. To also wipe the database volume: `docker compose down -v`.

<details>
<summary>Fallback: running containers manually, without Compose</summary>

The backend's `Dockerfile` lives at `./backend/Dockerfile`, so build with that as context:
```bash
docker build -t sportsticket-api ./backend
```
Then run the API and a Celery worker against whatever Postgres/Redis you have reachable (adjust hosts/ports to your setup — `host.docker.internal` if they're on your host machine outside Docker, or join the same user-defined Docker network as an existing Postgres/Redis container):
```bash
docker run -d --name sportsticket_api -p 8000:8000 --env-file .env sportsticket-api

docker run -d --name sportsticket_celery_worker --env-file .env sportsticket-api \
  celery -A app.tasks.reservation_tasks.celery_app worker --loglevel=info
```
This path is mostly useful for debugging a single service in isolation — `docker compose up` above is the supported way to run the full stack.
</details>

### 1.3 Option B — Run Locally (venv), Against Dockerized Postgres/Redis

1. **Create and activate a virtual environment:**
   ```bash
   python -m venv venv
   # Windows
   venv\Scripts\activate
   # Linux / macOS
   source venv/bin/activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
   Confirmed present in the current `requirements.txt`: `celery>=5.3.0`, `qrcode==7.4.2`, `Pillow==10.3.0`, and `slowapi==0.1.9`, alongside the previously-documented pins (`fastapi==0.111.0`, `psycopg2-binary==2.9.9`, `redis==5.0.6`, `pyjwt==2.8.0`, `passlib[bcrypt]==1.7.4`, `bcrypt==3.2.2`, `pydantic==2.7.4`, `pydantic-settings==2.3.4`, `python-multipart==0.0.9`, `pytest==8.2.2`, `httpx==0.27.0`, `python-jose[cryptography]==3.3.0`). The previously-noted duplicate `redis` line is gone — there's a single `redis==5.0.6` entry.

3. **Start just the database and cache containers** (skip `api`/`celery_worker` since you're running those locally instead):
   ```bash
   docker compose up -d postgres_db redis
   ```

4. **Create your `.env` file.** Because your API process and Celery worker now run *outside* Docker, use `localhost` and the **host-mapped** Postgres port (`5433`, not `5432` — see the port mapping table in §1.2):
   ```env
   DB_HOST=localhost
   DB_PORT=5433
   DB_NAME=sports_ticket_db
   DB_USER=postgres
   DB_PASSWORD=<your_postgres_password>
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_DB=0
   REDIS_URL=redis://localhost:6379/0
   JWT_SECRET_KEY=<a_long_random_secret>
   ```

5. **Launch the development server:**
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   The `--reload` flag is for development only; drop it in production.

6. **In a separate terminal, launch the Celery worker** — pointed at the module where the tasks are actually defined, not just where the Celery app object lives (see the note in [§2.5](#25-background-job-processing-celery) for why this specific module path matters):
   ```bash
   celery -A app.tasks.reservation_tasks.celery_app worker --loglevel=info
   ```
   Without this process running, `POST /api/reservations/` will still succeed, but the 13-minute reminder and 15-minute auto-cancellation will never execute — the tasks will just sit queued in Redis.

### 1.4 Verifying the Server Is Up

```bash
curl http://localhost:8000/
```

Expected response (`GET /`, no authentication required):
```json
{
  "app_name": "SportsTicketPlatform API",
  "database_connected": true,
  "redis_connected": true,
  "orm_used": false,
  "message": "Welcome to SportsTicketPlatform Backend!"
}
```

If `database_connected` or `redis_connected` come back `false`, double‑check your environment variables — the health check runs a real `SELECT 1 AS status;` against PostgreSQL and a real `PING` against Redis (via `check_redis_connection()` in `app/redis_client.py`, confirmed to just call `redis_client.ping()` inside a `try`/`except` that returns `False` on any error), so a `false` means the app genuinely can't reach that service.

Interactive API docs are also auto‑generated by FastAPI and available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

---

## 2. Database & Redis Configuration

### 2.1 Environment Variables

All configuration is centralized in `app/config.py` via `pydantic-settings`, loaded from a `.env` file. Variables without a listed default are **required** — the app will fail to start without them. Confirmed directly against the current `config.py`: this list is complete and unchanged from the previous revision — none of this revision's new features (surge pricing, rate limiting, idempotency, QR codes, waitlist) introduced any new `Settings` fields; every threshold for those features is hardcoded in the route code itself (see the relevant subsections below and §3).

| Variable | Default | Description |
|---|---|---|
| `APP_NAME` | `"SportsTicketPlatform API"` | Display name used in the FastAPI app title and health check response. |
| `DEBUG` | `True` | Debug flag (currently informational; not wired to FastAPI's `debug=`). |
| `PORT` | `8000` | Intended app port (Uvicorn's `--port` flag is what actually binds the port when running manually). |
| `DB_HOST` | — **required** | PostgreSQL host. |
| `DB_PORT` | — **required** | PostgreSQL port (typically `5432`). |
| `DB_NAME` | — **required** | Target database name. |
| `DB_USER` | — **required** | Database user. |
| `DB_PASSWORD` | — **required** | Database password. |
| `REDIS_HOST` | `"localhost"` | Redis host used by the FastAPI app's own client (`app/redis_client.py`) — now backing OTPs, the ticket search cache, the waitlist queues, and the payment idempotency cache (see §2.3). |
| `REDIS_PORT` | `6379` | Redis port for the same app client. |
| `REDIS_DB` | `0` | Redis logical database index for the same app client. |
| `JWT_SECRET_KEY` | — **required** | Symmetric secret used to sign and verify JWT access tokens. |
| `JWT_ALGORITHM` | `"HS256"` | JWT signing algorithm, read by `create_access_token()` in `security.py`. **Confirmed this revision:** `get_current_user_id()` (`reservations.py`) does **not** read this setting back — it hardcodes `algorithms=["HS256"]` when decoding. If you ever change `JWT_ALGORITHM` away from `HS256`, tokens would still be *signed* with the new algorithm but every protected route would start rejecting them as invalid, since decoding still only accepts `HS256`. See §6. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `120` | JWT access token lifetime. |
| `OTP_EXPIRE_SECONDS` | `120` | TTL for OTP codes stored in Redis. |
| `REDIS_URL` | `"redis://sports_ticket_redis:6379/0"` | Full Redis connection URL used as the Celery broker *and* result backend (`app/core/celery_app.py`). Read directly via `os.getenv()`, **not** through `app/config.py`/`pydantic-settings` like everything else above — so it won't show up if you only inspect the `Settings` class. |

> ⚠️ `REDIS_URL`'s default value (`redis://sports_ticket_redis:6379/0`) hardcodes the Redis container's `container_name` from `docker-compose.yml` — it resolves correctly when everything runs via `docker compose up` (Compose registers `container_name` as a DNS alias on the shared network), but **not** if you run the API or Celery worker outside Docker (e.g. the local venv steps in [§1.3](#13-option-b--run-locally-venv-against-dockerized-postgresredis)). In that case set `REDIS_URL` explicitly, e.g. `redis://localhost:6379/0`. Also note it's a separate value from `REDIS_HOST`/`REDIS_PORT`/`REDIS_DB` above; if your Redis instance isn't on `db 0`, or you change one, remember to update the other to match, since nothing keeps them in sync automatically.

A ready-to-copy template is provided in `.env.example`.

### 2.2 PostgreSQL Connection Pooling

There is **no ORM** in this project — every query in `app/routes/*.py` is raw SQL executed through a shared connection pool defined in `app/database.py`:

```python
db_pool = psycopg2.pool.ThreadedConnectionPool(
    minconn=1,
    maxconn=20,
    host=settings.DB_HOST,
    port=settings.DB_PORT,
    dbname=settings.DB_NAME,
    user=settings.DB_USER,
    password=settings.DB_PASSWORD,
)
```

Every route accesses the database through the `get_db_cursor()` context manager, which:
1. Checks out a connection from the pool
2. Yields a `RealDictCursor` (so rows come back as `dict`s keyed by column name, not tuples)
3. Calls `conn.commit()` automatically if the block completes without raising
4. Calls `conn.rollback()` if an exception is raised
5. Always returns the connection to the pool in a `finally` block

Confirmed directly against the current `database.py`: this is exactly what it still does, unchanged from the previous revision.

A few routes (`reservations`, `payments`, `admin`) call `cursor.connection.commit()` **explicitly mid-block** — this is intentional, used to durably commit a mutation (e.g. decrementing seat capacity) *before* invalidating the Redis cache, so a concurrent reader can never repopulate the cache with stale data. See [§6](#6-implementation-notes-worth-knowing) for why the ordering matters.

### 2.3 Redis Client & Cache Keys

`app/redis_client.py` creates a single process‑wide Redis client at import time:

```python
redis_client = redis.Redis(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    db=settings.REDIS_DB,
    decode_responses=True,
)
```

Redis now backs **five** distinct things in Phase 3 (two more than the previous revision — the waitlist queue and the payment idempotency cache are both new):

| Key pattern | Purpose | TTL | Set by | Cleared by |
|---|---|---|---|---|
| `otp:{phone_number}` | One-time login/signup/reset-password verification code | 120s (`OTP_EXPIRE_SECONDS`) | `generate_and_set_otp()` | `verify_otp()` on success, or natural expiry |
| `tickets:search:{sport_type}:{venue}:{min_price}:{max_price}:{team_name}:{ticket_tier}:{start_date}` | Cache-aside for `GET /api/tickets/search` results (including any `suggestions`) | 60s (hardcoded `ex=60`) | `search_tickets()` on a cache miss | `clear_ticket_cache()`, called after any reservation/payment/cancellation mutation |
| `user:profile:{user_id}` | Placeholder key for a per-user profile cache | N/A | *(not currently written anywhere)* | `invalidate_user_profile_cache()`, called after `PUT /api/user/profile` |
| `waitlist:{ticket_id}` | **New.** A Redis **list** of `user_id`s waiting for a sold-out ticket, oldest first | No TTL — persists until emptied | `add_to_waitlist()`, called from `POST /api/reservations/waitlist` (`RPUSH`) | `pop_from_waitlist()` (`LPOP`), called from `POST /api/payments/` (lazy-expiry path) and `POST /api/payments/cancel` |
| `payment_idempotency:{user_id}:{idempotency_key}` | **New.** Caches the full JSON response of a successful `POST /api/payments/` call, keyed per user *and* per client-supplied idempotency key | 24h (hardcoded `ex=86400`) | `process_payment()`, right before returning a successful response | Never explicitly deleted — only expires naturally after 24h |

Redis is a **disposable speed layer** for the search cache, OTPs, and the profile-cache placeholder — if it's flushed or unreachable, PostgreSQL remains the source of truth for those. **The waitlist queue is the one exception: it lives *only* in Redis, with no backing database table.** If Redis is flushed, every waitlist silently and permanently disappears with no way to recover it from PostgreSQL — worth knowing if you're relying on it for anything beyond a demo. The idempotency cache is also Redis-only, but that one is safe to lose: losing it just means a retried request with a previously-used key would be processed again as if new (see §3.5 and §6) rather than causing data loss.

### 2.4 CORS Configuration

`app/main.py` registers `CORSMiddleware` so browser-based frontends can call the API cross-origin. Confirmed unchanged from the previous revision:

```python
origins = [
    "http://localhost:3000",   # React / Next.js
    "http://127.0.0.1:3000",
    "http://localhost:5173",   # Vite (Vue/React)
    "http://127.0.0.1:5173",
    "http://localhost:8080",   # Vue CLI
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Only the five origins above are whitelisted (all methods and headers are allowed for those origins, and credentials/cookies/auth headers are permitted). If your frontend runs on a different host or port, add it to the `origins` list.

### 2.5 Background Job Processing (Celery)

Reservation lifecycle management (payment reminders and auto-cancellation) runs on **Celery**, using Redis as both the message broker and the result backend.

**`app/core/celery_app.py`** defines the shared Celery instance:
```python
REDIS_URL = os.getenv("REDIS_URL", "redis://sports_ticket_redis:6379/0")
celery_app = Celery("sports_ticket_worker", broker=REDIS_URL, backend=REDIS_URL)
```

**`app/tasks/reservation_tasks.py`** defines two independent tasks:

| Task | Scheduled via | Delay | Behavior |
|---|---|---|---|
| `send_payment_reminder_task` | `.apply_async(countdown=780)` | 13 minutes | If the reservation is still `pending`, logs a reminder. No-op otherwise. |
| `cancel_expired_reservation_task` | `.apply_async(countdown=900)` | 15 minutes | Re-checks status under `SELECT ... FOR UPDATE`; if still `pending`, sets it to `cancelled`, restores `remaining_capacity`, commits, and clears the ticket search cache. |

Both tasks are enqueued from `POST /api/reservations/` (`app/routes/reservations.py`) at reservation-creation time, each with its own independent `countdown` rather than one task sleeping through both windows. Confirmed directly from the current `reservations.py`, the calls are unchanged from the previous revision:
```python
send_payment_reminder_task.apply_async(
    args=[reservation["reservation_id"], user_id], countdown=780
)
cancel_expired_reservation_task.apply_async(
    args=[
        reservation["reservation_id"],
        user_id,
        data.ticket_id,
    ],
    countdown=900,
)
```

> ⚠️ **Not confirmed this revision:** `app/tasks/reservation_tasks.py` and `app/core/celery_app.py` themselves were **not** part of the files provided this round (only `app/routes/*.py`, `app/schemas/*.py`, and the core files listed at the top of §2 were reviewed). Everything in this section is therefore carried over from the previous revision's direct review, **except** for one new open question raised by this revision's waitlist feature (§2.3, §3.4): `POST /api/payments/` and `POST /api/payments/cancel` both now pop the next user off a ticket's waitlist and log a mock notification when a seat frees up — but it is **unconfirmed whether `cancel_expired_reservation_task` (the Celery-driven 15-minute auto-cancellation) does the same.** If it doesn't, a seat freed up by a *silent* auto-expiry (no one visited `/payments` to trigger the lazy check) would restock `remaining_capacity` without ever notifying anyone on the waitlist. Worth checking `reservation_tasks.py` directly to confirm one way or the other.

**Running the worker.** The verified command, taken directly from `docker-compose.yml`'s `celery_worker` service, points at the *tasks* module rather than `app/core/celery_app.py` itself:
```bash
celery -A app.tasks.reservation_tasks.celery_app worker --loglevel=info
```
This matters: `app/core/celery_app.py` only creates the `Celery(...)` instance — it doesn't import the task modules or call `celery_app.autodiscover_tasks()`. If you instead started the worker with `-A app.core.celery_app`, Celery would import *only* that module, `send_payment_reminder_task` and `cancel_expired_reservation_task` would never get registered with the worker, and every `apply_async()` call from `reservations.py` would enqueue a task the worker doesn't recognize. Pointing `-A` at `app.tasks.reservation_tasks` instead forces that module (and its `from app.core.celery_app import celery_app` import, and its two `@celery_app.task(...)`-decorated functions) to be imported at worker startup, which is what actually registers the tasks.

**Checking it's alive:**
```bash
celery -A app.tasks.reservation_tasks.celery_app inspect active    # currently-executing tasks
celery -A app.tasks.reservation_tasks.celery_app inspect reserved  # tasks queued for this worker
celery -A app.tasks.reservation_tasks.celery_app inspect registered  # confirms both tasks are actually registered
```

---

### 2.6 Database Schema Quick Reference

Full schema documentation (ER diagram, normalization notes, etc.) lives with the Phase 1 deliverable — this is just enough of the DDL to make sense of the values you'll see in Phase 3 API responses and the role-check caveat above. **Not part of this revision's file set** — nothing below has changed since the last direct `schema.sql` review; it's reproduced here for continuity.

**Custom ENUM types:**

| Type | Values | Backs column |
|---|---|---|
| `user_role` | `audience`, `support`, `admin` | `users.role` |
| `reservation_status` | `pending`, `paid`, `cancelled` | `reservations.status` |
| `payment_status` | `successful`, `failed`, `pending` | `payments.status` |
| `sport_type_enum` | `football`, `volleyball`, `basketball` | `tickets.sport_type` |

(`reports.status` is a plain `VARCHAR(50)`, not an ENUM — consistent with `PUT /api/admin/manage` accepting any non-empty string as `new_status` for a report, per §3.8.)

**Constraints worth knowing about, enforced at the database level (independent of the application code):**
- `reservations`: `CONSTRAINT check_reservation_dates CHECK (reserved_at < expires_at)` — a reservation's expiry can never be set before it was created.
- `payments.reservation_id` is `UNIQUE NOT NULL` — the database itself guarantees a reservation can never have more than one payment row, backing up the "already paid" check in `POST /api/payments/`.
- There is **no `tickets.total_capacity` (or similarly-named) column** — only `remaining_capacity` is stored per ticket. This matters for the surge-pricing feature in §3.3: the code has no per-ticket "how full is this venue" figure to work with, which is why it falls back to a single hardcoded constant for every ticket regardless of sport or venue size. See §3.3 and §6.

**Two tables have their own, same-named `is_active` column — don't conflate them:**
- **`users.is_active`** — defaults to `TRUE`. Read by `POST /api/auth/login`, `POST /api/payments/`, `GET /api/payments/cancellation-penalty/{reservation_id}` (and therefore `POST /api/payments/cancel`), and — **new and confirmed this revision** — `POST /api/reservations/` as well, which previously did not check it. All four now reject the caller with `403` if the account is deactivated. Nothing in the reviewed routes **writes** this column, so there is still no way to deactivate/suspend an account through the API; it can only be flipped directly in the database. See §3.2, §3.4, §3.5, and §6.
- **`tickets.is_active`** — a separate, unrelated column, also defaulting to `TRUE`. This is what the `"is_active": true` field in ticket search/detail responses (§3.3) reflects. `GET /api/tickets/search` filters on it (excludes `is_active = FALSE`, including from fuzzy suggestions); `GET /api/tickets/{ticket_id}` does not filter on it at all. **New and confirmed this revision:** `POST /api/reservations/` (`reserve_ticket()`) now also checks it directly — a ticket with `is_active = FALSE` is rejected with `400` at reservation time, closing the gap flagged in the previous revision. See §3.3, §3.4, and §6.

**Per-sport detail tables use different column names, which the API then unifies** — `football_details` has `stadium_name`, `stand_section`, and `ticket_type`, while `volleyball_details` and `basketball_details` both use `hall_name`, `seat_section`, and `ticket_tier` instead. `get_ticket_details()` (`tickets.py`) `LEFT JOIN`s all three detail tables on `ticket_id` and consolidates with `COALESCE(f.stadium_name, v.hall_name, b.hall_name) AS facility_name`, `COALESCE(f.stand_section, v.seat_section, b.seat_section) AS seat_section`, and `COALESCE(f.ticket_type, v.ticket_tier, b.ticket_tier) AS specific_ticket_tier`; `league_name`, `row_number`, `seat_number`, and `amenities` are consolidated the same way.

**Columns defined in the schema with no corresponding application logic:**
- **`reservations.cancelled_by_support_id`** — a nullable FK to `users.user_id`, evidently intended to record which support user cancelled a reservation on someone's behalf. None of the reviewed cancellation paths (`PUT /api/admin/manage`, `cancel_expired_reservation_task`, `POST /api/payments/cancel`) currently set it — it's left `NULL` even when a support user is the one performing the cancellation via `PUT /api/admin/manage`.

### 2.7 Rate Limiting

**New in this revision.** `app/rate_limiter.py` defines a single, shared `slowapi` `Limiter`:
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
```
`app/main.py` wires it into FastAPI:
```python
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

Exactly **two** endpoints in the entire API carry a rate limit, both confirmed directly from their route decorators:

| Endpoint | Limit | Keyed by |
|---|---|---|
| `POST /api/auth/otp` | `3/minute` | Client IP (`get_remote_address`) |
| `GET /api/tickets/search` | `20/minute` | Client IP (`get_remote_address`) |

No other route in `auth.py`, `tickets.py`, `reservations.py`, `payments.py`, `users.py`, `reports.py`, or `admin.py` carries a `@limiter.limit(...)` decorator.

**Exceeding a limit** triggers `slowapi`'s default `_rate_limit_exceeded_handler`. Verified directly by installing `slowapi==0.1.9` (the exact pinned version from `requirements.txt`) and inspecting its source: the handler returns **`429 Too Many Requests`** with a body of the form
```json
{ "error": "Rate limit exceeded: 3 per 1 minute" }
```
(the `20 per 1 minute` variant for ticket search). **`Limiter(...)` is constructed here with no `headers_enabled` argument, and that parameter defaults to `False`** — so, contrary to what you might expect from a rate-limiting library, **no `X-RateLimit-*` or `Retry-After` headers are added to the `429` response.** A client has to parse the error string (or just back off and retry after a minute) rather than read a machine-friendly header.

⚠️ **Worth knowing for anything beyond local testing:** `Limiter(key_func=get_remote_address)` is constructed with no `storage_uri`, so `slowapi`/`limits` defaults to **in-process, in-memory storage** — confirmed by inspecting the constructed `Limiter` instance directly (`_storage` is a `limits.storage.memory.MemoryStorage`). Two consequences:
1. **Counters reset on every API process restart.** A `--reload` during development, or a container restart in production, silently gives everyone a fresh quota.
2. **Counters are per-process, not shared.** If the API ever runs as more than one Uvicorn worker or more than one container replica (e.g. `docker compose up --scale api=3`, or a production deployment behind a load balancer), each process tracks its own independent count — the *effective* combined rate limit across all replicas is roughly `(number of replicas) × (stated limit)`, not the stated limit itself. Redis is already available in this stack and `slowapi` supports a Redis storage backend via `storage_uri="redis://..."` — worth switching to if the API is ever scaled beyond one process.

Also worth noting: `get_remote_address` reads the request's direct client IP (`request.client.host`). If this API is ever placed behind a reverse proxy or load balancer that doesn't forward/preserve the original client IP, every request could appear to originate from the proxy's IP, and the rate limit would effectively apply to *all* users combined rather than per-user. Not an issue for the current local/Docker-Compose setup, but worth a note for later.

---

## 3. Complete API Reference

**Base URL (local):** `http://localhost:8000`

**Authentication scheme:** `Bearer <JWT>` in the `Authorization` header, obtained from `/api/auth/signup` or `/api/auth/login`. Endpoints marked **🔒 Bearer JWT** require it; endpoints marked **🔒 Support/Admin** additionally require the authenticated user's `role` column to be `support` or `admin` (there is no API endpoint that grants these roles — they must be set directly in the database).

All request/response bodies are JSON **except** `POST /api/auth/login`, which is an OAuth2 form (`application/x-www-form-urlencoded`).

---

### 3.1 System Health

#### `GET /`
- **Auth:** None
- **Description:** Checks connectivity to both PostgreSQL (`SELECT 1 AS status;`) and Redis (`PING`).
- **Response `200`:**
  ```json
  {
    "app_name": "SportsTicketPlatform API",
    "database_connected": true,
    "redis_connected": true,
    "orm_used": false,
    "message": "Welcome to SportsTicketPlatform Backend!"
  }
  ```

---

### 3.2 Authentication — `/api/auth`

**JWT payload:** both `/api/auth/signup` and `/api/auth/login` sign a token containing `sub` (the user's `user_id`, as a string) **and** `role` (the user's `role` at the moment the token was issued). Only `sub` is actually read back anywhere in the reviewed routes — `get_current_user_id` (`app/routes/reservations.py`) extracts `sub` and nothing else. Every authorization check, including `verify_admin_or_support_role`, re-queries `users.role` from the database fresh rather than trusting the token's `role` claim.

> 🔍 **Confirmed this revision — two different JWT libraries are in play.** `security.py`'s `create_access_token()` signs tokens using **PyJWT** (`import jwt`, `pyjwt==2.8.0`). `reservations.py`'s `get_current_user_id()` decodes and verifies tokens using **python-jose** (`from jose import jwt, JWTError`, `python-jose[cryptography]==3.3.0`). Both libraries are HS256-compliant and interoperate fine here, so this isn't a bug — just worth knowing if you're debugging token issues, since "jwt" means a different package depending on which file you're reading.

#### `POST /api/auth/otp`
- **Auth:** None
- **Rate limit:** 3 requests/minute per client IP (see [§2.7](#27-rate-limiting)) — the 4th request within a minute from the same IP gets a `429`, not a `200`.
- **Description:** Generates a random 6-digit code and stores it in Redis under `otp:{phone_number}` with a 120-second TTL.
- **Request body:**
  | Field | Type | Rules |
  |---|---|---|
  | `phone_number` | string | Must match `^09[0-9]{9}$` (11-digit Iranian mobile number starting with `09`) |
  ```json
  { "phone_number": "09123456789" }
  ```
- **Response `200`:**
  ```json
  {
    "message": "OTP sent successfully",
    "expires_in": "120 seconds"
  }
  ```
  The OTP code is not returned in the JSON response. It's written to the server log at `INFO` level as `📩 MOCK SMS/EMAIL DELIVERY: OTP code for {phone_number} is {otp_code}`. During manual testing, check the terminal/server logs (or `docker logs`) to read the code. `app/email_sender.py` still contains a real SMTP-based OTP sender that isn't actually wired in — no real email or SMS is sent for this endpoint.
- **Errors:** `422` if `phone_number` fails the pattern validation · `429` if the per-IP rate limit is exceeded (see [§2.7](#27-rate-limiting)).

#### `POST /api/auth/signup`
- **Auth:** None
- **Description:** Verifies the OTP against Redis, hashes the password (bcrypt via Passlib), creates a new user with `role = 'audience'`, and returns a JWT.
- **Request body:**
  | Field | Type | Rules |
  |---|---|---|
  | `phone_number` | string | Pattern `^09[0-9]{9}$` |
  | `email` | string | Valid email address |
  | `password` | string | Minimum length 8 |
  | `otp_code` | string | Exactly 6 characters |
  | `first_name` | string | Minimum length 2 |
  | `last_name` | string | Minimum length 2 |
  | `city` | string | Minimum length 2 |
  ```json
  {
    "phone_number": "09123456789",
    "email": "test@example.com",
    "password": "StrongPassword123!",
    "otp_code": "123456",
    "first_name": "Ali",
    "last_name": "Rezaei",
    "city": "Tehran"
  }
  ```
- **Response `201`:**
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "message": "User registered successfully"
  }
  ```
- **Errors:** `400 Invalid or expired OTP code` · `400 User with this phone number or email already exists` · `422` validation error · `500 Database error: ...` for anything else, re-raising `HTTPException`s as-is first.

#### `POST /api/auth/login`
- **Auth:** None
- **Content-Type:** `application/x-www-form-urlencoded` (OAuth2 Password flow — **not JSON**)
- **Description:** Verifies phone number + password and returns a JWT. Confirmed directly from the current `auth.py`: the query selects `user_id, password_hash, role, is_active`, and the credential check runs **before** the account-status check — a nonexistent phone number or wrong password still short-circuits straight to `401` without ever evaluating `is_active`, so there's no way to distinguish "wrong password" from "account exists but is deactivated" through this endpoint's error alone.
- **Form fields:**
  | Field | Maps to |
  |---|---|
  | `username` | user's `phone_number` |
  | `password` | user's plaintext password |
- **Response `200`:**
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "message": "Login successful"
  }
  ```
- **Errors:**
  - `401 Incorrect phone number or password` (with a `WWW-Authenticate: Bearer` header, per OAuth2 convention).
  - `403 User account is deactivated. Please contact support.`, raised only after the password has already verified successfully, if `users.is_active` is `FALSE`.

  > ⚠️ **Correction:** both of the above error strings are slightly different from what an earlier revision of this document quoted. The wrong-credentials message is `"Incorrect phone number or password"`, not `"Invalid phone number or password"`; the deactivated-account message is `"User account is deactivated. Please contact support."`, not `"Your account has been deactivated. Please contact support."`. Verified directly against the current `auth.py` — treat the exact strings above as authoritative.

#### `POST /api/auth/reset-password` 🆕
- **Auth:** None
- **Description:** **New endpoint this revision.** Resets a forgotten password using an OTP, without requiring the old password. Confirmed directly in `auth.py`: verifies the supplied OTP against Redis first (same `verify_otp()` helper used by signup), then confirms a user with that phone number exists, then hashes the new password (same `get_password_hash()`/bcrypt path used everywhere else) and updates `users.password_hash`.
- **Request body** (`PasswordResetRequest`, from `app/schemas/auth.py`):
  | Field | Type | Rules |
  |---|---|---|
  | `phone_number` | string | Required, no pattern validation at the schema level (unlike `OTPRequest`/`UserSignup`, this field has no `pattern=` constraint — any string passes Pydantic validation; the query will simply find no matching user for a malformed number) |
  | `otp_code` | string | Required, no length constraint at the schema level (unlike `UserSignup.otp_code`, there's no `min_length`/`max_length=6` here) |
  | `new_password` | string | Minimum length 6 |
  ```json
  {
    "phone_number": "09123456789",
    "otp_code": "123456",
    "new_password": "NewStrongPassword456!"
  }
  ```
- **Response `200`:**
  ```json
  { "message": "Password has been reset successfully. You can now login." }
  ```
- **Errors:** `400 Invalid or expired OTP code` · `404 User with this phone number does not exist` · `500 Database error: ...`.
- **Note:** unlike `POST /api/auth/otp`, requesting the OTP that this endpoint consumes is itself rate-limited (3/minute — see §2.7), but `POST /api/auth/reset-password` itself carries no rate limit of its own.

#### `GET /api/auth/me/test-auth`
- **Auth:** 🔒 Bearer JWT (fully validated)
- **Description:** A diagnostic endpoint for confirming a token is valid and resolves to a real user. Depends on `get_current_user_id`, the same dependency used by every protected endpoint below.
- **Response `200`:**
  ```json
  { "message": "If you see this, you are authenticated. Your user_id is 3." }
  ```
  > ⚠️ **Correction:** the response shape changed from what an earlier revision of this document showed. It is **not** `{"message": "...", "user_id": 3}` (two separate fields) — `user_id` is only interpolated into the single `message` string. There is no standalone `user_id` field in the response body. Confirmed directly against the current `auth.py`.
- **Errors:** `401 Not authenticated` if no `Authorization` header is sent · `401 Invalid token` if the JWT decodes but has no `sub` claim · `401 Invalid or expired token format` if the token fails signature/expiry verification, or if `sub` can't be parsed as an integer (see the note on `get_current_user_id` in §3.4).

---

### 3.3 Tickets & Locations — `/api/tickets`, `/api`

> ℹ️ **File organization note:** `GET /api/cities-venues` (documented at the end of this section) lives in its own `app/routes/locations.py` router (`prefix="/api"`), not inside `tickets.py` — confirmed this revision. It's grouped here because it's still a locations/venues lookup conceptually, but it's a physically separate file from the two ticket endpoints above it.

#### `GET /api/tickets/search`
- **Auth:** None
- **Rate limit:** 20 requests/minute per client IP (see [§2.7](#27-rate-limiting)).
- **Description:** Multi-filter ticket search across football, volleyball, and basketball, backed by a 60-second Redis cache keyed on the exact combination of filters used. Only rows with `tickets.is_active = TRUE` are ever considered — this filter is baked into the base `SELECT` and applies to both the standard search and the fuzzy fallback described below.
- **Query parameters (all optional):**
  | Param | Type | Notes |
  |---|---|---|
  | `sport_type` | string | Exact match, e.g. `football`, `volleyball`, `basketball` |
  | `venue` | string | Partial, case-insensitive match on venue name |
  | `min_price` | float | `>= 0` |
  | `max_price` | float | `>= 0` |
  | `team_name` | string | Partial, case-insensitive match against home **or** away team |
  | `ticket_tier` | string | Partial, case-insensitive match, e.g. `VIP`, `Normal`, `Premium` |
  | `start_date` | string | `YYYY-MM-DD`; returns matches on/after this date |
  ```
  GET /api/tickets/search?sport_type=football&min_price=1000&ticket_tier=VIP
  ```
- **Response `200`:**
  ```json
  {
    "source": "database (PostgreSQL) 🐘",
    "count": 1,
    "tickets": [
      {
        "ticket_id": 12,
        "title": "Persepolis vs Esteghlal",
        "sport_type": "football",
        "home_team": "Persepolis",
        "away_team": "Esteghlal",
        "venue_name": "Azadi Stadium",
        "city": "Tehran",
        "ticket_tier": "VIP",
        "organizer": "Iran Football Federation",
        "match_date": "2026-09-15T18:00:00",
        "price": 1500000.0,
        "remaining_capacity": 42,
        "is_active": true,
        "is_surge_pricing": false
      }
    ],
    "suggestions": []
  }
  ```
  `source` reads `"cache (Redis) ⚡"` on a cache hit for the identical filter combination within 60 seconds — the cached payload preserves whatever `suggestions` were computed alongside the original `tickets` list, so a repeated misspelled query returns the same suggestions from cache without re-running the fuzzy query. `suggestions` is always an array (`[]` when there's nothing to suggest, per `TicketListResponse` in `app/schemas/tickets.py`), never omitted.

- **🆕 Dynamic surge pricing — new this revision, applies to every ticket in both `tickets` and `suggestions`:**
  Confirmed directly in `tickets.py`'s `format_ticket()` helper, which now runs for every row before it goes into the response:
  ```python
  base_price = float(item["price"])
  remaining = int(item["remaining_capacity"])
  total_capacity = 5000
  if remaining > 0 and remaining < (total_capacity * 0.20):
      item["price"] = round(base_price * 1.15, 2)
      item["is_surge_pricing"] = True
  else:
      item["price"] = base_price
      item["is_surge_pricing"] = False
  ```
  In plain terms: if a ticket has **fewer than 1,000 seats remaining** (and at least 1), its displayed `price` is bumped **+15%** and `is_surge_pricing` is `true`; otherwise the raw `tickets.price` is returned unchanged and `is_surge_pricing` is `false`.
  - ⚠️ **`total_capacity = 5000` is a single hardcoded constant applied to every ticket, regardless of sport, venue, or the ticket's actual real capacity.** There is no `tickets.total_capacity` (or equivalent) column in the schema (§2.6) — only `remaining_capacity` is stored — so the code has no per-ticket "how full is this venue" figure to work from and falls back to the same 5,000 threshold for a small volleyball hall and a full football stadium alike. A ticket type whose real total capacity is only, say, 800 seats would trigger "surge pricing" *immediately* on creation (800 < 1,000), while a football ticket with a real capacity of 50,000 wouldn't surge until it was already over 98% sold relative to its actual capacity. Worth deciding whether this is an intentional simplification for the academic scope or a gap to close with a real per-ticket capacity column.
  - ⚠️ **This surge-adjusted price is display-only — it is never what gets charged.** Confirmed by cross-referencing `payments.py`: `POST /api/payments/` reads the reservation's price with `SELECT ... t.price ... FROM reservations r JOIN tickets t ...`, i.e. the *raw* `tickets.price` column, completely independent of the surge calculation in `tickets.py`. The surge multiplier is computed fresh, in Python, at request time, and is **never written back to the database.** So a customer browsing search results might see a ticket at `57,500` (surged) but actually get charged `50,000` (base) at checkout — the numbers shown while browsing and the number actually charged can genuinely differ. See §3.5 and §6 for the full cross-reference.

- **🔁 Fuzzy fallback ("did you mean"):** unchanged from the previous revision. Triggered only when the exact/`ILIKE` search above returns 0 results *and* the request supplied `team_name` and/or `venue`. Uses `pg_trgm`'s `<->` trigram-distance operator, keeps candidates with distance `< 0.6`, returns at most 3, and — confirmed again this revision — only re-applies `is_active = TRUE` plus the team/venue match itself; every other filter (`sport_type`, price range, `ticket_tier`, `start_date`) is dropped for the fuzzy query, so a suggestion can come from a different sport or price bracket than the original search. Requires the `pg_trgm` extension to be enabled in Postgres (still unconfirmed whether `schema.sql`/`init.sh` does this — not part of this revision's file set either).
- **Errors:** `500 Database error: ...` (raw exception text included verbatim in the response — same minor info-disclosure pattern as before) · `429` if the per-IP rate limit is exceeded (see §2.7).

#### `GET /api/tickets/{ticket_id}`
- **Auth:** None
- **Description:** Full ticket detail. Joins the sport‑specific detail table (`football_details`, `volleyball_details`, or `basketball_details`, whichever has a matching row) and consolidates the fields with `COALESCE`. Does **not** filter on `tickets.is_active` — a deactivated ticket is still fully returned (with `"is_active": false`) if you already have its ID, even though it's invisible to `GET /api/tickets/search`.
- **🆕 Also carries the same dynamic surge-pricing logic as search** — confirmed in `get_ticket_details()`, byte-for-byte the same `total_capacity = 5000` / `remaining < 1000` / `+15%` calculation described above, applied to the single ticket being returned. The same caveats apply: the hardcoded capacity constant, and the fact that this price is display-only and not what `POST /api/payments/` actually charges.
- **Path parameter:** `ticket_id` (integer, `> 0`)
- **Response `200`:**
  ```json
  {
    "ticket_id": 12,
    "title": "Persepolis vs Esteghlal",
    "sport_type": "football",
    "home_team": "Persepolis",
    "away_team": "Esteghlal",
    "venue_name": "Azadi Stadium",
    "city": "Tehran",
    "ticket_tier": "VIP",
    "organizer": "Iran Football Federation",
    "match_date": "2026-09-15T18:00:00",
    "price": 1500000.0,
    "remaining_capacity": 42,
    "is_active": true,
    "is_surge_pricing": false,
    "league_name": "Persian Gulf Pro League",
    "facility_name": "Azadi Stadium",
    "seat_section": "B",
    "row_number": 14,
    "seat_number": 22,
    "specific_ticket_tier": "VIP",
    "amenities": "Covered seating, lounge access"
  }
  ```
- **Errors:** `404 Ticket not found` · `500 Database error: ...` (same raw-exception-message pattern; the `404` is correctly re-raised as-is via an `isinstance(e, HTTPException)` guard, not swallowed into a generic `500`).

#### `GET /api/cities-venues`
- **Auth:** None
- **Description:** Distinct cities and venues for **upcoming** matches only (`match_date > NOW()`). Lives in `app/routes/locations.py` (see the file-organization note above); functionally unchanged from the previous revision.
- **Response `200`:**
  ```json
  {
    "cities": ["Isfahan", "Shiraz", "Tehran"],
    "venues": ["Azadi Stadium", "Naghsh-e Jahan Arena"]
  }
  ```
- **Errors:** `500 Database error: ...`.

---

### 3.4 Reservations & Waitlist — `/api/reservations`

#### `POST /api/reservations/`
- **Auth:** 🔒 Bearer JWT
- **Description:** Reserves one seat on a ticket for 15 minutes. Runs under a row lock (`SELECT ... FOR UPDATE`) to prevent overselling under concurrent requests, decrements `remaining_capacity`, evicts the ticket search cache, and enqueues two independent, durable **Celery** tasks (`send_payment_reminder_task`, `cancel_expired_reservation_task`) — see [§2.5](#25-background-job-processing-celery).
- **🆕 Now checks BOTH `users.is_active` and `tickets.is_active` before allowing a reservation — this is new and closes two previously-open gaps (see §6, items 20/21/24/29 from the prior revision, now resolved).** Confirmed directly in the current `reservations.py`:
  1. `SELECT is_active FROM users WHERE user_id = %s;` — if the caller's account is deactivated, rejects with `403`.
  2. `SELECT remaining_capacity, is_active FROM tickets WHERE ticket_id = %s FOR UPDATE;` — if the ticket itself is deactivated, rejects with `400`, **before** the sold-out check.
- **Request body:**
  ```json
  { "ticket_id": 12 }
  ```
- **Response `201`:**
  ```json
  {
    "reservation_id": 101,
    "ticket_id": 12,
    "status": "pending",
    "message": "Ticket successfully reserved for 15 minutes.",
    "expires_at": "2026-08-03T21:15:00"
  }
  ```
- **Errors:**
  - `401 Invalid token` / `401 Invalid or expired token format` (JWT missing/invalid — see the note on `get_current_user_id` below).
  - `403 Your account has been deactivated.` — **new this revision.**
  - `404 Ticket not found`.
  - `400 This ticket is currently inactive and cannot be reserved.` — **new this revision**, checked before the sold-out check below.
  - `400 Ticket is sold out. Please join the waitlist.` — **wording changed this revision** (previously just `"Ticket is sold out"`); now points the caller at the new waitlist endpoint below.
  - `400 You already have an active reservation for this ticket` (blocks a second `pending`/`paid` reservation on the same ticket by the same user).

> 🔍 **Confirmed this revision: `get_current_user_id()` (`reservations.py`) now catches `ValueError` alongside `JWTError`.** Previously, `int(user_id)` (converting the token's `sub` claim to an integer) happened inside the `try` block but the `except` only caught `JWTError` — a token with a non-numeric `sub` would have raised an uncaught `ValueError`, surfacing as a raw `500`. The current code catches `except (JWTError, ValueError):` and returns a clean `401 Invalid or expired token format` in both cases. This closes the robustness gap flagged in the previous revision (see §6, item 28). A distinct `401 Invalid token` is still raised separately, inside the `try` block, specifically when the token decodes fine but has no `sub` claim at all.

#### `POST /api/reservations/waitlist` 🆕
- **Auth:** 🔒 Bearer JWT
- **Description:** **New endpoint this revision.** Joins the caller onto a Redis-backed waiting list for a ticket that's currently sold out. Confirmed directly in `reservations.py`:
  1. Looks up the ticket; `404` if it doesn't exist.
  2. `400` if the ticket is not active (`tickets.is_active = FALSE`).
  3. `400` if the ticket is **not actually sold out** (`remaining_capacity > 0`) — the message points the caller back to reserving it directly instead.
  4. Otherwise calls `add_to_waitlist(ticket_id, user_id)` (`app/redis_client.py`), which `RPUSH`es the user onto the `waitlist:{ticket_id}` Redis list (after checking they're not already in it) and returns their 1-indexed position (the queue's length right after joining).
- **Request body** (same shape as the reservation endpoint above):
  ```json
  { "ticket_id": 12 }
  ```
- **Response `200`:**
  ```json
  {
    "message": "Successfully joined the waiting list.",
    "ticket_id": 12,
    "your_position_in_queue": 3,
    "note": "We will notify you if a ticket becomes available."
  }
  ```
- **Errors:** `404 Ticket not found` · `400 Ticket is not active.` · `400 Ticket is not sold out yet! You can reserve it directly.` · `400 You are already in the waiting list for this ticket.`
- **What actually happens when a seat frees up:** confirmed from `payments.py` — when a `pending` reservation lazily expires during a payment attempt, or a `paid` reservation is cancelled via `POST /api/payments/cancel`, the code calls `pop_from_waitlist(ticket_id)` (`LPOP`, i.e. the *oldest* waiting user), looks up their phone number, and **prints a mock SMS notification to the server console** (`🔔 MOCK SMS: Hey {phone_number}, ticket_id {id} just opened up! Hurry!`) — there is no real SMS/push/email sent, and **no reservation is automatically created for that person**; they still have to call `POST /api/reservations/` themselves before someone else takes the seat. There is also no API endpoint to check your own waitlist position after joining, or to leave a waitlist voluntarily. See §2.5 for the open question of whether the Celery-driven 15-minute auto-cancellation path also does this waitlist pop (unconfirmed this revision, since `reservation_tasks.py` wasn't part of this file set).
- **Minor implementation note:** `add_to_waitlist()`'s duplicate check in `redis_client.py` tests both `str(user_id).encode("utf-8") in existing_users` and `str(user_id) in existing_users`. Since the shared Redis client is created with `decode_responses=True`, `redis_client.lrange(...)` always returns plain `str`s, never `bytes` — so the first half of that check can never actually match anything; only the second (`str(user_id) in existing_users`) does real work. Harmless, just slightly redundant code.

---

### 3.5 Payments & Cancellations — `/api/payments`

#### `POST /api/payments/`
- **Auth:** 🔒 Bearer JWT
- **🆕 Now requires an `Idempotency-Key` header — this is a breaking change to the request contract from the previous revision.** Confirmed directly in `payments.py`: the endpoint takes `idempotency_key: str = Header(..., alias="Idempotency-Key")` with no default, so a request missing this header now fails FastAPI's own validation with a `422`, before any of the handler's own logic even runs.
- **Description:** Pays for a `pending` reservation belonging to the caller.
  1. **Idempotency check first, before touching Postgres at all:** looks up `payment_idempotency:{user_id}:{idempotency_key}` in Redis. If present, returns that exact cached JSON response verbatim (same `payment_id`, same `qr_code`, same `paid_at` — nothing is re-processed or re-charged) — see §2.3.
  2. If not cached, checks the caller's own `users.is_active` and rejects with `403` if deactivated.
  3. If the 15-minute reservation window has already elapsed, auto-cancels the reservation, returns the seat to the pool, clears the search cache, **pops the ticket's waitlist and logs a mock notification if anyone is waiting** (new this revision — see §3.4), and fails the request with `400`.
  4. Otherwise inserts the `payments` row (using `tickets.price` — the **raw, un-surged** price; see the callout below), marks the reservation `paid`, generates a QR code, caches the response under the idempotency key for 24h, and returns `201`.
- **Headers:**
  | Header | Rules |
  |---|---|
  | `Idempotency-Key` | Required. Any non-empty string (a UUID is the intended usage, but nothing in the code enforces UUID format specifically). Scoped per-user: the same key from two different users' tokens is cached separately and does **not** collide. |
- **Request body:**
  | Field | Type | Rules |
  |---|---|---|
  | `reservation_id` | integer | `> 0` |
  | `payment_method` | string | Free text, non-empty (`min_length=1`), e.g. `"credit_card"` |
  ```json
  { "reservation_id": 101, "payment_method": "credit_card" }
  ```
- **Response `201`:**
  ```json
  {
    "payment_id": 55,
    "reservation_id": 101,
    "amount": 1500000.0,
    "status": "successful",
    "message": "Payment completed successfully. Ticket issued.",
    "paid_at": "2026-08-03T21:02:11",
    "qr_code": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
  }
  ```
  **🆕 `qr_code`** (new field, `PaymentResponse.qr_code`, nullable): a base64-encoded PNG, delivered as a ready-to-embed `data:image/png;base64,...` URI (confirmed via `qrcode` + `Pillow`, `io.BytesIO`, and `base64.b64encode` in `payments.py`). The QR code encodes a small JSON payload — `reservation_id`, `ticket_id`, `payment_id`, `amount`, and `paid_at` — that a gate scanner could presumably parse; there is no separate endpoint reviewed so far that validates/scans this QR code server-side, so what a venue would actually do with it beyond visual proof-of-payment is unconfirmed.
- **⚠️ Confirmed this revision: the `amount` charged (and encoded into the QR code) is the raw `tickets.price` column — never the surge-adjusted price shown by `GET /api/tickets/search` or `GET /api/tickets/{ticket_id}` (§3.3).** The two code paths are completely independent: `tickets.py` computes a `+15%` display price in Python and never persists it; `payments.py` reads `t.price` straight from the `tickets` table via its own `JOIN`. A customer who saw (and expected to pay) a surged price while browsing will actually be charged the lower base price at checkout. This also means the previous revision's note about price consistency ("no reviewed endpoint currently changes ticket prices post-creation, so this is theoretical for now") is now **partially superseded**: prices *displayed* to the user absolutely can differ from reservation to payment (via surge pricing turning on/off as `remaining_capacity` changes), even though the underlying `tickets.price` column itself still never changes. See §6.
- **Errors:** `422` if `Idempotency-Key` is missing (new this revision) · `403 Your account has been deactivated. You cannot make payments.` · `404 Reservation not found or does not belong to you` · `400 Reservation is already paid` · `400 Reservation has been cancelled` · `400 Reservation expired. Ticket returned to the pool.`

#### `GET /api/payments/cancellation-penalty/{reservation_id}`
- **Auth:** 🔒 Bearer JWT
- **Description:** Calculates the refund/penalty for cancelling an already-**paid** reservation, tiered by time remaining before the match. Before running the calculation, it checks the caller's `is_active` status and rejects with `403` if deactivated. Unchanged from the previous revision.
  | Time until match | Penalty |
  |---|---|
  | `< 24h` | 50% |
  | `24h – 72h` | 20% |
  | `> 72h` | 0% |
- **Path parameter:** `reservation_id` (integer, `> 0`)
- **Response `200`:**
  ```json
  {
    "reservation_id": 101,
    "match_date": "2026-09-15T18:00:00",
    "hours_until_match": 68.5,
    "penalty_percentage": 20,
    "penalty_amount": 300000.0,
    "refund_amount": 1200000.0
  }
  ```
  The `price` behind this calculation is, again, the raw `tickets.price` — not a surge-adjusted figure.
- **Errors:** `403 Your account has been deactivated. You cannot cancel tickets.` · `404 Reservation not found` · `400 Only 'paid' reservations can be cancelled` · `400 Match has already started. Cannot cancel.`

#### `POST /api/payments/cancel`
- **Auth:** 🔒 Bearer JWT
- **Description:** Cancels a paid reservation. Internally calls `calculate_cancellation_penalty()` directly as a plain function (not through FastAPI's dependency injection) to re-run the exact same ownership/status/`is_active` checks and penalty calculation described above, before re-fetching the reservation under a row lock (`SELECT status, ticket_id FROM reservations WHERE reservation_id = %s FOR UPDATE;`), re-checking `status != 'paid'`, flipping it to `cancelled`, restoring the seat, clearing the search cache, and — **new this revision** — popping the ticket's waitlist and logging a mock notification if anyone is waiting (see §3.4).
- **Request body:**
  ```json
  { "reservation_id": 101 }
  ```
- **Response `200`:**
  ```json
  {
    "message": "Ticket successfully cancelled.",
    "refund_amount": 1200000.0,
    "penalty_applied": 300000.0
  }
  ```
- **Errors:** Same as `GET /api/payments/cancellation-penalty/{reservation_id}`, plus `404 Reservation not found.` / `400 Reservation is not in 'paid' status.` from the second, row-locked check.
- **Caveat unchanged from before:** the row-locked re-check re-verifies `reservation_id` and `status` but does **not** re-filter by `user_id` — ownership is only confirmed once, in the earlier `calculate_cancellation_penalty()` call.

---

### 3.6 User Profile — `/api/user`

Unchanged this revision — confirmed against the current `users.py`, byte-for-byte the same logic as previously documented.

#### `GET /api/user/bookings`
- **Auth:** 🔒 Bearer JWT
- **Description:** Booking history for the current user, newest first, including payment status/amount where a payment exists.
- **Response `200`:**
  ```json
  [
    {
      "reservation_id": 101,
      "ticket_id": 12,
      "home_team": "Persepolis",
      "away_team": "Esteghlal",
      "match_date": "2026-09-15T18:00:00",
      "reservation_status": "paid",
      "payment_status": "successful",
      "amount_paid": 1500000.0,
      "reserved_at": "2026-08-03T20:45:00"
    }
  ]
  ```

#### `PUT /api/user/profile`
- **Auth:** 🔒 Bearer JWT
- **Description:** Partially updates the current user's `first_name`, `last_name`, and/or `city`. Invalidates the `user:profile:{user_id}` Redis key afterward.
- **Request body** (all fields optional, but at least one is required):
  ```json
  { "first_name": "Ali", "city": "Shiraz" }
  ```
- **Response `200`:**
  ```json
  { "message": "Profile updated successfully. Cache invalidated." }
  ```
- **Errors:** `400 No data provided to update` if the body is empty/all-null.

---

### 3.7 Reports & Support — `/api/reports`

Unchanged this revision — confirmed against the current `reports.py`.

#### `POST /api/reports/`
- **Auth:** 🔒 Bearer JWT
- **Description:** Submits a support/issue report, optionally tied to a ticket and/or reservation. Always created with `status = 'under_review'`.
- **Request body:**
  | Field | Type | Required |
  |---|---|---|
  | `category` | string | Yes |
  | `report_text` | string | Yes |
  | `ticket_id` | integer or `null` | No |
  | `reservation_id` | integer or `null` | No |
  ```json
  {
    "category": "Payment Issue",
    "report_text": "Money deducted but reservation failed.",
    "ticket_id": 10,
    "reservation_id": 101
  }
  ```
- **Response `201`:**
  ```json
  {
    "report_id": 7,
    "user_id": 3,
    "ticket_id": 10,
    "reservation_id": 101,
    "category": "Payment Issue",
    "report_text": "Money deducted but reservation failed.",
    "status": "under_review",
    "created_at": "2026-08-03T21:10:00"
  }
  ```

#### `GET /api/reports/`
- **Auth:** 🔒 Bearer JWT
- **Description:** Lists reports submitted by the current user only (not all users' reports — that's the admin endpoint below), newest first.
- **Response `200`:** Array of the same object shape as the `POST` response above.

---

### 3.8 Admin Dashboard — `/api/admin`

All three endpoints below share a single dependency, `verify_admin_or_support_role` (in `app/routes/admin.py`), which resolves the caller's `user_id` via the standard JWT check and then additionally requires `role` in `('admin', 'support')`, raising `403` otherwise.

#### `GET /api/admin/dashboard-stats`
- **Auth:** 🔒 Support/Admin (`role` must be `support` or `admin`)
- **Description:** Aggregated platform metrics. The exact SQL, confirmed directly from `admin.py` (not previously documented at this level of detail):
  ```sql
  SELECT
    (SELECT COALESCE(SUM(amount), 0) FROM payments
     WHERE status = 'successful' AND amount > 0) AS total_revenue,
    (SELECT COUNT(*) FROM payments
     WHERE status = 'successful' AND amount > 0) AS total_tickets_sold,
    (SELECT COUNT(*) FROM reservations
     WHERE status = 'cancelled') AS total_cancellations,
    (SELECT COUNT(*) FROM reports
     WHERE status = 'under_review') AS pending_reports;
  ```
  Note the `AND amount > 0` filter on both revenue and tickets-sold: a `successful` payment row with `amount = 0` (which the schema doesn't forbid — there's no `CHECK (amount > 0)` confirmed on `payments`, see §2.6) would count toward neither figure.
- **Response `200`:**
  ```json
  {
    "total_revenue": 48500000.0,
    "total_tickets_sold": 34,
    "total_cancellations": 5,
    "pending_reports": 2
  }
  ```
- **Errors:** `403 Access denied. Admin or Support role required.`

#### `GET /api/admin/tickets`
- **Auth:** 🔒 Support/Admin
- **Description:** All reservations across all users, joined with user and payment info — for fraud review and support triage. Unchanged this revision.
- **Response `200`:**
  ```json
  [
    {
      "reservation_id": 101,
      "user_id": 3,
      "first_name": "Ali",
      "last_name": "Rezaei",
      "phone_number": "09123456789",
      "ticket_id": 12,
      "venue_name": "Azadi Stadium",
      "match_date": "2026-09-15T18:00:00",
      "status": "paid",
      "payment_amount": 1500000.0
    }
  ]
  ```
- **Errors:** `403 Access denied. Admin or Support role required.`
- Still no `::text` cast on `r.status` in the query as provided — see §6, item 18 (unchanged, unresolved).

#### `PUT /api/admin/manage`
- **Auth:** 🔒 Support/Admin
- **Description:** Updates the status of a `report` or a `reservation` by ID. Unchanged this revision.
- **Request body:**
  | Field | Type | Rules |
  |---|---|---|
  | `entity_type` | string | `"reservation"` \| `"report"` |
  | `entity_id` | integer | `> 0` |
  | `new_status` | string | Non-empty. If `entity_type` is `"reservation"`, must additionally be one of `pending`/`paid`/`cancelled`. No such restriction for `"report"`. |
  ```json
  { "entity_type": "report", "entity_id": 7, "new_status": "resolved" }
  ```
- **Response `200`:**
  ```json
  { "message": "Report status updated to 'resolved' successfully." }
  ```
- **Errors:** `403 Access denied. Admin or Support role required.` · `404 {entity_type} not found in database.` · `400 Invalid status '{new_status}' for reservation. Allowed values: pending, paid, cancelled` (only when `entity_type` is `"reservation"`).

---

## 4. Testing the APIs

### 4.1 Testing with Postman

1. **Import the OpenAPI spec:** Postman → *File → Import* → select `postman/openapi.json`. This generates a full collection with every endpoint, matching this document exactly.
2. **Import the environment:** *File → Import* → select `postman/Local_Environment.json`. It defines two variables:
   | Variable | Value |
   |---|---|
   | `base_url` | `http://localhost:8000` |
   | `token` | *(empty — you fill this in after logging in)* |
3. **Select the "SportsTicket - Local" environment** from the dropdown in the top-right of Postman.
4. **Get a token:** run `POST {{base_url}}/api/auth/signup` (or `/login`, remembering it's a form-encoded body, not JSON — under the Body tab choose **x-www-form-urlencoded**, not raw JSON). Copy the `access_token` value from the response.
5. **Store the token:** paste it into the environment's `token` variable (or add a small **Tests** script on the login/signup request: `pm.environment.set("token", pm.response.json().access_token);` to automate this).
6. **Authorize protected requests:** on any protected endpoint, set the **Authorization** tab to `Bearer Token` and use `{{token}}` — or add an `Authorization: Bearer {{token}}` header manually.
7. **🆕 For `POST /api/payments/`, also set an `Idempotency-Key` header** (any unique string per attempt — Postman's `{{$guid}}` dynamic variable works well) or the request will fail with `422` before it even reaches the handler.

### 4.2 Testing with curl — Full User Journey

The sequence below exercises the entire ticket lifecycle end-to-end, including the features new this revision (surge pricing awareness, the required idempotency key, and the waitlist). It assumes `jq` is installed for parsing JSON, and `uuidgen` (pre-installed on macOS/Linux; on Windows use `powershell -Command "[guid]::NewGuid().ToString()"` or paste any unique string by hand) for generating idempotency keys.

```bash
BASE_URL="http://localhost:8000"

# 1. Health check
curl -s "$BASE_URL/" | jq

# 2. Request an OTP — rate-limited to 3/minute per IP (§2.7); the 4th
#    attempt within a minute returns 429, not 200.
#    Check your server's terminal/log output for a line like:
#    "📩 MOCK SMS/EMAIL DELIVERY: OTP code for 09123456789 is 123456"
curl -s -X POST "$BASE_URL/api/auth/otp" \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "09123456789"}' | jq
OTP="123456"   # paste the code you see in the server log

# 3. Sign up
TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{
    \"phone_number\": \"09123456789\",
    \"email\": \"test@example.com\",
    \"password\": \"StrongPassword123!\",
    \"otp_code\": \"${OTP}\",
    \"first_name\": \"Ali\",
    \"last_name\": \"Rezaei\",
    \"city\": \"Tehran\"
  }" | jq -r '.access_token')
echo "TOKEN: $TOKEN"

# --- Alternative: log in instead of signing up (note the form-encoded body) ---
# TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
#   -H "Content-Type: application/x-www-form-urlencoded" \
#   -d "username=09123456789&password=StrongPassword123!" | jq -r '.access_token')

# 4. Search for tickets — watch for "is_surge_pricing": true on
#    low-availability tickets (§3.3); rate-limited to 20/minute per IP.
curl -s "$BASE_URL/api/tickets/search?sport_type=football&min_price=1000" | jq

# 4b. Search with a misspelled team name to see the fuzzy "did you mean"
#     suggestions in action
curl -s "$BASE_URL/api/tickets/search?team_name=esteghal" | jq
# Expect: "count": 0 with a non-empty "suggestions" array

# 5. Get details for a specific ticket
curl -s "$BASE_URL/api/tickets/12" | jq

# 6. Reserve a ticket (requires Bearer token; now also checks
#    users.is_active and tickets.is_active — see §3.4)
RESERVATION_ID=$(curl -s -X POST "$BASE_URL/api/reservations/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ticket_id": 12}' | jq -r '.reservation_id')
echo "RESERVATION_ID: $RESERVATION_ID"

# 7. Pay for the reservation — an Idempotency-Key header is now REQUIRED.
#    Re-running this exact curl with the same $IDEMPOTENCY_KEY returns the
#    identical cached response (same payment_id, same qr_code) instead of
#    creating a second payment.
IDEMPOTENCY_KEY=$(uuidgen)
curl -s -X POST "$BASE_URL/api/payments/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d "{\"reservation_id\": $RESERVATION_ID, \"payment_method\": \"credit_card\"}" | jq
# Note: the response now includes a base64 "qr_code" data URI, and the
# charged "amount" is the ticket's RAW price — it will NOT reflect any
# surge pricing you may have seen in step 4/5 (see §3.5's callout).

# 7b. Prove idempotency: re-send the exact same request/key. Expect the
#     identical payment_id/paid_at/qr_code, and no new row in `payments`.
curl -s -X POST "$BASE_URL/api/payments/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d "{\"reservation_id\": $RESERVATION_ID, \"payment_method\": \"credit_card\"}" | jq

# 8. Check the cancellation penalty before cancelling
curl -s "$BASE_URL/api/payments/cancellation-penalty/$RESERVATION_ID" \
  -H "Authorization: Bearer $TOKEN" | jq

# 9. Cancel the paid reservation (also pops the ticket's waitlist, if any —
#    watch the server console for a "🔔 MOCK SMS" line)
curl -s -X POST "$BASE_URL/api/payments/cancel" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"reservation_id\": $RESERVATION_ID}" | jq

# 10. View booking history
curl -s "$BASE_URL/api/user/bookings" -H "Authorization: Bearer $TOKEN" | jq

# 11. Update profile
curl -s -X PUT "$BASE_URL/api/user/profile" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"city": "Shiraz"}' | jq

# 12. Submit a support report
curl -s -X POST "$BASE_URL/api/reports/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"category": "Payment Issue", "report_text": "Money deducted but reservation failed."}' | jq

# 13. List your own reports
curl -s "$BASE_URL/api/reports/" -H "Authorization: Bearer $TOKEN" | jq

# 14. Cities & venues with upcoming matches
curl -s "$BASE_URL/api/cities-venues" | jq

# 15. 🆕 Join the waitlist for a sold-out ticket. Replace 99 with a
#     ticket_id whose remaining_capacity is actually 0 in your database.
curl -s -X POST "$BASE_URL/api/reservations/waitlist" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ticket_id": 99}' | jq
# Expect: {"message": "Successfully joined the waiting list.", ...,
#          "your_position_in_queue": 1, ...}
# Trying to reserve ticket_id 12 (which had remaining_capacity > 0) with
# this endpoint instead would fail with:
#   400 "Ticket is not sold out yet! You can reserve it directly."

# 16. 🆕 Reset a forgotten password via OTP (no old password required)
curl -s -X POST "$BASE_URL/api/auth/otp" \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "09123456789"}' | jq
RESET_OTP="123456"   # from the server log again
curl -s -X POST "$BASE_URL/api/auth/reset-password" \
  -H "Content-Type: application/json" \
  -d "{\"phone_number\": \"09123456789\", \"otp_code\": \"${RESET_OTP}\", \"new_password\": \"AnotherStrongPass789!\"}" | jq
```

**Admin-only endpoints** (require a user whose `role` column is `support` or `admin` in the database — there's no signup flow for this, it must be set directly in PostgreSQL):

```bash
# Requires an admin/support-role JWT in $ADMIN_TOKEN
curl -s "$BASE_URL/api/admin/dashboard-stats" -H "Authorization: Bearer $ADMIN_TOKEN" | jq
curl -s "$BASE_URL/api/admin/tickets" -H "Authorization: Bearer $ADMIN_TOKEN" | jq
curl -s -X PUT "$BASE_URL/api/admin/manage" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"entity_type": "report", "entity_id": 1, "new_status": "resolved"}' | jq

# This one should return a clean 400, not a 500 (see §3.8)
curl -s -X PUT "$BASE_URL/api/admin/manage" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"entity_type": "reservation", "entity_id": 101, "new_status": "resolved"}' | jq
```

> Reminder: all three `/api/admin/*` endpoints require `role` in `('admin', 'support')` — `$TOKEN` from the earlier flow (an `audience` user) will get a `403` on all of them, as expected. `$ADMIN_TOKEN` above must belong to a user whose `role` was set to `support` or `admin` directly in the database.

**Testing account deactivation** (requires flipping a flag directly in the database, since there's no API endpoint for it):

```bash
# In psql (or your DB client of choice), deactivate the test user created above:
#   UPDATE users SET is_active = FALSE WHERE phone_number = '09123456789';

# Login should now fail with 403, not issue a token:
curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=09123456789&password=StrongPassword123!" | jq
# Expect: {"detail": "User account is deactivated. Please contact support."}

# If you still have a valid $TOKEN issued *before* deactivation, both
# reservations and payments now reject it:
curl -s -X POST "$BASE_URL/api/reservations/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ticket_id": 12}' | jq
# Expect: 403 "Your account has been deactivated." (new this revision)

curl -s -X POST "$BASE_URL/api/payments/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d "{\"reservation_id\": $RESERVATION_ID, \"payment_method\": \"credit_card\"}" | jq
# Expect: 403 "Your account has been deactivated. You cannot make payments."

# Re-activate afterward so the rest of the journey above still works:
#   UPDATE users SET is_active = TRUE WHERE phone_number = '09123456789';
```

---

## 5. Automated Test Suite (pytest)

Tests live alongside `conftest.py`, which wires up a `TestClient` fixture around the real FastAPI `app`:

```python
@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c
```

**Current coverage** (unconfirmed this revision — the test files themselves weren't part of this upload; reproduced from the last direct review):
- `test_auth.py` — confirms an unauthenticated reservation attempt is rejected with `401` and FastAPI's standard `"Not authenticated"` detail message.
- `test_tickets.py` — confirms `GET /api/tickets/search` returns `200` with the `tickets` / `count` / `source` keys, both unfiltered and with `sport_type`/`min_price` filters applied.

**Run the suite:**

```bash
# Locally
pytest -v --tb=short

# Inside a running Docker container
docker exec sportsticket_api python -m pytest -v
```

> These tests hit the real database/Redis configuration the app is started with (there's no mocking or test-database override in `conftest.py`), so run them against a database you're comfortable writing test data into. **None of this revision's new behavior appears to be covered yet**, assuming the two test files above are still current: the `is_active` checks on reservations, the fuzzy-search fallback, surge pricing, the required `Idempotency-Key` header, QR-code generation, the waitlist endpoint, rate limiting, or `POST /api/auth/reset-password`. Worth adding cases for at least the idempotency behavior and the waitlist flow, since those are the two with the most moving parts (Redis state that persists across requests).

---

## 6. Implementation Notes Worth Knowing

This section is a running, honest log of behaviors found while documenting the actual route/schema/task code provided at each revision. Items that have since been fixed are kept here (struck through) for traceability, rather than silently deleted.

### ✅ Fixed since the last revision

1. ~~`GET /api/admin/dashboard-stats` has no role check.~~ **Fixed.**
2. ~~`/api/auth/me/test-auth` doesn't validate the JWT.~~ **Fixed.**
3. ~~`entity_type: "ticket"` is accepted by validation but not implemented.~~ **Fixed.**
4. ~~OTPs are returned in the API response, not delivered.~~ **Partially fixed** — no longer returned in the response; still only logged, not really delivered (see item 22).
5. ~~Reservation expiry is lazy, not proactive.~~ **Fixed and upgraded** to durable Celery tasks.
6. ~~`otp_code` length constraint (5) vs. generated OTP length (6).~~ **Fixed.**
7. ~~No CORS middleware is currently configured.~~ **Fixed.**
8. ~~`GET /api/admin/tickets` fails with `500` on every call.~~ **Fixed.**
9. ~~The background reservation lifecycle task is in-process, not durable.~~ **Fixed** — now Celery-backed.
10. ~~`docker-compose.yml`'s `celery_worker` service and `requirements.txt`'s `celery` dependency were claimed but unverified.~~ **Verified — both confirmed present.**
11. ~~`redis` is listed twice in `requirements.txt`.~~ **Fixed** — confirmed a single `redis==5.0.6` line remains in the current `requirements.txt`.
12. ~~`python-jose[cryptography]` has no version pin.~~ **Fixed.**
13. ~~`role = 'admin'` cannot actually exist in the database.~~ **Fixed.**
14. ~~`PUT /api/admin/manage`'s `new_status` field had no enum validation.~~ **Fixed.**
15. ~~`POST /api/payments/cancel` has weaker concurrency guarantees than the other payment endpoints, and skips the `isinstance(e, HTTPException)` re-raise guard.~~ **Fixed.**
16. ~~`POST /api/payments/` returned the wrong error for a missing/foreign reservation.~~ **Fixed.**
17. ~~The two `is_active` checks in `payments.py` were locked inconsistently with each other.~~ **Fixed** — confirmed still consistent (plain, unlocked `SELECT`s) in the current `payments.py`.
20/21/24/29 (renumbered from the previous revision — see below). ~~`POST /api/reservations/` doesn't check `users.is_active` or `tickets.is_active`.~~ **Fixed this revision.** Confirmed directly in the current `reservations.py`: `reserve_ticket()` now runs `SELECT is_active FROM users WHERE user_id = %s;` (rejecting with `403` if deactivated) and includes `is_active` in its existing `FOR UPDATE` ticket lookup (rejecting with `400` if the ticket itself is inactive). This closes the long-standing inconsistency previously tracked across items 20, 21, 24, and 29 of earlier revisions. The one piece that's *still* inconsistent: `GET /api/tickets/{ticket_id}` still doesn't filter on `tickets.is_active` at all (§2.6, §3.3) — a deactivated ticket remains fully viewable by ID, it just can no longer be reserved.
28 (renumbered). ~~A malformed-but-validly-signed JWT could surface as a raw `500` instead of `401`.~~ **Fixed this revision.** `get_current_user_id()` now catches `except (JWTError, ValueError):` instead of just `except JWTError:`, so a token with a non-numeric `sub` claim now correctly returns `401 Invalid or expired token format` instead of an uncaught `ValueError` turning into a `500`.
33 (renumbered). ~~`app/schemas/auth.py`'s `PasswordResetRequest` model appears unused.~~ **No longer true.** `POST /api/auth/reset-password` (new this revision) now uses it directly. See §3.2.

### ⚠️ Correction to a previous revision of this document

- **The earlier claim that `app/schemas/auth.py` defines an unused `UserLogin` model does not hold up.** Having now reviewed the actual `auth.py` schema file directly on two separate occasions, it defines exactly five classes: `OTPRequest`, `UserSignup`, `OTPResponse`, `TokenResponse`, and `PasswordResetRequest` — there is no `UserLogin` class in it. This was an error in an earlier revision of this document (likely inherited from an assumption never actually checked against the file), not a finding about the codebase. Retracting it here rather than silently dropping it, in the interest of an honest changelog.

### 🔍 Claims from the changelog not fully verifiable from the files reviewed

18. **An explicit `::text` cast on `r.status`** in `GET /api/admin/tickets`, mentioned in an old changelog entry as fixing a Postgres `ENUM`-casting issue, still doesn't appear in the query — confirmed again this revision, unchanged from before. Worth a quick manual test against your actual database.

### ℹ️ Schema columns with no corresponding application logic

19. **`reservations.cancelled_by_support_id`** — a nullable FK to `users.user_id`, apparently meant to record which support user cancelled a reservation on someone's behalf. Confirmed unset across every cancellation path reviewed to date, including this revision's files: `PUT /api/admin/manage`, `cancel_expired_reservation_task`, and `POST /api/payments/cancel`.

### ℹ️ Still open

22. **`app/email_sender.py` is still not called anywhere.** Deliberate, documented decision (real SMTP/SMS delivery needs credentials that shouldn't be hardcoded into the repo). `app/routes/auth.py` still has a commented-out import/call ready for when that happens.
23. **There is still no API endpoint to deactivate or reactivate a user account.** `is_active` is enforced on read almost everywhere that matters now (signup/login/reservations/payments/cancellations), but it can only be toggled with a direct `UPDATE users SET is_active = ...` statement.
29. **`GET /api/tickets/search` and `GET /api/tickets/{ticket_id}` still disagree on whether `tickets.is_active` matters**, even after this revision's fix to `reserve_ticket()`: search excludes inactive tickets entirely; the detail-by-ID endpoint still returns them in full. A ticket deactivated via `is_active = FALSE` is therefore hidden from search, still fully viewable by ID, but — as of this revision — correctly blocked from being reserved. See §2.6 and §3.3.
31. **The `pg_trgm` fuzzy-search fallback's dependency on the `pg_trgm` Postgres extension being enabled is still unconfirmed** — `schema.sql`/`init.sh` weren't part of this revision's file set either. If it isn't enabled, the fallback query would 500.
32. **Both endpoints in `tickets.py` still return the raw exception string in their `500 Database error: ...` responses.** Minor information-disclosure note, unchanged.
34. **The mojibake (garbled Persian text) observed in a manual PowerShell test of the `organizer` field in an earlier revision is still believed to be a client-side (`Invoke-RestMethod`) encoding artifact, not a server bug** — not independently re-verified this revision, no new evidence either way.
35. **Whether `cancel_expired_reservation_task` (the Celery-driven 15-minute auto-cancellation) also pops the ticket's waitlist is unconfirmed.** `POST /api/payments/`'s lazy-expiry path and `POST /api/payments/cancel` both do (new this revision — see §3.4), but `app/tasks/reservation_tasks.py` wasn't part of this upload, so it's unknown whether a reservation that silently expires via Celery (no one ever hits `/payments`) also notifies the next person in line. If it doesn't, that's a real gap: the seat would be freed without anyone on the waitlist ever finding out.

### ℹ️ Other findings from `auth.py`, `payments.py`, `reservations.py`, schema files

25. **JWT tokens still carry a `role` claim that nothing reads back.** Signed by both `/api/auth/signup` and `/api/auth/login`; `get_current_user_id` only ever extracts `sub`. Every role check re-queries the database instead of trusting the token.
26. **`POST /api/payments/` still charges the ticket's current `tickets.price`, not a price locked in at reservation time** — and, confirmed this revision, definitely not the surge-adjusted price either (see item 30 and §3.3/§3.5). `reservations` has no price column at all.

### ℹ️ New findings from `tickets.py`, `app/schemas/tickets.py`

30. **New feature this revision: dynamic surge pricing, applied identically in `GET /api/tickets/search` and `GET /api/tickets/{ticket_id}`.** `+15%` on the displayed price whenever `0 < remaining_capacity < 1,000`, using a single hardcoded `total_capacity = 5000` constant for every ticket regardless of sport or venue (there's no real per-ticket total-capacity column to base this on — see §2.6). Confirmed this is purely a display-time calculation: it's never written back to `tickets.price`, and `POST /api/payments/` charges the raw, un-surged price. Net effect: what a customer sees while browsing and what they're actually charged at checkout can genuinely differ, in either direction, depending on how `remaining_capacity` moves between the two requests. Worth deciding whether this is intentional (surge pricing as a pure "act fast" nudge, with the real price locked at the ticket's base rate) or a bug where the charge should reflect the displayed price.

### ℹ️ New findings from `redis_client.py`, `security.py`, `rate_limiter.py`, `main.py`

36. **Two different JWT libraries are used for encode vs. decode.** `security.py` signs with PyJWT (`import jwt`); `reservations.py` verifies with python-jose (`from jose import jwt, JWTError`). Both are in `requirements.txt`. Functionally fine (both are HS256-compliant), but worth knowing so you don't go looking for `jwt.decode` behavior in the wrong package's docs.
37. **`get_current_user_id()` hardcodes `algorithms=["HS256"]` when decoding, rather than reading `settings.JWT_ALGORITHM`.** `create_access_token()` *does* read `settings.JWT_ALGORITHM` when signing. If `JWT_ALGORITHM` is ever changed away from the default `HS256` in `.env`, newly-issued tokens would be signed with the new algorithm but every protected route would immediately start rejecting them as invalid, since verification is hardcoded to only accept `HS256`. Not an issue as long as the setting is left at its default, but a latent trap if it's ever changed.
38. **The rate limiter (`slowapi`) is configured with in-memory storage, not Redis-backed, despite Redis being available and already used for everything else in this stack.** Counters reset on every process restart and are not shared across multiple worker processes or container replicas — see §2.7 for the full implication.
39. **`app/redis_client.py`'s `add_to_waitlist()` has a small piece of dead code**: it checks for an existing entry as both a `bytes`-encoded string and a plain `str`, but since the shared client is created with `decode_responses=True`, `lrange()` never returns `bytes` — only the plain-`str` branch of that check can ever match. Harmless, just redundant.

---

## 7. License

This repository is an **academic project**, developed as coursework for a database engineering / backend development course. It is shared publicly for portfolio and educational purposes only.

- No open-source license (e.g. MIT, Apache 2.0) is granted at this time.
- All rights to the source code are retained by the author.
- You're welcome to read, learn from, and reference this project; please don't reuse substantial portions of it for your own coursework submissions without permission.