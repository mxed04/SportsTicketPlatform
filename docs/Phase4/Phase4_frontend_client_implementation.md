# Phase 4 — Frontend Client Implementation
### SportsTicketPlatform · React SPA (`phase4-client-elasticsearch`)

> **Scope of this document:** the React/Vite client shipped in this phase — routing, auth handling, the API client layer, every page's data flow, the complete client→API contract as implemented in the source, and a source-verified list of gaps/discrepancies. Everything below was extracted by reading the actual `.jsx`/`.js`/config files, not inferred from naming conventions or assumed from the Phase 3 backend docs.
>
> **Important caveat:** this phase's backend (FastAPI + Elasticsearch, per the branch name) was **not** provided as source in this session — only the client. Anywhere the exact backend contract matters (response field names, whether a header is enforced, etc.) this doc states what the **frontend sends and expects**, and flags explicitly where that hasn't been cross-checked against backend source. Treat those spots as open verification items, not confirmed facts.

---

## 1. Tech Stack

| Layer | Choice | Version (from `package.json`) |
|---|---|---|
| Framework | React | `^19.2.8` |
| Build tool | Vite | `^8.2.0` (`@vitejs/plugin-react ^6.0.4`) |
| Routing | react-router-dom | `^7.18.2` |
| HTTP client | axios | `^1.19.0` |
| Toasts/notifications | react-hot-toast | `^2.6.0` |
| Icons | lucide-react | `^1.31.0` |
| Styling | Tailwind CSS | `^3.4.19` (+ `postcss`, `autoprefixer`) |
| Linting | ESLint (flat config) | `^10.8.0` + `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh` |
| Language | JavaScript (JSX), no TypeScript | — |

No state management library (Redux/Zustand/Context) is used — every page manages its own local state with `useState`/`useEffect` and talks to the API directly. There is no shared client-side cache; every page re-fetches on mount.

## 2. Project Structure

```
frontend/
├── Dockerfile                  # multi-stage build → nginx
├── index.html                  # lang="fa" dir="rtl", mounts #root
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── eslint.config.js
└── src/
    ├── main.jsx                 # ReactDOM root, wraps <App/> in StrictMode
    ├── App.jsx                  # Router, route guards, route table
    ├── api.js                   # single axios instance + auth interceptor
    ├── index.css                # Tailwind directives + base body color
    ├── App.css                  # empty
    ├── assets/                  # hero.png, react.svg, vite.svg
    └── pages/
        ├── Login.jsx             # login / signup / forgot-password (3-in-1)
        ├── Dashboard.jsx         # ticket search & browse (Elasticsearch)
        ├── TicketDetail.jsx      # single ticket + reserve action
        ├── PaymentGateway.jsx    # ✅ current payment flow (routed)
        ├── Payment.jsx           # ⚠️ legacy payment flow (dead code, unrouted)
        ├── Profile.jsx           # bookings history + account settings
        ├── Support.jsx           # user-facing support tickets
        └── AdminDashboard.jsx    # admin/support console (4 tabs)
```

## 3. Running & Deploying

**Local dev:**
```bash
npm install
npm run dev       # vite dev server
npm run build     # production bundle → dist/
npm run preview   # serve the production build locally
npm run lint
```

**Docker (production):** the `Dockerfile` is a two-stage build:
1. `node:20-alpine` — installs deps, runs `npm run build`.
2. `nginx:alpine` — copies `dist/` into `/usr/share/nginx/html`, serves on port 80 with an inline `nginx.conf` that adds `try_files $uri $uri/ /index.html;` for SPA client-side routing.

⚠️ **No build-time API URL configuration.** The backend base URL is a hardcoded string in `src/api.js` (see §4). Vite's `import.meta.env` mechanism is not used anywhere, so the Docker image bakes in whatever URL is hardcoded at build time — pointing this client at a non-localhost backend requires editing the source and rebuilding the image, not just setting an environment variable at container run time.

## 4. API Client Layer (`src/api.js`)

A single shared axios instance is used everywhere:

```js
const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: { 'Content-Type': 'application/json' },
});
```

