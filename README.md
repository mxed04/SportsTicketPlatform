<div align="center">

# 🎟️ SportsTicketPlatform

### Sports Event Ticket Booking & Reservation Platform

_A fully normalized relational database and a raw-SQL FastAPI backend for a high-traffic sports ticketing system — football, volleyball, and basketball events._

[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%2B-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Normalization](https://img.shields.io/badge/Normalization-3NF-2E8B57?style=for-the-badge)](#phase-1)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111.0-009688?style=for-the-badge&logo=fastapi&logoColor=white)](#phase-3)
[![Redis](https://img.shields.io/badge/Redis-5.0.6-DC382D?style=for-the-badge&logo=redis&logoColor=white)](#phase-3)
[![Celery](https://img.shields.io/badge/Celery-Task%20Queue-37814A?style=for-the-badge)](#phase-3)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](docker-compose.yml)
[![CI](https://img.shields.io/github/actions/workflow/status/MohammafAfra83/SportsTicketPlatform/ci.yml?branch=main&style=for-the-badge&label=CI&logo=githubactions&logoColor=white)](.github/workflows/ci.yml)
[![Phase](https://img.shields.io/badge/Current%20Phase-3%20of%204-orange?style=for-the-badge)](#-project-status--roadmap)
[![License](https://img.shields.io/badge/License-Academic%20Project-lightgrey?style=for-the-badge)](#-author--license)

[Project Status](#-project-status--roadmap) •
[Overview](#-overview) •
[Repository Structure](#-repository-structure) •
[ERD](#-entity-relationship-diagram-erd) •
[Data Dictionary](#-data-dictionary) •
[Phase 2](#phase-2) •
[Phase 3](#phase-3) •
[CI/CD](#-cicd-pipeline) •
[Getting Started](#-getting-started) •
[Upcoming Phases](#-project-roadmap--upcoming-phases)

</div>

---

## 📈 Project Status & Roadmap

<!--
  📌 MAINTENANCE NOTE (does not render on GitHub):
  This is a 4-phase project. Docker is a cross-phase BONUS item, not one of the
  4 main phases. Update the status table below and append a new
  "## 🏛️ Phase N — <title>" section further down this document each time a
  new phase is completed. The README is designed to grow incrementally,
  phase by phase, without needing to be rewritten from scratch.
-->

This is a **4-phase project**. This README grows **incrementally** — each phase is documented in its own section below as it is completed.

| Phase | Title                                                      |     Status      |
| :---: | ---------------------------------------------------------- | :-------------: |
| **1** | Database Design — ER Diagram & Schema (3NF)                | ✅ **Complete** |
| **2** | Data Seeding, Analytical Queries & Stored Procedures       | ✅ **Complete** |
| **3** | Backend Implementation — REST API (No ORM) & Redis Caching | ✅ **Complete** |
| **4** | Client Application & ElasticSearch Search Engine           |   ⏳ Planned    |

**🌟 Selected Bonus (Extra-Credit) Phase:**

| Feature                                                  | Associated Phase |     Status     |
| --------------------------------------------------------- | :--------------: | :------------: |
| CI/CD automation via GitHub Actions                      |     Phase 1      | ✅ Implemented |
| Indexing & query performance optimization                |     Phase 2      | ✅ Implemented |
| Dockerization of the database tier                       |   Bonus-phase    | ✅ Implemented |
| Full-stack Dockerization (backend API + Celery + Redis)  |     Phase 3      | ✅ Implemented |
| Rate limiting, idempotent payments, QR tickets, waitlist |     Phase 3      | ✅ Implemented |

> ℹ️ Dockerization is tracked as a **cross-phase bonus**, not one of the 4 core phases. As of Phase 3, the **entire stack** — PostgreSQL, Redis, the FastAPI backend, and the Celery worker — is fully containerized via a single `docker-compose.yml` (4 services) and verified end-to-end in CI on every push.

---

## 📖 Overview

**SportsTicketPlatform** models the complete lifecycle of a sports-event ticket transaction:

```
User Registration → Browse Tickets → Create Reservation → Complete Payment → (Optional) Support Report
```

The project is delivered across **4 phases** — database design, data/query layer, backend API, and client + search engine — with Dockerization as a separate, cross-phase bonus. As of **Phase 3**, the project delivers a fully normalized **3NF** PostgreSQL schema, a complete seed dataset, a 22-query analytical/maintenance layer, 8 reusable PL/pgSQL functions, a two-tier indexing strategy, and a full **FastAPI** REST backend — raw SQL (no ORM), JWT auth, Redis caching/queues, and Celery background jobs — all fully containerized and CI-verified end-to-end.

|                            |                                                                            |
| -------------------------- | -------------------------------------------------------------------------- |
| 🗄️ **Database Engine**     | PostgreSQL 16 (`postgres:16-alpine`, UTF-8)                                |
| 🧱 **Normalization Level** | Third Normal Form (3NF)                                                    |
| 🏟️ **Domain**              | Sports Event Ticketing (Football · Volleyball · Basketball)                |
| 🏗️ **Architecture**        | Domain-Driven Partitioning (base ticket + sport-specific extension tables) |
| ⚡ **Backend**              | FastAPI, raw SQL via pooled `psycopg2` (no ORM)                            |
| 🧠 **Cache / Queue**       | Redis (cache-aside search, OTPs, waitlists, idempotency) + Celery workers  |
| 🔑 **Auth**                | JWT (`HS256`) + `bcrypt` password hashing                                  |
| 🐳 **Containerization**    | Docker Compose — one command for the full stack (DB, Redis, API, worker)   |
| 🔁 **CI/CD**               | GitHub Actions — builds and verifies the real Docker Compose stack, incl. `pytest` |

---

## 🗂 Repository Structure

<details open>
<summary><strong>Click to expand / collapse the file tree</strong></summary>

```text
SportsTicketPlatform/
├── .github/
│   └── workflows/
│       └── ci.yml                        # Full-stack CI: builds DB+Redis+API+worker via Compose, runs pytest
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   └── celery_app.py              # Shared Celery instance (Redis broker + result backend)
│   │   ├── routes/                        # auth, tickets, locations, reservations, payments, users, reports, admin
│   │   ├── schemas/                       # Pydantic request/response models, one file per route group
│   │   ├── tasks/
│   │   │   └── reservation_tasks.py       # Celery tasks: payment reminder (13m), auto-cancellation (15m)
│   │   ├── utils/
│   │   │   └── email_sender.py            # Real SMTP OTP sender (implemented, not wired into any route)
│   │   ├── config.py                      # pydantic-settings — all env-driven configuration
│   │   ├── database.py                    # psycopg2 ThreadedConnectionPool + get_db_cursor()
│   │   ├── main.py                        # FastAPI app, CORS, rate-limiter wiring, health check
│   │   ├── rate_limiter.py                # slowapi Limiter (in-memory, keyed by client IP)
│   │   ├── redis_client.py                # OTP store, search cache, waitlist queues, idempotency cache
│   │   └── security.py                    # JWT signing (PyJWT) + bcrypt hashing (Passlib)
│   ├── postman/
│   │   ├── openapi.json                   # Exported OpenAPI 3.1 spec — importable as a Postman collection
│   │   └── Local_Environment.json         # Postman environment (base_url, token)
│   ├── tests/                             # pytest suite (FastAPI TestClient)
│   ├── .env.example                       # Template for backend/.env
│   ├── Dockerfile
│   └── requirements.txt
├── database/
│   ├── erd/
│   │   ├── erd_diagram.drawio             # Editable ERD Source File (Draw.io)
│   │   ├── erd_diagram.drawio.pdf         # ERD, exported as PDF
│   │   ├── erd_diagram.drawio.png         # ERD, exported as PNG
│   │   ├── erd_source.dbml                # DBML source for schema generation
│   │   └── Relational_Schema_Diagram.png  # Relational schema preview image
│   ├── scripts/
│   │   ├── schema.sql                     # 3NF DDL: enums, tables, constraints
│   │   ├── seed.sql                       # Seed data with dynamic timestamps
│   │   ├── indexes.sql                    # B-Tree & GIN Trigram indexes (also enables pg_trgm)
│   │   ├── procedures.sql                 # 8 PL/pgSQL stored functions
│   │   └── queries.sql                    # 22 analytical & maintenance queries
│   └── init.sh                            # 5-step automated bootstrap (run inside the container)
├── docs/
│   ├── Phase1/
│   │   └── Phase1_Report.pdf              # Phase 1 technical & normalization report
│   ├── Phase2/
│   │   └── Phase2_Report.pdf              # Phase 2 technical implementation report
│   └── Phase3/
│       ├── Phase3_Backend_Implementation.md         # Full API reference, setup guide, testing & changelog
│       └── Database_Sync_Cache_Invalidation_Strategy.md  # Cache-aside patterns & Redis key lifecycles
├── docker-compose.yml                     # 4 services: postgres_db, redis, api, celery_worker
├── .gitignore
└── README.md                              # Main repository documentation
```

</details>

---

<a id="phase-1"></a>

## 🏛️ Phase 1 — Database Design (ER Diagram & Schema)

> **Status: ✅ Complete** — Domain analysis, 3NF schema design, ER Diagram modeling, and CI verification.

**Goal:** Understand the domain relationships, extract entities, and normalize the database up to Third Normal Form (3NF).

### ✅ Deliverables Checklist

- [x] ER Diagram source file **and** its exported image (`erd_diagram.drawio`, `erd_diagram.drawio.png`, `erd_source.dbml`)
- [x] SQL file containing `CREATE TABLE` statements and all relationships (`schema.sql`)
- [x] Short technical report justifying the database structure and normalization (`Phase1_Report.pdf`)
- [x] **Bonus:** CI/CD pipeline via GitHub Actions for automated schema verification

### 🧩 Entity-Relationship Diagram (ERD)

The full ERD is available under [`database/erd/`](database/erd/):

| File                                                            | Purpose                                                                   |
| --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [`erd_diagram.drawio.png`](database/erd/erd_diagram.drawio.png) | Quick preview image _(rendered below)_                                    |
| [`erd_diagram.drawio`](database/erd/erd_diagram.drawio)         | Editable source — open with [draw.io](https://app.diagrams.net/)          |
| [`erd_source.dbml`](database/erd/erd_source.dbml)               | DBML source — regenerate/version via [dbdiagram.io](https://dbdiagram.io) |

<div align="center">

<img src="database/erd/erd_diagram.drawio.pdf" alt="Entity-Relationship Diagram" width="850">

_Figure 1 — Entity-Relationship Diagram of the SportsTicketPlatform schema_

</div>

<br>

**Core entities identified:** `users` (roles: `audience` and `support`), `tickets` (base match/event record), `reservations`, `payments`, `reports`, and the sport-specific extension tables (`football_details`, `volleyball_details`, `basketball_details`).

**Core relationships modeled in the ERD:**

| Relationship                                                        | Cardinality |
| ------------------------------------------------------------------- | :---------: |
| `users` makes `reservations`                                        |    1 : N    |
| `tickets` is included in `reservations`                             |    1 : N    |
| `reservations` is settled by `payments`                             |    1 : 1    |
| `users` is billed via `payments`                                    |    1 : N    |
| `users` submits `reports`                                           |    1 : N    |
| `reservations` is (optionally) referred to by `reports`             |    1 : N    |
| `tickets` is (optionally) referred to by `reports`                  |    1 : N    |
| `tickets` has `football_details`                                    |    1 : 1    |
| `tickets` has `volleyball_details`                                  |    1 : 1    |
| `tickets` has `basketball_details`                                  |    1 : 1    |
| `reservations` is (optionally) cancelled by a `users` support agent |    N : 1    |

<br>

### 🏗 Database Entities

The system is composed of **8 interconnected, domain-partitioned tables**:

- **`users`** — Demographics (`first_name`, `last_name`, `city`), unique `phone_number`/`email`, hashed credentials (`password_hash`), role-based privileges (`audience` vs. `support`), and a soft-deletion flag (`is_active`).
- **`tickets`** — The generalized base table holding shared match attributes: `home_team`, `away_team`, `sport_type`, `ticket_tier`, `organizer`, `venue_name`, `city`, `match_date`, `price`, and `remaining_capacity`.
- **`football_details` / `volleyball_details` / `basketball_details`** — Specialized 1-to-1 extension tables storing sport-specific metadata (stadium/hall name, seating section, row/seat numbers, ticket type/tier, amenities) without polluting the base `tickets` table with excessive `NULL` values.
- **`reservations`** — Temporary reservation lifecycle with a strict hold-timeout window (`expires_at`) prior to purchase confirmation, a lifecycle `status` (`pending` / `paid` / `cancelled`), and a nullable `cancelled_by_support_id` foreign key that records which support agent (a `users` row with `role = support`) cancelled the reservation, if any.
- **`payments`** — Financial transactions, linked 1-to-1 with `reservations` via a unique `reservation_id`. Both foreign keys (`reservation_id`, `user_id`) use `ON DELETE RESTRICT` rather than `CASCADE`, so a paid reservation or its payer can never be deleted while a payment record still references it.
- **`reports`** — Customer support disputes, complaints, and ticket issues submitted by spectators for administrative review, with nullable references to the ticket and/or reservation in question.

<br>

### 🧪 Normalization & 3NF Justification

All tables strictly satisfy the criteria for **Third Normal Form (3NF)**:

1. **1NF** — All attributes are atomic: user names are decomposed into `first_name`/`last_name`, and match participants into `home_team`/`away_team`. Sport-specific, potentially repeating attributes are moved out of `tickets` entirely and into dedicated child tables rather than kept as multi-valued or grouped columns.
2. **2NF** — Every table uses a single-column surrogate primary key (`SERIAL`), so there are no composite keys and therefore no partial dependencies — every non-key attribute depends on the whole key.
3. **3NF** — The schema contains no transitive functional dependencies. Sport-specific attributes (stadium/hall, seating, amenities) are partitioned into dedicated 1-to-1 child tables (`football_details`, `volleyball_details`, `basketball_details`), preventing non-key attributes from depending on other non-key attributes and eliminating sparse, NULL-heavy columns on the base `tickets` table.

<div align="center">

| Table                | Primary Key      | Foreign Key(s)                                               | 3NF Design Rationale                                                                           |
| -------------------- | ---------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `users`              | `user_id`        | —                                                            | Unique email/phone; atomic name fields; decoupled auth credentials                             |
| `tickets`            | `ticket_id`      | —                                                            | Generalized match metadata shared across all sports                                            |
| `football_details`   | `ticket_id`      | → `tickets`                                                  | Isolates stadium, stand section, and row/seat details                                          |
| `volleyball_details` | `ticket_id`      | → `tickets`                                                  | Isolates hall, seat section, and row/seat details                                              |
| `basketball_details` | `ticket_id`      | → `tickets`                                                  | Isolates hall, seat section, and row/seat details                                              |
| `reservations`       | `reservation_id` | `user_id`, `ticket_id`, `cancelled_by_support_id` (nullable) | Manages transient hold lifecycles & expiration logic; nullable FK audits support cancellations |
| `payments`           | `payment_id`     | `reservation_id` (unique), `user_id`                         | 1-to-1 financial ledger decoupled from reservation state; protected via `ON DELETE RESTRICT`   |
| `reports`            | `report_id`      | `user_id`, `ticket_id`, `reservation_id` (both nullable)     | Independent complaint logging; avoids transitive dependencies                                  |

</div>

<br>

### 🔒 Integrity Constraints & Business Logic

| Category                              | Implementation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Value Constraints** (`CHECK`)       | Non-negative pricing (`price >= 0`), non-negative capacity (`remaining_capacity >= 0`), non-negative transaction amounts (`amount >= 0`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Temporal Logic**                    | Valid reservation time windows (`reserved_at < expires_at`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Domain Enumerations** (`ENUM`)      | `user_role`, `reservation_status`, `payment_status`, `sport_type_enum`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Referential Actions** (`ON DELETE`) | `CASCADE` — removes a ticket's extension row (`football_details` / `volleyball_details` / `basketball_details`) and any `reservations` when the owning `ticket` or `user` is deleted. `RESTRICT` — blocks deletion of any `user` or `reservation` that already has a `payments` record, protecting completed transactions from accidental loss. `SET NULL` — preserves `reports` when the referenced `ticket`/`reservation` is removed (`reports.ticket_id`, `reports.reservation_id`), and preserves a reservation's history when the cancelling support agent's account is removed (`reservations.cancelled_by_support_id`). |

<br>

### ⚡ Performance Indexing (Phase 1 baseline)

- **Compound B-Tree Indexes** — `(sport_type, city)` for rapid multi-column filtering, and a chronological index on `match_date ASC` for sorting upcoming events.
- **User/Reservation Index** — `(user_id, status)` on `reservations` to accelerate per-user status lookups.
- **GIN Trigram Indexes** (`pg_trgm`) — Applied to `venue_name`, `home_team`, and `away_team` to support fast sub-string wildcard search (`ILIKE '%term%'`).

> 🔧 This index set was **expanded in Phase 2** — see [⚡ Indexing & Query Optimization](#-indexing--query-optimization-bonus) below for the full, current inventory.

<br>

### 📊 Data Dictionary

<details>
<summary><strong>Click to expand the full entity attribute & relationship dictionary</strong></summary>

<br>

| Entity               | Key Attributes                                                                                                                                          | Relationships                                                                                            | Target Cardinality                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `users`              | `user_id` (PK), `first_name`, `last_name`, `phone_number`, `email`, `password_hash`, `role`, `city`, `is_active`, `created_at`                          | Makes Reservation • Billed via Payment • Submits Report • Cancels Reservation (as support)               | 1:N → `reservations` • 1:N → `payments` • 1:N → `reports` • 1:N → `reservations` (as canceller) |
| `tickets`            | `ticket_id` (PK), `home_team`, `away_team`, `sport_type`, `ticket_tier`, `organizer`, `venue_name`, `city`, `match_date`, `price`, `remaining_capacity` | Booked In • Has Football/Volleyball/Basketball Details • Referenced By Report                            | 1:N → `reservations` • 1:1 → each `*_details` • 1:N → `reports`                                 |
| `football_details`   | `ticket_id` (PK/FK), `league_name`, `stadium_name`, `stand_section`, `row_number`, `seat_number`, `ticket_type`, `amenities`                            | Extension of Base Ticket                                                                                 | 1:1 → `tickets`                                                                                 |
| `volleyball_details` | `ticket_id` (PK/FK), `league_name`, `hall_name`, `seat_section`, `row_number`, `seat_number`, `ticket_tier`, `amenities`                                | Extension of Base Ticket                                                                                 | 1:1 → `tickets`                                                                                 |
| `basketball_details` | `ticket_id` (PK/FK), `league_name`, `hall_name`, `seat_section`, `row_number`, `seat_number`, `ticket_tier`, `amenities`                                | Extension of Base Ticket                                                                                 | 1:1 → `tickets`                                                                                 |
| `reservations`       | `reservation_id` (PK), `user_id` (FK), `ticket_id` (FK), `status`, `reserved_at`, `expires_at`, `cancelled_by_support_id` (FK, Nullable)                | Made By User • Includes Ticket • Settled By Payment • Referred To By Report • Cancelled By Support Agent | N:1 → `users` • N:1 → `tickets` • 1:1 → `payments` • 1:N → `reports` • N:1 → `users` (nullable) |
| `payments`           | `payment_id` (PK), `reservation_id` (FK, Unique), `user_id` (FK), `amount`, `status`, `payment_method`, `paid_at`                                       | Settles Reservation • Billed To User                                                                     | 1:1 → `reservations` • N:1 → `users`                                                            |
| `reports`            | `report_id` (PK), `user_id` (FK), `ticket_id` (FK, Nullable), `reservation_id` (FK, Nullable), `category`, `report_text`, `status`, `created_at`        | Filed By User • References Ticket/Reservation                                                            | N:1 → `users` • N:1 → `tickets` • N:1 → `reservations`                                          |

</details>

<br>

📄 **Full technical write-up:** [`docs/Phase1/Phase1_Report.pdf`](docs/Phase1/Phase1_Report.pdf)

---

<a id="phase-2"></a>

## 🏛️ Phase 2 — Data Seeding, Analytical Queries, Procedures & Dockerization

> **Status: ✅ Complete** — Seed data, a 22-query analytical/maintenance layer, 8 PL/pgSQL functions, expanded indexing, and full database containerization with a Docker-based CI pipeline.

**Goal:** Populate the Phase 1 schema with realistic, internally-consistent data; implement the query and stored-procedure layer needed to operate the platform; and — as a bonus — optimize read performance and containerize the entire database tier for one-command, reproducible setup.

### ✅ Deliverables Checklist

- [x] Seed data — 10+ records per table, using dynamic (`CURRENT_TIMESTAMP`-relative) timestamps (`seed.sql`)
- [x] 22 analytical & maintenance SQL queries, including window functions and controlled destructive statements (`queries.sql`)
- [x] 8 reusable PL/pgSQL stored functions covering the platform's core lookup and reporting needs (`procedures.sql`)
- [x] **Bonus:** Expanded performance indexing — 7 B-Tree + 4 GIN Trigram indexes, verified with `EXPLAIN ANALYZE` (`indexes.sql`)
- [x] **Bonus:** Full database containerization — `docker-compose.yml` + a 5-step automated `init.sh` bootstrap
- [x] **Bonus:** CI/CD pipeline rebuilt to be fully Docker-based — it now builds and tears down the _real_ container stack, not just a bare Postgres service

<br>

### 🌱 Seed Data (`seed.sql`)

| Entity                                                           | Records Seeded | Notes                                               |
| ---------------------------------------------------------------- | :------------: | --------------------------------------------------- |
| `users`                                                          |       10       | 8 audience, 2 support                               |
| `tickets`                                                        |       30       | 10 mixed + 6 football + 7 volleyball + 7 basketball |
| `football_details` / `volleyball_details` / `basketball_details` |    10 each     | One row per ticket of that sport                    |
| `reservations`                                                   |       12       | Statuses: `paid`, `pending`, `cancelled`            |
| `payments`                                                       |       10       | Statuses: `successful`, `pending`, `failed`         |
| `reports`                                                        |       10       | Statuses: `under_review`, `resolved`                |

> 🕒 **Dynamic timestamps:** every seeded row uses `CURRENT_TIMESTAMP ± INTERVAL` instead of hard-coded dates. Since `init.sh` re-runs `seed.sql` on every fresh container build, this keeps time-relative queries — _"last week," "last month," "today," "upcoming matches"_ — meaningful on every run, instead of quietly returning empty results as a static dataset ages.

<br>

### 🔍 Analytical & Maintenance Queries (`queries.sql`) — 22 Total

The query suite is split into two parts: safe, read-only analytics, and explicit, controlled data maintenance.

| Category                    |       Query # (of 22)        | Representative Example                                                   |
| --------------------------- | :--------------------------: | ------------------------------------------------------------------------ |
| User & Purchase Behaviour   | 1, 2, 3, 4, 6, 8, 12, 13, 14 | Users who never reserved a ticket; spenders above the platform average   |
| Ticket & Sales Analytics    |   5, 7, 9, 10, 16, + Bonus   | 2nd best-selling ticket via `DENSE_RANK()`; index-optimized match lookup |
| Time-Windowed Reporting     |              15              | Today's purchases grouped by hour                                        |
| Support & Moderation        |          11, 17, 18          | Support agent with the most cancellations, and their cancellation share  |
| Controlled Data Maintenance |        19, 20, 21, 22        | Conditional rename, cascading cleanup of cancelled reservations, pricing |

**Highlights:**

- **Window functions & aggregation** — `DENSE_RANK() OVER (ORDER BY COUNT(...) DESC)` ranks tickets by popularity (handles ties correctly), while `GROUP BY` / `HAVING` combinations power the spending, per-city, and per-sport-type reports.
- **Respecting `ON DELETE RESTRICT`** — because `payments.reservation_id` and `payments.user_id` are both `RESTRICT`, the destructive queries never delete a `reservations` row directly. Query 20 (cleanup for one user) and Query 21 (cleanup of all remaining cancelled reservations) each delete the dependent `payments` rows **first**, then the `reservations` rows — preserving referential integrity instead of relying on a cascade.

📄 Full breakdown: [`docs/Phase2/Phase2_Report.pdf`](docs/Phase2/Phase2_Report.pdf)

<br>

### ⚙️ Stored Functions & Procedures (`procedures.sql`) — 8 Total

|  #  | Function                                  | Key Parameter(s)                | Purpose                                                      |
| :-: | ----------------------------------------- | ------------------------------- | ------------------------------------------------------------ |
|  1  | `get_user_paid_tickets`                   | `p_contact VARCHAR`             | Paid tickets for a user, by phone or e-mail                  |
|  2  | `get_cancelled_reservations_by_support`   | `p_support_contact VARCHAR`     | Cancellations handled by one support agent                   |
|  3  | `get_tickets_by_city`                     | `p_city VARCHAR`                | Paid tickets sold in a given city                            |
|  4  | `search_tickets_by_keyword`               | `p_keyword VARCHAR`             | Free-text search across team, venue, spectator & league name |
|  5  | `get_co_citizens_purchases`               | `p_contact VARCHAR`             | Purchases made by users from the same city                   |
|  6  | `get_top_buyers_after_date`               | `p_date TIMESTAMP, p_limit INT` | Top-N buyers since a given date                              |
|  7  | `get_cancelled_tickets_by_sport`          | `p_sport_type sport_type_enum`  | Cancelled reservations for one sport, newest first           |
|  8  | `get_users_with_most_reports_by_category` | `p_category VARCHAR`            | Users most frequently reported in a given category           |

> 🔎 **`search_tickets_by_keyword`** is the most structurally complex function: it `LEFT JOIN`s across **six tables** — `tickets`, `reservations`, `users`, `football_details`, `volleyball_details`, `basketball_details` — so a ticket with no reservation yet, or without a matching sport-specific row, is still returned instead of being silently excluded by an inner join.

📄 Full breakdown: [`docs/Phase2/Phase2_Report.pdf`](docs/Phase2/Phase2_Report.pdf)

<br>

### ⚡ Indexing & Query Optimization (Bonus)

11 indexes now cover the schema — 7 conventional B-Tree indexes plus 4 GIN Trigram indexes (via `CREATE EXTENSION pg_trgm`) for fast partial-text `ILIKE` search:

| Type        | Index                          | Target Column(s)                | Optimizes                            |
| ----------- | ------------------------------ | ------------------------------- | ------------------------------------ |
| B-Tree      | `idx_tickets_sport_city`       | `tickets(sport_type, city)`     | Combined sport + city filtering      |
| B-Tree      | `idx_tickets_match_date`       | `tickets(match_date ASC)`       | Chronological upcoming-match listing |
| B-Tree      | `idx_reservations_user_status` | `reservations(user_id, status)` | Per-user reservation status lookups  |
| B-Tree      | `idx_reservations_status`      | `reservations(status)`          | Global status filtering              |
| B-Tree      | `idx_payments_user_id`         | `payments(user_id)`             | User → payments joins/aggregation    |
| B-Tree      | `idx_payments_paid_at`         | `payments(paid_at DESC)`        | Recent-payments ordering             |
| B-Tree      | `idx_reports_category`         | `reports(category)`             | Category-based report aggregation    |
| GIN Trigram | `idx_tickets_venue_trgm`       | `tickets(venue_name)`           | `ILIKE '%...%'` venue search         |
| GIN Trigram | `idx_tickets_home_team_trgm`   | `tickets(home_team)`            | `ILIKE '%...%'` team search          |
| GIN Trigram | `idx_tickets_away_team_trgm`   | `tickets(away_team)`            | `ILIKE '%...%'` team search          |
| GIN Trigram | `idx_users_names_trgm`         | `users(first_name, last_name)`  | `ILIKE '%...%'` name search          |

The trigram index was verified directly against the running container with `EXPLAIN ANALYZE`:

```sql
EXPLAIN ANALYZE SELECT * FROM tickets WHERE venue_name ILIKE '%Azadi%';

-- Bitmap Heap Scan on tickets  (actual time=0.794..0.809 rows=10 loops=1)
--   Recheck Cond: (venue_name ~~* '%Azadi%')
--   ->  Bitmap Index Scan on idx_tickets_venue_trgm  (actual time=0.769..0.770 rows=10)
-- Planning Time: 0.545 ms   Execution Time: 12.596 ms
```

> ⚠️ On this small (30-row) seed table, PostgreSQL's planner will normally still prefer a plain sequential scan — `enable_seqscan` was temporarily disabled to force and confirm this plan. The index is proven functionally correct and will be selected automatically, without forcing, at production scale.

<br>

### 🐳 Dockerization & Automated Bootstrap (Bonus)

The entire database tier now starts with a single command via [`docker-compose.yml`](docker-compose.yml):

```bash
docker compose up -d
```

- A single `postgres_db` service (image `postgres:16-alpine`, container `sports_ticket_postgres`) with environment-driven credentials, a named volume (`postgres_data`) for persistence, and a `pg_isready` healthcheck. **Note:** the host-side port mapping shown here reflects Phase 2's original `docker-compose.yml`; as of Phase 3 the file maps host port `5433` → container port `5432` instead (freeing `5432` on the host for other local Postgres instances) — see [Phase 3 → Database & Redis Configuration](#-database--redis-configuration) below for the current mapping.
- On first start (fresh volume), Postgres automatically executes [`database/init.sh`](database/init.sh) — mounted at `/docker-entrypoint-initdb.d/01-init.sh` — which runs five fail-fast (`set -e`, `psql -v ON_ERROR_STOP=1`) steps in order:

```text
[1/5] schema.sql      – tables & ENUM types
[2/5] seed.sql        – seed data (dynamic timestamps)
[3/5] indexes.sql     – B-Tree + GIN Trigram indexes
[4/5] procedures.sql  – 8 PL/pgSQL functions
[5/5] queries.sql     – all 22 analytical + maintenance queries
```

📄 Full architecture write-up: [`docs/Phase2/Phase2_Report.pdf`](docs/Phase2/Phase2_Report.pdf)

---

<a id="phase-3"></a>

## 🏛️ Phase 3 — Backend Implementation (REST API, No ORM)

> **Status: ✅ Complete** — A raw-SQL FastAPI backend covering auth, ticket search, reservations, payments, waitlisting, support reports, and an admin dashboard, backed by Redis (cache-aside search, OTPs, waitlist queues, payment idempotency) and Celery (durable reservation-lifecycle jobs), fully containerized alongside the Phase 1/2 database tier.

**Goal:** Build the server side with direct SQL queries (**no ORM**) and Redis-backed caching, per the original Phase 3 spec — then go beyond it with rate limiting, idempotent payments, QR-code tickets, and a sold-out waitlist.

### ✅ Deliverables Checklist

- [x] RESTful JSON API — no ORM; every query is raw SQL via a pooled `psycopg2` connection (`app/database.py`)
- [x] Redis integration — OTP storage (TTL-based expiration), ticket-search cache-aside, sold-out waitlists, and payment idempotency
- [x] Core endpoints: auth & signup, profile management, city/venue listings, ticket search & details, timed reservation locks, payment processing, cancellation, booking history, and issue reporting — **21 endpoints total**
- [x] API documentation — this section, plus the full endpoint-by-endpoint reference in [`docs/Phase3/Phase3_Backend_Implementation.md`](docs/Phase3/Phase3_Backend_Implementation.md)
- [x] **Bonus:** advanced filtering (7 optional search filters) plus a `pg_trgm` fuzzy "did you mean" fallback
- [x] **Bonus:** expiry reminder notifications as durable **Celery** tasks, not just a lazy check
- [x] **Bonus:** containerizing the backend and Redis alongside the existing database container (`api`, `celery_worker` services in `docker-compose.yml`)
- [ ] Real SMS/Email OTP delivery — a working SMTP sender exists (`app/utils/email_sender.py`) but isn't called from any route yet; OTPs are logged to the server console instead (see [Known Implementation Notes](#-known-implementation-notes--open-items))

### 🧱 Tech Stack

| Layer | Choice |
|---|---|
| **Framework** | FastAPI `0.111.0` (Python 3.11) |
| **Data access** | Raw SQL via `psycopg2` `ThreadedConnectionPool` (`minconn=1`, `maxconn=20`) — no ORM |
| **Cache / queue backing** | Redis `5.0.6` — cache-aside search, OTPs, waitlists, idempotency, plus the Celery broker & result backend |
| **Background jobs** | Celery `>=5.3.0` — payment reminders & reservation auto-cancellation |
| **Auth** | JWT (`PyJWT` for signing, `python-jose` for verification), `bcrypt` password hashing via Passlib |
| **Rate limiting** | `slowapi` (in-memory) |
| **Fuzzy search** | PostgreSQL `pg_trgm` trigram distance |
| **QR codes** | `qrcode` + `Pillow` |
| **Testing** | `pytest` + FastAPI `TestClient` |

### 🔑 Key Features

| Feature | Summary |
|---|---|
| **OTP auth** | 6-digit code, 120s TTL in Redis, rate-limited to 3/min/IP; used by signup, login, and password reset alike |
| **Ticket search** | 7 optional filters, 60-second cache-aside, `pg_trgm` fuzzy fallback when an exact/`ILIKE` search returns 0 rows |
| **Surge pricing** | Display-only **+15%** when `0 < remaining_capacity < 1,000` (a hardcoded `total_capacity = 5,000` is used for every ticket) — never persisted to `tickets.price`, and **not** what `POST /api/payments/` actually charges |
| **Timed reservations** | 15-minute hold under `SELECT ... FOR UPDATE`; checks both `users.is_active` and `tickets.is_active` before allowing a reservation |
| **Sold-out waitlist** | A Redis list (`RPUSH`/`LPOP`), popped with a mock SMS log line when a paid reservation is cancelled or lazily expires during a payment attempt |
| **Idempotent payments** | Requires an `Idempotency-Key` header; the response is cached per-user for 24h and includes a base64 QR-code PNG on success |
| **Reservation lifecycle** | Two independent Celery tasks per reservation — a 13-minute payment reminder and a 15-minute auto-cancellation, each re-checking status under a row lock |
| **Admin/Support dashboard** | Aggregated revenue/sales/cancellation/report stats, a full reservation list, and a generic status-update endpoint — gated by a `role` re-check against the database, not the JWT's `role` claim |
| **Rate limiting** | `POST /api/auth/otp` (3/min) and `GET /api/tickets/search` (20/min), both per client IP, in-memory rather than Redis-backed |

### 📡 API Reference (Summary)

**Base URL:** `http://localhost:8000` · **Auth:** `Authorization: Bearer <JWT>` unless noted below. Full request/response schemas, validation rules, and worked `curl` examples for every endpoint are in **[`docs/Phase3/Phase3_Backend_Implementation.md` §3](docs/Phase3/Phase3_Backend_Implementation.md#3-complete-api-reference)**.

<details>
<summary><strong>Click to expand all 21 endpoints</strong></summary>

| Method & Path | Auth | Description |
|---|:---:|---|
| `GET /` | — | Health check (Postgres + Redis connectivity) |
| `POST /api/auth/otp` | — | Request a 6-digit OTP (3/min rate limit) |
| `POST /api/auth/signup` | — | Verify OTP, create account, return a JWT |
| `POST /api/auth/login` | — | OAuth2 form login (`username`/`password`), return a JWT |
| `POST /api/auth/reset-password` | — | Reset password via OTP, no old password required |
| `GET /api/auth/me/test-auth` | 🔒 | Diagnostic — confirms a token resolves to a real user |
| `GET /api/tickets/search` | — | Multi-filter search, cached, with fuzzy fallback (20/min rate limit) |
| `GET /api/tickets/{ticket_id}` | — | Full ticket detail with sport-specific `JOIN`/`COALESCE` |
| `GET /api/cities-venues` | — | Distinct cities/venues for upcoming matches |
| `POST /api/reservations/` | 🔒 | Reserve a ticket for 15 minutes |
| `POST /api/reservations/waitlist` | 🔒 | Join the waitlist for a sold-out ticket |
| `POST /api/payments/` | 🔒 | Pay for a reservation (requires `Idempotency-Key`) |
| `GET /api/payments/cancellation-penalty/{reservation_id}` | 🔒 | Preview the refund/penalty for cancelling |
| `POST /api/payments/cancel` | 🔒 | Cancel a paid reservation |
| `GET /api/user/bookings` | 🔒 | Current user's booking history |
| `PUT /api/user/profile` | 🔒 | Update name/city, invalidates the profile-cache key |
| `POST /api/reports/` | 🔒 | Submit a support report |
| `GET /api/reports/` | 🔒 | List the current user's own reports |
| `GET /api/admin/dashboard-stats` | 🔒🛡️ | Aggregated platform metrics |
| `GET /api/admin/tickets` | 🔒🛡️ | All reservations, joined with user/payment info |
| `PUT /api/admin/manage` | 🔒🛡️ | Update a report's or reservation's status |

🔒 = Bearer JWT · 🛡️ = additionally requires `role` in `('admin', 'support')`, re-checked against the database on every call

</details>

### 🗄️ Database & Redis Configuration

- **PostgreSQL** — same schema as Phase 1/2, reached at `localhost:5433` from the host (mapped from the container's `5432`) or `postgres_db:5432` from inside the Compose network.
- **Redis backs five distinct things**, all through one shared client (`app/redis_client.py`):

  | Key pattern | Purpose | TTL |
  |---|---|---|
  | `otp:{phone_number}` | Login / signup / reset-password OTP | 120s |
  | `tickets:search:{...7 filter values...}` | Cache-aside for ticket search results | 60s |
  | `user:profile:{user_id}` | Profile-cache invalidation hook *(not currently written to)* | — |
  | `waitlist:{ticket_id}` | Sold-out-ticket waiting list (Redis list, **no DB backing** — lost if Redis is flushed) | none |
  | `payment_idempotency:{user_id}:{idempotency_key}` | Cached payment response, per user & key | 24h |

- **JWT:** `HS256`, 120-minute access tokens by default (`ACCESS_TOKEN_EXPIRE_MINUTES`) — signed with `PyJWT` and verified with `python-jose`; both libraries are in play, which is functionally fine but worth knowing when debugging token issues.
- The full environment-variable table, CORS origins, and the exact Celery worker command are in [`docs/Phase3/Phase3_Backend_Implementation.md` §2](docs/Phase3/Phase3_Backend_Implementation.md#2-database--redis-configuration).

### ⚙️ Cache Invalidation & Sync Strategy

Cache-aside patterns, invalidation triggers, transaction-safety ordering (why a DB commit always happens *before* the corresponding cache entry is cleared), and Redis key lifecycles are documented separately in **[`docs/Phase3/Database_Sync_Cache_Invalidation_Strategy.md`](docs/Phase3/Database_Sync_Cache_Invalidation_Strategy.md)**.

### 🚀 Running the Backend

```bash
# 1. Clone the repository and create a .env file in the repo root
#    (see backend/.env.example, or the full setup guide linked below,
#    for the complete list of required variables)
git clone https://github.com/MohammafAfra83/SportsTicketPlatform.git
cd SportsTicketPlatform

# 2. Bring up all four services — database, Redis, API, and the Celery worker
docker compose up --build -d

# 3. Verify
curl http://localhost:8000/
```

Interactive docs are auto-generated by FastAPI: Swagger UI at `http://localhost:8000/docs`, ReDoc at `/redoc`. Without the `celery_worker` container/process running, reservations still succeed, but the 13-/15-minute reminder and auto-cancellation jobs never fire. The complete setup guide — including the local-venv alternative, every required `.env` variable, and how to confirm the Celery worker actually registered its tasks — is in [`docs/Phase3/Phase3_Backend_Implementation.md` §1](docs/Phase3/Phase3_Backend_Implementation.md#1-setup--running-the-server).

### 🧪 Testing

- **Postman:** import `backend/postman/openapi.json` (an auto-generated OpenAPI spec) and `backend/postman/Local_Environment.json`. ⚠️ The checked-in `openapi.json` predates this revision's two newest endpoints — `POST /api/reservations/waitlist` and `POST /api/auth/reset-password` aren't in it yet, so test those two via `curl` or a manually added request until the spec is regenerated.
- **curl:** a full end-to-end user-journey script — signup → search → reserve → pay with idempotency → cancel → waitlist → password reset — is in [`docs/Phase3/Phase3_Backend_Implementation.md` §4.2](docs/Phase3/Phase3_Backend_Implementation.md#42-testing-with-curl--full-user-journey).
- **pytest:** `backend/tests/` currently covers two cases — an unauthenticated reservation attempt (expects `401`) and ticket search, unfiltered and filtered (expects `200`). None of this phase's newer behavior (idempotency, waitlist, surge pricing, rate limiting, the `is_active` checks) has test coverage yet.
  ```bash
  pytest -v --tb=short                                # locally
  docker exec sports_ticket_api python -m pytest -v   # inside the running container
  ```
- **CI:** every push/PR now builds the *entire* stack (Postgres, Redis, API, Celery worker) via Docker Compose and runs the `pytest` suite inside the `api` container — see [CI/CD Pipeline](#-cicd-pipeline) below.

### 📝 Known Implementation Notes & Open Items

Caught by reading the source directly rather than relying on prior notes. The full, numbered, revision-tracked changelog lives in [`docs/Phase3/Phase3_Backend_Implementation.md` §6](docs/Phase3/Phase3_Backend_Implementation.md#6-implementation-notes-worth-knowing) — highlights:

- **Surge pricing is display-only.** The `+15%` price shown by ticket search/detail is computed fresh in Python and never written to `tickets.price` — `POST /api/payments/` always charges the raw base price, so what a customer sees while browsing and what they're actually charged at checkout can genuinely differ.
- **Confirmed gap:** the Celery-driven 15-minute auto-cancellation (`cancel_expired_reservation_task`) restores `remaining_capacity` but does **not** pop the ticket's waitlist — only the two payments-side paths (`POST /api/payments/`'s lazy-expiry check and `POST /api/payments/cancel`) do. A seat freed by a silent auto-expiry currently notifies no one on the waitlist.
- **`reservations.cancelled_by_support_id`** is defined in the schema but never set by any reviewed cancellation path.
- **No API endpoint exists to deactivate or reactivate a user account** — `users.is_active` is enforced almost everywhere it matters (login, reservations, payments, cancellations) but can currently only be toggled with a direct `UPDATE` statement.
- **`app/utils/email_sender.py`** is a complete, real SMTP-based OTP sender that isn't called from any route — this is a deliberate placeholder for real delivery (credentials shouldn't be hardcoded into the repo), not an oversight; OTPs are logged to the server console instead.
- **The checked-in `backend/postman/openapi.json` is stale** relative to this revision — it doesn't yet include `POST /api/reservations/waitlist` or `POST /api/auth/reset-password`.

📄 **Full technical write-up** (endpoint-by-endpoint reference, every request/response body, and the complete changelog): [`docs/Phase3/Phase3_Backend_Implementation.md`](docs/Phase3/Phase3_Backend_Implementation.md)
📄 **Cache & sync architecture deep-dive:** [`docs/Phase3/Database_Sync_Cache_Invalidation_Strategy.md`](docs/Phase3/Database_Sync_Cache_Invalidation_Strategy.md)

---

## 🔁 CI/CD Pipeline

Every push to `main` or `phase3-backend-implementation`, and every pull request into `main`, triggers the workflow defined in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — now named **"Phase 3 CI – Full Stack Verification"** and rebuilt to exercise the whole application, not just the database tier:

<div align="center">

| Step | Action                                                                                      |
| :--: | ------------------------------------------------------------------------------------------- |
|  1️⃣  | Checkout repository code                                                                    |
|  2️⃣  | Write a CI-only `.env` file (test JWT secret, Compose-network hostnames)                    |
|  3️⃣  | `chmod +x database/init.sh`                                                                 |
|  4️⃣  | Log in to Docker Hub (via repository secrets) to avoid image-pull rate limits               |
|  5️⃣  | `docker compose --env-file .env up -d --build` — builds and starts **all four services**    |
|  6️⃣  | Poll `sports_ticket_api`'s logs for "Application startup complete"; fail fast (with logs) if the container isn't running |
|  7️⃣  | Print `postgres_db`, `api`, and `celery_worker` container logs                              |
|  8️⃣  | Verify database integrity — `\dt`, plus row counts on `users` and `tickets`                 |
|  9️⃣  | Run the `pytest` suite **inside the running `api` container**                               |

</div>

> ✅ This confirms the schema, seed data, and now the full **FastAPI + Redis + Celery** stack all build, start, and pass their tests together in a clean environment on every push — not just on a developer's machine. Note: unlike the Phase 1/2 pipeline, this workflow doesn't run an explicit `docker compose down` teardown step at the end; GitHub Actions' ephemeral runners discard the containers regardless, but it means there's no final teardown/health-check step after the `pytest` run.

---

## 🚀 Getting Started

**Prerequisites:** Docker & Docker Compose **or** PostgreSQL 16+ with the `psql` CLI (database-only path)

### 🐳 Option 1 — Docker (Recommended)

One command builds every container and leaves you with a fully-seeded, indexed, query-ready database — and, **as of Phase 3**, a running REST API and Celery worker too:

```bash
# 1. Clone the repository
git clone https://github.com/MohammafAfra83/SportsTicketPlatform.git
cd SportsTicketPlatform

# 2. Create a .env file in the repo root (required by the api/celery_worker
#    services — see backend/.env.example, or Phase 3 → Running the Backend
#    above, for the full variable list)

# 3. Build and start all four services: postgres_db, redis, api, celery_worker
docker compose up --build -d

# 4. (Optional) Connect and explore the database directly
docker exec -it sports_ticket_postgres psql -U postgres -d sports_ticket_db

# 5. Or hit the API
curl http://localhost:8000/
```

> ℹ️ If you only want the **database tier** (e.g. for grading Phases 1–2 in isolation, no `.env` file needed), start just those two services: `docker compose up -d postgres_db redis`.

### 🖥️ Option 2 — Local `psql` (Classic, Database Only)

Run the same five scripts manually, in order, against a local PostgreSQL instance:

```bash
# 1. Clone the repository
git clone https://github.com/MohammafAfra83/SportsTicketPlatform.git
cd SportsTicketPlatform

# 2. Create the database
createdb sports_ticket_db

# 3. Apply each script, in order
psql -d sports_ticket_db -f database/scripts/schema.sql
psql -d sports_ticket_db -f database/scripts/seed.sql
psql -d sports_ticket_db -f database/scripts/indexes.sql
psql -d sports_ticket_db -f database/scripts/procedures.sql
psql -d sports_ticket_db -f database/scripts/queries.sql
```

> ℹ️ The `pg_trgm` extension is enabled automatically by `indexes.sql` to support fast fuzzy text search on `tickets.venue_name`, `tickets.home_team`, `tickets.away_team`, `users.first_name`/`last_name` — and, as of Phase 3, the ticket-search "did you mean" fallback in the API (see [Phase 3](#phase-3)).

---

## 🗺 Project Roadmap — Upcoming Phases

_This section previews the remaining phase per the project specification. It will be expanded into its own full `## 🏛️ Phase 4` section — with real deliverables, code, and documentation — once completed. (Phase 3 was previewed here too, until it was completed — see the full [Phase 3](#phase-3) section above.)_

### 🏅 Phase 4 — Client Application & ElasticSearch

**Status:** ⏳ Planned

**Goal:** Ship a client UI and migrate ticket search from SQL to **ElasticSearch** for improved performance.

- Set up ElasticSearch indexing for tickets, with two-way sync between the SQL database and ElasticSearch on ticket create/update/delete.
- Route ticket-search traffic to ElasticSearch instead of the primary database.
- Build core client screens: login, ticket search & filtering, ticket details, reservation & payment flow, and a user panel (booking history + report submission).
- **Deliverable:** Client-side source code (web or mobile), ElasticSearch connection/indexing scripts, and documentation of the UI–API interaction.
- 🌟 **Bonus (optional):** Autocomplete/smart filtering in ElasticSearch, or a native mobile client.

### 🐳 Cross-Phase Bonus — Full-Stack Dockerization

**Status:** ✅ Fully Implemented — **database tier (Phase 2)** and **backend API + Redis + Celery worker (Phase 3)** are all containerized

_Not one of the 4 core phases —_ as an additional, project-wide extra-credit feature, the full stack is **containerized with Docker / Docker Compose** for one-command local setup and reproducible deployment. As of Phase 3, all four services — `postgres_db`, `redis`, `api`, and `celery_worker` — build and start with a single `docker compose up --build -d`, and the CI pipeline verifies the entire stack (not just the database) on every push. Only **Phase 4**'s client application and ElasticSearch layer remain outside `docker-compose.yml`.

---

## 👤 Author & License

<div align="center">

**Mohammad Afra**

[![GitHub](https://img.shields.io/badge/GitHub-MohammafAfra83-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/MohammafAfra83)

This project is developed for academic and portfolio purposes as part of a multi-phase database engineering curriculum.

</div>
