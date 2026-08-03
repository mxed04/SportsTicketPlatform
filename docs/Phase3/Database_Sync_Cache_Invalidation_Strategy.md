# Database Synchronization & Cache Invalidation Strategy

**SportsTicketPlatform — Phase 3 Technical Documentation**

![Phase](https://img.shields.io/badge/Phase-3-blue) ![Stack](https://img.shields.io/badge/Stack-FastAPI%20%2B%20PostgreSQL%20%2B%20Redis-informational) ![Pattern](https://img.shields.io/badge/Pattern-Cache--Aside-success) ![ORM](https://img.shields.io/badge/ORM-None%20(Raw%20SQL)-lightgrey)

> This document describes how SportsTicketPlatform keeps its Redis cache layer consistent with the PostgreSQL source of truth. It is written directly against the current implementation (`app/config.py`, `app/database.py`, `app/redis_client.py`, and the route modules under `app/routes/`) and is intended to be appended to the project's phase documentation set.

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Centralized Configuration](#2-centralized-configuration)
3. [Cache-Aside Pattern — Ticket Search](#3-cache-aside-pattern--ticket-search)
4. [Core Cache Invalidation Primitives](#4-core-cache-invalidation-primitives)
5. [Invalidation Triggers Across the Application Layer](#5-invalidation-triggers-across-the-application-layer)
6. [Transaction Safety: Commit-Then-Invalidate](#6-transaction-safety-commit-then-invalidate)
7. [Data Flow Diagrams](#7-data-flow-diagrams)
8. [Cache Key Reference Table](#8-cache-key-reference-table)
9. [Known Limitations & Future Work](#9-known-limitations--future-work)
10. [File Reference Index](#10-file-reference-index)

---

## 1. System Architecture Overview

SportsTicketPlatform does not use an ORM. Every database interaction is a raw SQL statement executed through `psycopg2`, and every read-heavy endpoint sits in front of a **Redis cache-aside layer**. Three components cooperate on every request:

| Layer | Technology | Responsibility |
|---|---|---|
| **API** | FastAPI | Request validation (Pydantic schemas), routing, auth (JWT via `OAuth2PasswordBearer`), orchestration |
| **System of Record** | PostgreSQL, accessed via raw SQL (`psycopg2.pool.ThreadedConnectionPool`) | Durable, transactional storage of tickets, reservations, payments, and users |
| **Speed Layer** | Redis (`redis-py`, `decode_responses=True`) | Ephemeral cache for expensive search queries, OTP codes, and user profile reads |

```mermaid
flowchart LR
    subgraph L1[" 👤 Client Layer "]
        Client["Client / Frontend"]
    end

    subgraph L2[" ⚙️ Application Layer "]
        API["FastAPI Routes<br/>app/routes/*.py"]
    end

    subgraph L3[" 🗄️ Data Layer "]
        Redis[("⚡ Redis Cache")]
        PG[("🐘 PostgreSQL<br/>ThreadedConnectionPool")]
    end

    Client -->|"HTTP request"| API
    API -->|"1️⃣ check cache"| Redis
    API -->|"2️⃣ query on miss"| PG
    API -->|"3️⃣ populate on miss"| Redis
    API -->|"4️⃣ write + commit"| PG
    API -->|"5️⃣ invalidate on write"| Redis
    API -->|"response"| Client

    class Client client
    class API api
    class Redis cache
    class PG db

    classDef client fill:#EDE7F6,stroke:#5E35B1,stroke-width:2px,color:#311B92,font-weight:bold
    classDef api fill:#E3F2FD,stroke:#1565C0,stroke-width:2px,color:#0D47A1,font-weight:bold
    classDef cache fill:#FFF3E0,stroke:#EF6C00,stroke-width:2px,color:#E65100,font-weight:bold
    classDef db fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px,color:#1B5E20,font-weight:bold

    style L1 fill:#F3F0FA,stroke:#5E35B1,stroke-width:2px,color:#311B92
    style L2 fill:#EAF4FC,stroke:#1565C0,stroke-width:2px,color:#0D47A1
    style L3 fill:#FDF4E7,stroke:#EF6C00,stroke-width:2px,color:#E65100
```

The defining architectural rule of this system is:

> **PostgreSQL is always the source of truth. Redis is a disposable performance optimization.** If Redis were flushed entirely at any moment, the platform would continue to function correctly — just slower, until the cache warms back up. No business logic ever trusts Redis for a decision it cannot re-derive from PostgreSQL.

This is precisely why the invalidation strategy can be "coarse but correct" (e.g., wiping an entire search-cache namespace rather than surgically patching individual cached rows) — correctness matters more than cache-hit efficiency during write bursts.

---

## 2. Centralized Configuration

All environment-dependent values — database credentials, Redis connection parameters, JWT settings, and TTL thresholds — are declared in a single Pydantic settings object: `app/config.py`.

```python
class Settings(BaseSettings):
    ...
    # Redis Settings
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0

    # Security Settings (Tokens and OTP)
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    OTP_EXPIRE_SECONDS: int = 120

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )
```

### Why this matters for cache consistency

| Setting | Default | Role in the invalidation strategy |
|---|---|---|
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_DB` | `localhost` / `6379` / `0` | Resolved once at import time in `app/redis_client.py` to build the single shared `redis_client` instance used by every route module. There is exactly one Redis client for the whole process — no per-request client creation, no connection drift between the search cache, the OTP store, and the profile cache. |
| `OTP_EXPIRE_SECONDS` | `120` | Defines the **TTL contract** for one-time passwords. It is passed to `redis_client.setex()` inside `generate_and_set_otp()`, meaning Redis itself — not application code — enforces expiry. This guarantees an OTP can never be validated after its window closes, even if the verifying process crashes or is delayed. |
| `JWT_SECRET_KEY` / `ACCESS_TOKEN_EXPIRE_MINUTES` | — / `120` | Not part of the cache layer directly, but every write endpoint that triggers invalidation (`reserve_ticket`, `process_payment`, `cancel_ticket`, `update_profile`) is gated behind `get_current_user_id`, which decodes this JWT. Invalidation is therefore always scoped to an **authenticated** mutation. |

Centralizing these values means the TTL for search results (`ex=60`, hardcoded in `tickets.py`) and the TTL for OTPs (`OTP_EXPIRE_SECONDS`, configurable via `.env`) can evolve independently without touching connection logic — `Settings` is the single knob for environment-specific behavior, while cache *policy* (what gets cached, for how long) lives next to the query that produces the data.

> 💡 **Design note:** The 60-second search TTL is currently a literal in `tickets.py` rather than a `Settings` field. Promoting it to `TICKET_SEARCH_CACHE_TTL: int = 60` in `config.py` would let it be tuned per-environment (e.g., a shorter TTL in staging for faster iteration) without a code change — see [§9 Known Limitations](#9-known-limitations--future-work).

---

## 3. Cache-Aside Pattern — Ticket Search

The read path for `GET /api/tickets/search` in `app/routes/tickets.py` is the canonical cache-aside implementation in this codebase.

### 3.1 Cache key construction

The key is built deterministically from every query parameter, with explicit fallback tokens (`'all'`, `'0'`, `'inf'`) so that two logically-identical requests always hash to the same string:

```python
cache_key = (
    f"tickets:search:{sport_type or 'all'}:{venue or 'all'}:"
    f"{min_price or '0'}:{max_price or 'inf'}:"
    f"{team_name or 'all'}:{ticket_tier or 'all'}:"
    f"{start_date or 'all'}"
)
```

This produces keys such as:

```
tickets:search:football:all:0:inf:all:VIP:all
tickets:search:basketball:Azadi Stadium:50000:200000:all:all:2026-09-01
```

Every generated key is prefixed with the fixed namespace `tickets:search:`. This prefix is the single most important convention in the whole strategy — it is what allows **bulk, pattern-based invalidation** later (§4.1) without tracking every individual key that was ever created.

### 3.2 Request flow

```mermaid
sequenceDiagram
    autonumber
    participant C as 👤 Client
    participant A as ⚙️ FastAPI<br/>(tickets.py)
    participant R as ⚡ Redis
    participant P as 🐘 PostgreSQL

    C->>A: GET /api/tickets/search?sport_type=football...
    A->>A: build cache_key from query params
    A->>R: GET cache_key
    alt 🎯 Cache HIT
        R-->>A: JSON payload
        A-->>C: 200 OK — source: "cache (Redis) ⚡"
    else 🔍 Cache MISS
        R-->>A: nil
        A->>P: SELECT ... FROM tickets WHERE is_active = TRUE ...
        P-->>A: rows
        A->>A: serialize rows (isoformat dates, float price, title)
        A->>R: SET cache_key json_payload EX 60
        A-->>C: 200 OK — source: "database (PostgreSQL) 🐘"
    end
```

### 3.3 Why a 60-second TTL

Ticket search results change whenever `remaining_capacity` changes (a reservation or cancellation) or whenever an admin activates/deactivates a listing. Rather than trying to invalidate every possible combination of filters that could touch an affected row, the design leans on two complementary mechanisms:

1. **Time-based decay** — `ex=60` guarantees that even in the worst case (an invalidation event is somehow missed), no stale search result survives longer than one minute.
2. **Event-based eviction** — `clear_ticket_cache()` (§4.1) proactively wipes the *entire* search namespace the instant capacity changes, so in the common case staleness is measured in milliseconds, not seconds.

This is a deliberate **belt-and-suspenders** approach: TTL is the safety net, explicit invalidation is the fast path.

---

## 4. Core Cache Invalidation Primitives

All invalidation logic is centralized in `app/redis_client.py`, alongside the single shared `redis_client` instance. Route modules never call `redis_client.delete()` or `redis_client.scan_iter()` directly — they call one of the named functions below. This keeps the *policy* of "what a mutation invalidates" in one file, decoupled from the many places that trigger it.

### 4.1 Non-blocking bulk eviction — `clear_ticket_cache()`

```python
def clear_ticket_cache():
    """Delete cached ticket search queries from Redis.
    This ensures stale search results are not served from cache.
    """
    try:
        for key in redis_client.scan_iter("tickets:search:*"):
            redis_client.delete(key)
    except Exception as e:
        print(f"Redis cache clearing error: {e}")
```

**Why `SCAN` instead of `KEYS`:** `KEYS "tickets:search:*"` is O(N) over the *entire* keyspace and blocks the single-threaded Redis event loop until it finishes — under load, that stall is visible to every other client talking to Redis at that instant. `scan_iter()` wraps Redis's cursor-based `SCAN` command, which walks the keyspace incrementally in small batches. It trades a slightly higher total round-trip cost for **never blocking the server**, which is the correct trade-off for a cache that many concurrent requests depend on.

Because every ticket-search cache entry lives under the fixed `tickets:search:` prefix, this single function correctly invalidates *every* filter combination ever cached — the caller doesn't need to know which specific `sport_type`/`venue`/`price` combinations were affected by a given write.

> ⚠️ **Trade-off:** this is a coarse, namespace-wide flush, not a surgical per-row invalidation. A capacity change on one football match evicts cached search results for volleyball and basketball too. Given the short 60-second TTL and the relatively low write frequency of reservations compared to reads, this is an acceptable cost for the simplicity and correctness it buys — see [§9](#9-known-limitations--future-work).

### 4.2 Targeted eviction — `invalidate_user_profile_cache(user_id)`

```python
def invalidate_user_profile_cache(user_id: int):
    """Clearing the user profile cache when editing information"""
    redis_key = f"user:profile:{user_id}"
    redis_client.delete(redis_key)
```

Unlike the search cache, a user's profile cache key is **fully deterministic and single-valued** — there is exactly one cache entry per user (`user:profile:{user_id}`), so invalidation is a direct `DELETE` on one key rather than a namespace scan. This is the appropriate strategy whenever a cache key can be derived directly from a primary key already known at write time.

### 4.3 Self-deleting, time-boxed secrets — OTP lifecycle

```python
def generate_and_set_otp(phone_number: str) -> str:
    otp_code = str(random.randint(100000, 999999))
    redis_key = f"otp:{phone_number}"
    redis_client.setex(redis_key, 120, otp_code)
    return otp_code


def verify_otp(phone_number: str, user_otp: str) -> bool:
    redis_key = f"otp:{phone_number}"
    stored_otp = redis_client.get(redis_key)
    if stored_otp and stored_otp == user_otp:
        redis_client.delete(redis_key)  # prevent reuse
        return True
    return False
```

The OTP flow is the one place in the codebase where Redis is not a *cache* of PostgreSQL data at all — it is the **primary, authoritative store** for a short-lived secret that never touches PostgreSQL. Two independent expiry mechanisms are stacked:

- **Passive expiry:** `setex(redis_key, 120, otp_code)` — Redis itself deletes the key after 120 seconds (mirroring `OTP_EXPIRE_SECONDS` from `config.py`), so an unused code disappears on its own.
- **Active invalidation-on-use:** on a *successful* verification, `verify_otp()` immediately calls `redis_client.delete(redis_key)`. This closes the single-use window deterministically — a correct code cannot be replayed twice, even within the same 120-second TTL.

If verification fails (wrong code), the key is deliberately **left in place** so the user can retry with the correct code until either they succeed or the 120-second TTL lapses naturally.

---

## 5. Invalidation Triggers Across the Application Layer

Every write path that changes data backing a cached read calls exactly one of the two eviction primitives from §4, and always **after** the PostgreSQL transaction has committed. The table below maps every mutation in the codebase to its cache effect.

| Route | File | DB Mutation | Cache Call | Notes |
|---|---|---|---|---|
| `POST /api/reservations/` | `reservations.py` → `reserve_ticket()` | `UPDATE tickets SET remaining_capacity = remaining_capacity - 1`, `INSERT INTO reservations (...status='pending'...)` | `clear_ticket_cache()` | Capacity changed → every cached search result showing this ticket's `remaining_capacity` is now stale. |
| `POST /api/payments/` (expired branch) | `payments.py` → `process_payment()` | `UPDATE reservations SET status='cancelled'`, `UPDATE tickets SET remaining_capacity = remaining_capacity + 1` | `clear_ticket_cache()` | An expired reservation is auto-cancelled and its seat is returned to the pool — capacity changes again, so the cache must be evicted a second time. |
| `POST /api/payments/` (successful branch) | `payments.py` → `process_payment()` | `INSERT INTO payments (...)`, `UPDATE reservations SET status='paid'` | *(none)* | **By design.** Capacity was already decremented at reservation time (§ above); a successful payment changes reservation/payment status only, which is not part of any cached ticket-search payload. No invalidation call is needed or made. |
| `POST /api/payments/cancel` | `payments.py` → `cancel_ticket()` | `UPDATE reservations SET status='cancelled'`, `UPDATE tickets SET remaining_capacity = remaining_capacity + 1` | `clear_ticket_cache()` | Cancellation returns a seat to the pool — capacity changed, cache evicted. |
| `PUT /api/user/profile` | `users.py` → `update_profile()` | `UPDATE users SET first_name=..., last_name=..., city=...` | `invalidate_user_profile_cache(user_id)` | Scoped only to the mutated user; never touches the ticket-search namespace. |
| `GET /api/payments/cancellation-penalty/{id}` | `payments.py` → `calculate_cancellation_penalty()` | *(read-only)* | *(none)* | Pure calculation over live PostgreSQL data — nothing cached, nothing to invalidate. |

> 📌 **Key architectural insight:** invalidation is triggered by *capacity changes*, not by *any* write to the `reservations` or `payments` tables. The successful-payment path is the clearest example — it mutates two tables but calls zero cache functions, because neither mutation is reflected in any cached payload. This is the correct mental model to apply when adding new endpoints in future phases: **ask "does this write change a value that is embedded in a cached response?" — not "did I just run an UPDATE?"**

### 5.1 Reservation flow in detail

```mermaid
sequenceDiagram
    autonumber
    participant C as 👤 Client
    participant A as ⚙️ reservations.py
    participant P as 🐘 PostgreSQL
    participant R as ⚡ Redis

    C->>A: POST /api/reservations/ {ticket_id}

    Note over A,P: 🔒 Locked read + validation
    A->>P: SELECT remaining_capacity ... FOR UPDATE
    P-->>A: capacity row (row-locked)
    A->>P: check no existing pending/paid reservation

    Note over A,P: ✏️ Write + commit
    A->>P: UPDATE tickets SET remaining_capacity -= 1
    A->>P: INSERT INTO reservations (status='pending', expires_at=NOW()+15min)
    A->>P: COMMIT

    Note over A,R: ⚡ Cache invalidation
    A->>R: clear_ticket_cache() — scan_iter + delete

    A->>A: background_tasks.add_task(expiration_reminder_task)
    A-->>C: 201 Created {reservation_id, expires_at, ...}
```

The `SELECT ... FOR UPDATE` row lock on `tickets` is what prevents two concurrent reservation requests from both reading the same `remaining_capacity` and both succeeding when only one seat remains — it serializes access to that row at the database level, independent of the cache. The cache invalidation only happens *after* this transaction commits, discussed further in §6.

### 5.2 Payment / expiry / cancellation flow in detail

```mermaid
sequenceDiagram
    autonumber
    participant C as 👤 Client
    participant A as ⚙️ payments.py
    participant P as 🐘 PostgreSQL
    participant R as ⚡ Redis

    C->>A: POST /api/payments/ {reservation_id}
    A->>P: SELECT reservation + ticket price ... FOR UPDATE OF r
    P-->>A: reservation row (locked)

    alt ⏰ reservation.is_expired == true
        A->>P: UPDATE reservations SET status='cancelled'
        A->>P: UPDATE tickets SET remaining_capacity += 1
        A->>P: COMMIT
        A->>R: clear_ticket_cache()
        A-->>C: 400 "Reservation expired. Ticket returned to the pool."
    else ✅ reservation still pending
        A->>P: INSERT INTO payments (status='successful')
        A->>P: UPDATE reservations SET status='paid'
        A->>P: COMMIT
        Note over A,R: 🚫 No cache call — capacity unchanged
        A-->>C: 201 Created {payment_id, status: successful}
    end
```

---

## 6. Transaction Safety: Commit-Then-Invalidate

The connection lifecycle is centralized in `app/database.py`:

```python
@contextmanager
def get_db_cursor():
    conn = db_pool.getconn()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        yield cursor
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        db_pool.putconn(conn)
```

Every route in this codebase additionally issues an **explicit, early `cursor.connection.commit()`** inside the `with get_db_cursor() as cursor:` block, immediately before calling a cache invalidation function — for example, in `reserve_ticket()`:

```python
cursor.connection.commit()
clear_ticket_cache()
background_tasks.add_task(expiration_reminder_task, ...)
```

### Why the explicit early commit matters

`get_db_cursor()`'s context manager *would* eventually commit on its own once the `with` block exits normally. But the invalidation call is placed **inside** the block, right after the explicit commit — not after the block exits. This ordering is deliberate and eliminates a specific race:

> If `clear_ticket_cache()` ran *before* the PostgreSQL commit was guaranteed durable, a concurrent request could re-populate the search cache with the transaction's pre-update values (since, from PostgreSQL's perspective, the change wouldn't be visible yet to another connection). The result would be a **freshly-repopulated but stale cache entry** that then has to wait out the full 60-second TTL before self-correcting.

By forcing the sequence to be **commit → invalidate**, any request that re-reads and repopulates the cache immediately after invalidation is guaranteed to see the *new* `remaining_capacity`, because the write it is racing against has already been made durable in PostgreSQL.

```mermaid
flowchart TD
    A["Begin transaction"] --> B["🔒 Row-level lock<br/>SELECT ... FOR UPDATE"]
    B --> C["✏️ Apply UPDATE / INSERT"]
    C --> D["💾 cursor.connection.commit()"]
    D --> E{"Commit successful?"}
    E -->|"✅ Yes"| F["⚡ Call clear_ticket_cache() /<br/>invalidate_user_profile_cache()"]
    E -->|"❌ No / Exception"| G["↩️ conn.rollback()<br/>via get_db_cursor context manager"]
    F --> H["📤 Return response to client"]
    G --> I["🚫 Raise HTTPException 500<br/>cache untouched"]

    class A,B,C,D neutral
    class E decision
    class F,H success
    class G,I fail

    classDef neutral fill:#E3F2FD,stroke:#1565C0,stroke-width:2px,color:#0D47A1
    classDef decision fill:#FFF3E0,stroke:#EF6C00,stroke-width:2px,color:#E65100,font-weight:bold
    classDef success fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px,color:#1B5E20,font-weight:bold
    classDef fail fill:#FFEBEE,stroke:#C62828,stroke-width:2px,color:#B71C1C,font-weight:bold
```

Note the failure branch: if the commit raises, `get_db_cursor()`'s `except` clause rolls back and re-raises *before* any cache invalidation call is ever reached — a failed write can never trigger a spurious cache eviction, and (more importantly) can never leave a stale cache entry uninvalidated when it *shouldn't* have written anything in the first place.

### `FOR UPDATE`, isolation, and the cache

Row-level locking (`FOR UPDATE`, `FOR UPDATE OF r`) is what PostgreSQL uses to guarantee correctness for *concurrent database writers*. The cache invalidation strategy is deliberately kept **orthogonal** to this locking: Redis has no concept of the PostgreSQL row lock and doesn't need one. As long as invalidation only ever fires after a commit, and the TTL provides a hard upper bound on staleness, the two systems stay consistent without any cross-system locking or two-phase commit — a simpler and more resilient design than trying to keep Redis and PostgreSQL in lockstep transactionally.

---

## 7. Data Flow Diagrams

### 7.1 End-to-end: write invalidates, next read re-fills

This is the complete lifecycle referenced throughout this document, from an initial cache hit through a mutation to the subsequent cache miss and re-fill.

```mermaid
sequenceDiagram
    autonumber
    participant C1 as 👤 Client A (reader)
    participant C2 as 👤 Client B (writer)
    participant A as ⚙️ FastAPI
    participant R as ⚡ Redis
    participant P as 🐘 PostgreSQL

    Note over C1,P: 🟢 Phase 1 — Cache is warm
    C1->>A: GET /api/tickets/search?sport_type=football
    A->>R: GET tickets:search:football:...
    R-->>A: cached JSON (remaining_capacity = 5)
    A-->>C1: 200 OK (source: cache ⚡)

    Note over C2,P: 🟠 Phase 2 — A write occurs
    C2->>A: POST /api/reservations/ {ticket_id}
    A->>P: UPDATE tickets SET remaining_capacity -= 1
    A->>P: INSERT INTO reservations (...)
    A->>P: COMMIT
    A->>R: clear_ticket_cache() — scan_iter "tickets:search:*" + delete
    A-->>C2: 201 Created

    Note over C1,P: 🔵 Phase 3 — Next read is a guaranteed miss
    C1->>A: GET /api/tickets/search?sport_type=football
    A->>R: GET tickets:search:football:...
    R-->>A: nil (evicted in Phase 2)
    A->>P: SELECT ... FROM tickets WHERE is_active = TRUE ...
    P-->>A: rows (remaining_capacity = 4)
    A->>R: SET tickets:search:football:... EX 60
    A-->>C1: 200 OK (source: database 🐘, fresh capacity)
```

This diagram is the core proof of correctness for the whole strategy: **Client A can never observe a `remaining_capacity` that is staler than Client B's most recently committed write**, because the cache entry Client A would have read was deleted as a direct, synchronous consequence of that commit.

### 7.2 OTP self-expiry lifecycle

```mermaid
stateDiagram-v2
    [*] --> Issued: generate_and_set_otp()<br/>SETEX otp:{phone} 120 {code}
    Issued --> Verified: verify_otp() match<br/>DELETE otp:{phone}
    Issued --> Expired: 120s elapse<br/>(Redis TTL eviction)
    Issued --> Issued: verify_otp() mismatch<br/>(key untouched, retry allowed)
    Verified --> [*]
    Expired --> [*]

    classDef issued fill:#FFF3E0,stroke:#EF6C00,stroke-width:2px,color:#E65100,font-weight:bold
    classDef verified fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px,color:#1B5E20,font-weight:bold
    classDef expired fill:#FFEBEE,stroke:#C62828,stroke-width:2px,color:#B71C1C,font-weight:bold

    class Issued issued
    class Verified verified
    class Expired expired
```

---

## 8. Cache Key Reference Table

| Key Pattern | Producer | Consumer / Invalidator | TTL | Scope |
|---|---|---|---|---|
| `tickets:search:{sport}:{venue}:{min}:{max}:{team}:{tier}:{date}` | `search_tickets()` in `tickets.py` | `clear_ticket_cache()` (namespace-wide `scan_iter` delete) | 60s (`ex=60`, hardcoded) | Global — shared across all users |
| `user:profile:{user_id}` | *(read path not shown in current routes; write-through invalidation exists today)* | `invalidate_user_profile_cache(user_id)` (direct delete) | Not yet set via `setex` — see §9 | Per-user |
| `otp:{phone_number}` | `generate_and_set_otp()` | `verify_otp()` on success; passive TTL otherwise | 120s (`OTP_EXPIRE_SECONDS`) | Per-phone-number, single-use |

---

## 9. Known Limitations & Future Work

> These are honest engineering trade-offs in the current implementation, documented here for transparency and as a roadmap for later phases — not defects to be silently patched over.

- **Coarse-grained search invalidation.** `clear_ticket_cache()` evicts *all* cached search permutations on *any* capacity change, regardless of sport, venue, or price range. At current scale this is a deliberate simplicity/correctness trade-off (§4.1), but it would not scale linearly forever — a future phase could shard the namespace (e.g., `tickets:search:football:*`) so a football reservation only evicts football-scoped keys.
- **Silent failure on cache errors.** Both `clear_ticket_cache()` and the Redis client's own connection failures are caught and only `print()`-logged, never raised. This is intentional — a Redis outage must never fail a PostgreSQL write — but it means invalidation failures are currently invisible to monitoring. Wiring this `except` branch into `logger.error()` (as `reservations.py` already does for its background task) would make silent cache staleness observable.
- **`user:profile:{user_id}` has no producer/TTL in the current codebase.** `invalidate_user_profile_cache()` exists and is correctly wired into `update_profile()`, but no route currently *writes* `user:profile:{user_id}` into Redis on a profile read. The invalidation half of the cache-aside pattern is implemented ahead of the read half — a `GET /api/user/profile` cache-aside read path is a natural Phase 4 addition.
- **Hardcoded TTLs.** The 60-second search TTL lives as a literal in `tickets.py` rather than in `Settings`, unlike `OTP_EXPIRE_SECONDS`. Promoting it to a config field would make it environment-tunable without a code deploy.
- **No cross-instance pub/sub invalidation signal.** If the API is horizontally scaled across multiple processes/pods, all instances share the same physical Redis, so `DELETE`/`SCAN` invalidation is already globally visible — no gap here today. This becomes relevant only if a future phase introduces **local in-process caching** in addition to Redis, at which point a pub/sub or keyspace-notification bridge would be needed to invalidate local caches too.

---

## 10. File Reference Index

| File | Role in this strategy |
|---|---|
| `app/config.py` | Centralized `Settings` — Redis connection params, `OTP_EXPIRE_SECONDS` |
| `app/database.py` | `get_db_cursor()` — pooled PostgreSQL connections, commit/rollback boundary |
| `app/redis_client.py` | Shared `redis_client` instance; `clear_ticket_cache()`, `invalidate_user_profile_cache()`, `generate_and_set_otp()`, `verify_otp()` |
| `app/routes/tickets.py` | Cache-aside read path for `GET /api/tickets/search` |
| `app/routes/reservations.py` | Reservation write path → `clear_ticket_cache()` trigger |
| `app/routes/payments.py` | Payment / expiry / cancellation write paths → conditional `clear_ticket_cache()` trigger |
| `app/routes/users.py` | Profile update write path → `invalidate_user_profile_cache()` trigger |

---

*This document is part of the SportsTicketPlatform Phase 3 documentation set and is intended to be referenced from, or appended to, the project's `README.md`.*