A request interceptor reads `localStorage.getItem('token')` and, if present, attaches `Authorization: Bearer <token>` to every outgoing request. There is **no response interceptor** — 401/403 handling (e.g. auto-logout on expired token) is left to each page's individual `catch` block, and none of the pages currently implement that; an expired token simply produces per-request toast errors rather than a redirect to `/`.

## 5. Routing & Auth Guards (`src/App.jsx`)

| Path | Component | Guard |
|---|---|---|
| `/` | `Login` | none |
| `/dashboard` | `Dashboard` | `PrivateRoute` |
| `/tickets/:id` | `TicketDetail` | `PrivateRoute` |
| `/payment/:reservationId` | `PaymentGateway` | `PrivateRoute` |
| `/profile` | `Profile` | `PrivateRoute` |
| `/support` | `Support` | `PrivateRoute` |
| `/admin` | `AdminDashboard` | `AdminRoute` |

**`PrivateRoute`** — redirects to `/` if `localStorage.token` is absent. It does not validate the token's structure or expiry, only its presence.

**`AdminRoute`** — additionally decodes the JWT payload client-side (manual base64url decode, no signature check) to read `role`, redirecting non-`admin`/non-`support` users to `/dashboard` with a toast. Both `App.jsx` and `Dashboard.jsx`/`TicketDetail.jsx` each re-implement this same JWT-decoding helper independently (three near-identical copies of the same function) rather than sharing one utility — a maintenance smell worth consolidating in a future pass, not a bug.

🔓 **Security note:** this role check is a **UI convenience only**. Since the JWT signature is never verified client-side and the payload is just base64-decoded, it cannot be trusted as an authorization boundary — actual enforcement must happen (and per Phase 3 docs, does happen) on the backend for every admin endpoint. If any Phase 4 admin endpoint were ever added without a server-side role check, this client-side gate alone would not protect it.

Token storage is plain `localStorage` (not an httpOnly cookie), which is standard for this kind of SPA but does mean the token is readable by any script that runs in the page (XSS-exposed) — worth keeping in mind if a reviewer asks about session security.

## 6. Feature Walkthrough

### 6.1 Auth — `Login.jsx`
Single component with three modes (`login` / `signup` / `forgot`) toggled by local state, not separate routes.

- **Login:** submits `application/x-www-form-urlencoded` body (`username`, `password`) to `POST /auth/login` — this is the OAuth2 password-flow shape FastAPI's `OAuth2PasswordRequestForm` expects. On success, stores `res.data.access_token` in `localStorage.token` and hard-navigates to `/dashboard` (`window.location.href`, not `navigate()` — a full page reload rather than an SPA transition).
- **Signup:** two-step, OTP-verified:
  1. `POST /auth/otp` `{ phone_number }` → sends the code.
  2. `POST /auth/signup` `{ phone_number, otp_code, first_name, last_name, email, city, password }` → completes registration, then flips back to login mode.
- **Forgot password:** same OTP endpoint reused (`POST /auth/otp`), then `POST /auth/reset-password` `{ phone_number, otp_code, new_password }`.

⚠️ The `/auth/otp` and `/auth/signup` endpoints are not part of the Phase 3 backend documentation recorded previously — they may be new in this phase's backend or simply weren't captured before. Recommend confirming their existence/shape against the actual Phase 4 backend source before treating this section as fully verified end-to-end.

Errors from all three flows are unwrapped via a shared `getErrorMessage()` helper that handles FastAPI's typical `detail` shapes: a plain string, or a Pydantic validation array (joined as `"msg | msg"`).

### 6.2 Ticket Search — `Dashboard.jsx`
This is the page most clearly tied to the branch's "elasticsearch" focus.

- Calls `GET /tickets/search` with query params `q` (free text), `sport_type` (`football`/`volleyball`/`basketball`/omitted for "all"), and `venue`.
- The search is **debounced 600ms** client-side (`setTimeout`/`clearTimeout` in a `useEffect` keyed on the three filter values) rather than firing on every keystroke.
- Response is read flexibly: `response.data?.tickets || response.data || []` — the frontend doesn't assume a specific envelope shape.
- `429 Too Many Requests` responses are **deliberately swallowed** (no toast, no console error) so that rapid typing against a rate-limited endpoint doesn't spam the user with errors — everything else still logs and toasts.
- Each ticket card computes `isSurge = capacity > 0 && capacity < 1000` purely from `remaining_capacity`/`capacity` to show a "🔥 limited capacity" badge — this is a client-side heuristic, not a value read from any backend "surge" field.

### 6.3 Ticket Detail & Reservation — `TicketDetail.jsx`
- `GET /tickets/:id` on mount.
- "Reserve" button (hidden/disabled for admin/support role) calls `POST /reservations/` `{ ticket_id, quantity: 1 }`, then reads the reservation id defensively as `data.reservation_id || data.id` (the frontend does not assume which key the backend returns).
- On success it navigates to `/payment/:reservationId`, passing `finalPrice` and `title` through router `state` (not re-fetched on the payment page) — see the next section for why that matters.

### 6.4 Payment — `PaymentGateway.jsx` (current) vs. `Payment.jsx` (legacy)

**`PaymentGateway.jsx`** is the only one actually routed (`App.jsx` explicitly comments *"Old Payment is removed"*):
- 15-minute countdown timer; on expiry, toasts and redirects to `/profile` (does **not** call any cancel endpoint itself — it assumes the backend's own reservation-expiry job, per Phase 3's Celery auto-cancellation task, handles the actual release).
- Price shown comes only from the `finalPrice` passed via navigation `state` from `TicketDetail.jsx` — it is never re-fetched from the server on this page. If the user refreshes the payment page directly, `location.state` is lost and `finalPrice` silently defaults to `0`, disabling the pay button.
- Submits `POST /payments/` `{ reservation_id, payment_method: 'online_gateway' }`.
- ⚠️ **No `Idempotency-Key` header is sent.** Per the Phase 3 backend documentation, the payments endpoint is designed to be idempotent via this header. This frontend does not set it, so either (a) the backend endpoint doesn't actually enforce/require it and works fine without it, or (b) double-submits (e.g. a user double-clicking, or a retried request after a flaky network) are not protected against from this client. This should be confirmed against the current backend source rather than assumed either way.
- On success: shows a toast and navigates to `/profile`. **No QR code or digital ticket is displayed anywhere on success** — despite Phase 3 documentation noting the payment endpoint returns a QR-code digital ticket, this client never renders it, and `Profile.jsx`'s booking list has no QR/ticket image element either. This looks like a real feature gap between backend capability and frontend presentation.

**`Payment.jsx`** still exists in `src/pages/` and is fully functional in isolation, but is **not imported or routed anywhere** — dead code left over from a prior version. Differences from the current flow, for the record: 10-minute timer (vs. 15), and it posts an `amount` field in the payment body (the current `PaymentGateway.jsx` does not, consistent with the backend deriving price server-side from `tickets.price`). Safe to delete in a cleanup pass, but harmless to leave since nothing imports it.

### 6.5 Profile — `Profile.jsx`
Two tabs: **Bookings** and **Settings**.

- **Bookings tab:**
  - `GET /user/profile` for account header info; `GET /user/bookings` for the list.
  - For any booking missing `price`/`venue`, it **enriches per-item** with an extra `GET /tickets/:id` call (`Promise.all` over the list) — meaning a bookings page with N incomplete bookings can fire N+1 requests on load.
  - Client-side status normalization: backend `confirmed` → displayed as `paid`; everything else falls into `pending` unless explicitly `cancelled`. The three summary-stat tiles are also computed from this normalized bucket (**"failed/pending" tile deliberately merges two distinct backend states into one visual bucket**, which could hide a genuinely failed payment behind the same badge as a merely-unpaid reservation).
  - Sort order: pending bookings first, then upcoming matches soonest-first, then past matches most-recent-first.
  - Cancel action → `POST /payments/cancel` `{ reservation_id }`; shows a refund amount from `response.data.refund_amount` if present and truthy. Different confirm-dialog copy is shown depending on whether the booking is `pending` (no penalty implied) vs. `paid` (penalty implied) — purely a UX string, the actual penalty logic is entirely server-side.
  - "Resume payment" on a pending booking re-navigates to `/payment/:id` reusing the same `finalPrice`/`title` `state`-passing pattern as §6.3 — same refresh-loses-price caveat applies here too.
- **Settings tab:** `PUT /user/profile` `{ first_name, last_name, email, city }`. Phone number is displayed but always disabled/non-editable in this form.
- Logout simply clears `token` and `role` from `localStorage` and navigates to `/` — no server-side call (no `/auth/logout` endpoint is used).

### 6.6 Support — `Support.jsx`
- `GET /reports/` on mount to populate an accordion list of the user's own past tickets.
- `POST /reports/` `{ category, report_text, reservation_id: null }` — the category dropdown is a fixed set of Persian-language strings (e.g. `"مشکل در پرداخت"`) sent directly as the `category` value, not a coded enum.
- ⚠️ `reservation_id` is **hardcoded to `null`** on every submission — there is no UI affordance for a user to associate their support request with one of their actual bookings, even though `AdminDashboard.jsx` clearly expects to display a linked `reservation_id` on reports when present. This is a real, unused capability on the backend side of the contract.
- Each report can be expanded to show `admin_response` if the admin/support team has replied; otherwise a "still pending" placeholder is shown.

### 6.7 Admin Console — `AdminDashboard.jsx`
Four tabs in a persistent sidebar; only `overview` and `reports` data are fetched eagerly on mount, `tickets` and `users` are lazy-loaded the first time their tab is opened.

| Tab | Endpoint(s) | Notes |
|---|---|---|
| Overview | `GET /admin/dashboard-stats` | Populates 4 KPI tiles (`total_revenue`, `total_tickets_sold`, `total_cancellations`, `pending_reports`) + a preview of the 5 most recent reports (reuses the `reports` state already fetched for the Reports tab). |
| Tickets | `GET /admin/tickets` | Read-only table. No create/edit/delete ticket UI exists anywhere in this client — ticket management is view-only from the frontend's perspective. |
| Users | `GET /admin/users` | Read-only table (role, active status, join date). No admin action to change a user's role or deactivate an account exists in the UI, despite `users.is_active` being displayed. |
| Reports | `GET /admin/reports`, `PUT /admin/reports/:id/reply` | Master-detail layout: list on the right (RTL), reply form on the left. Replying sends `{ admin_response, status: 'resolved' }` and always force-sets status to `resolved` — there's no way from this UI to set an intermediate `in_progress` status even though the badge-rendering logic elsewhere clearly anticipates that value existing. |

The `pending_reports` count from the stats call also drives a small red badge on the sidebar's "Reports" nav item.

## 7. Complete Client → API Contract

Base URL: `http://localhost:8000/api` (hardcoded, see §4). All authenticated calls rely on the axios interceptor attaching the bearer token — no page manually sets the `Authorization` header.

| Method & Path | Called from | Request body / params | What the client reads from the response |
|---|---|---|---|
| `POST /auth/login` | Login.jsx | form-urlencoded `username`, `password` | `access_token` |
| `POST /auth/otp` | Login.jsx (signup + forgot) | `{ phone_number }` | — (success/failure only) |
| `POST /auth/signup` | Login.jsx | `{ phone_number, otp_code, first_name, last_name, email, city, password }` | — |
| `POST /auth/reset-password` | Login.jsx | `{ phone_number, otp_code, new_password }` | — |
| `GET /tickets/search` | Dashboard.jsx | query: `q?`, `sport_type?`, `venue?` | `.tickets` or bare array |
| `GET /tickets/:id` | TicketDetail.jsx, Profile.jsx (enrichment) | — | ticket object (`price`, `venue_name`/`venue`, `remaining_capacity`, etc.) |
| `POST /reservations/` | TicketDetail.jsx | `{ ticket_id, quantity: 1 }` | `reservation_id` or `id` |
| `POST /payments/` | PaymentGateway.jsx | `{ reservation_id, payment_method: 'online_gateway' }` | — (no QR/ticket payload consumed) |
| `POST /payments/cancel` | Profile.jsx | `{ reservation_id }` | `message`, `refund_amount?` |
| `GET /user/profile` | Profile.jsx | — | `first_name`, `last_name`, `email`, `city`, `phone_number` |
| `PUT /user/profile` | Profile.jsx | `{ first_name, last_name, email, city }` | — |
| `GET /user/bookings` | Profile.jsx | — | `.bookings` or bare array |
| `GET /reports/` | Support.jsx | — | `.reports` or bare array |
| `POST /reports/` | Support.jsx | `{ category, report_text, reservation_id: null }` | `message` |
| `GET /admin/dashboard-stats` | AdminDashboard.jsx | — | `total_revenue`, `total_tickets_sold`, `total_cancellations`, `pending_reports` |
| `GET /admin/reports` | AdminDashboard.jsx | — | `.reports` or bare array |
| `PUT /admin/reports/:id/reply` | AdminDashboard.jsx | `{ admin_response, status: 'resolved' }` | — |
| `GET /admin/users` | AdminDashboard.jsx | — | array of user rows |
| `GET /admin/tickets` | AdminDashboard.jsx | — | array of ticket rows |

Every response shape above is read the way this specific client happens to read it (often defensively, with `||` fallbacks) — it is **not** a guaranteed backend schema, just what this code currently tolerates.

## 8. Known Gaps & Discrepancies (Frontend-Side)

Numbered for cross-referencing, in the spirit of the Phase 3 README's §6.

1. **No environment-based API URL.** `baseURL` is hardcoded in `src/api.js`; there is no `.env`/`import.meta.env` usage, so pointing the built image at anything other than `http://localhost:8000/api` requires a source edit and rebuild.
2. **No `Idempotency-Key` header on `POST /payments/`**, despite the Phase 3 backend documentation describing this endpoint as designed to be idempotent via that header. Not confirmed whether the backend currently enforces it — needs cross-check against backend source for this phase.
3. **No QR code / digital ticket rendering anywhere in the client**, even though the backend is documented to return one on successful payment. Neither the payment success path nor the bookings list surfaces it.
4. **Zero frontend integration with the sold-out waitlist feature.** Nothing in this client calls a `/waitlist`-style endpoint or offers a "notify me" action when `remaining_capacity <= 0` — the Reserve button is simply disabled with no alternative path.
5. **`reports.reservation_id` is always sent as `null`** from the user-facing Support form, even though `AdminDashboard.jsx` is written to display it when present — the field exists in the contract but the client never populates it.
6. **Legacy `Payment.jsx` is dead code** — fully functional but unrouted since `App.jsx` explicitly removed its route in favor of `PaymentGateway.jsx`. Safe to delete.
7. **Payment/booking price is not re-fetchable on refresh.** `PaymentGateway.jsx` and the "resume payment" flow in `Profile.jsx` both rely entirely on React Router `state` for the price/title; a hard refresh on `/payment/:id` loses that state and the price silently falls back to `0`, disabling checkout.
8. **JWT role-decoding logic is duplicated three times** (`App.jsx`, `Dashboard.jsx`, `TicketDetail.jsx`) instead of being a shared utility — not a bug, but a consolidation opportunity.
9. **No response interceptor / global 401 handling.** An expired or invalid token produces scattered per-page error toasts rather than a consistent redirect to the login screen.
10. **Admin console is read-only for Users and Tickets.** No create/edit ticket UI and no user role/active-status management UI exist, despite the data being displayed.
11. **Report reply flow only ever sets `status: 'resolved'`** — there is no UI path to set the `in_progress` intermediate state that the badge-rendering logic elsewhere already anticipates.
12. **`/auth/otp` and `/auth/signup` are new/unverified against backend source in this session** — flagged for confirmation rather than treated as established fact, per the project's read-the-source-directly convention.
13. `src/App.css` is present but empty; `src/index.css` still has CRLF line endings (Windows-editor artifact), consistent with the pattern seen in other project files in earlier phases.

## 9. Localization / RTL Notes

- `index.html` sets `lang="fa" dir="rtl"` globally; every page additionally sets `dir="rtl"` on its root container (redundant with the `<html>`-level setting, but harmless).
- All dates are formatted with `.toLocaleDateString('fa-IR')` (Persian calendar/locale), not a raw ISO string.
- All user-facing copy (labels, toasts, button text, empty-state messages) is Persian; only data values (team names, city names, error `detail` payloads echoed from the backend) may appear in whatever language the backend returns them in.
- Currency is displayed as raw Toman values via `Number(x).toLocaleString()` with a trailing "تومان" label — no currency-formatting API is used, just locale-aware thousands separators.

---

*This document reflects only the files provided for this phase (`src.zip` plus root-level config files). Backend-side confirmation is still needed for the items flagged in §8 before treating the full client↔server contract as verified end-to-end.*