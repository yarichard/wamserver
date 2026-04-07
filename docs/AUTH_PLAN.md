# Authentication Plan: OAuth2 / JWT for wamserver

## Overview

The app acts as its own authorization server — no external OAuth2 provider. It issues signed JWT
access tokens on login (standard "resource owner password" pattern). All protected endpoints require
a `Bearer` token; the WebSocket accepts the token as a query parameter.

---

## Phase A — Backend

### A.1 New dependencies (`Cargo.toml`)

| Crate | Purpose |
|---|---|
| `jsonwebtoken` | JWT signing/verification (HS256) |
| `argon2` | Password hashing (stronger than bcrypt) |
| `axum-extra` (with `typed-header` feature) | Typed `Authorization: Bearer` extractor |
| `uuid` | JWT `jti` claim (optional, enables revocation later) |

### A.2 Database migration — `m20260331_000001_add_auth_fields.rs`

- Add `password_hash TEXT NOT NULL DEFAULT ''` to `user` table
- Add `created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` to `user` table
- Update entity `entity/src/user.rs` with the two new fields

### A.3 New `src/auth/` module

```
src/auth/
├── mod.rs          — re-exports
├── claims.rs       — JwtClaims struct + encode/decode helpers
├── password.rs     — hash_password() / verify_password()
└── middleware.rs   — RequireAuth extractor (FromRequestParts)
```

- **`claims.rs`**: `JwtClaims { sub: i32, email: String, exp: usize }` — encode with `JWT_SECRET`
  env var (added to `AppConfig`), 24h expiry.
- **`middleware.rs`**: `RequireAuth` implements `FromRequestParts` — extracts
  `Authorization: Bearer <token>` header, validates JWT, returns `Claims` or `401 Unauthorized`.
  Used as an extractor parameter on protected handlers.

### A.4 New routes — `src/routes/auth.rs`

| Method | Path | Handler | Auth required |
|---|---|---|---|
| `POST` | `/api/auth/register` | `register` | No |
| `POST` | `/api/auth/login` | `login` | No |
| `GET` | `/api/auth/me` | `get_me` | Yes |

- **`register`**: accepts `{ email, name, password }`, hashes password with argon2, calls
  `db.create_user_with_password()`, returns `201` with user id.
- **`login`**: accepts `{ email, password }`, loads user by email, verifies password hash,
  returns `{ access_token, token_type: "Bearer", expires_in }`.
- **`get_me`**: requires `RequireAuth`, returns current user info from DB.

### A.5 Protect existing routes

Add `RequireAuth` extractor to all handlers in `services.rs` and `parameters.rs`. The extractor is
zero-cost when the token is valid — no middleware layer needed.

WebSocket (`socket.rs`): accept `?token=<jwt>` query parameter, validate before upgrading; reject
with `401` if invalid.

### A.6 `AppConfig` additions

- `jwt_secret: String` — from `JWT_SECRET` env var (required, no default)
- Already available via `Arc<AppConfig>` in state — no structural change needed

---

## Phase B — Frontend

### B.1 New dependencies (`frontend/package.json`)

| Package | Purpose |
|---|---|
| `jwt-decode` | Decode JWT claims client-side (no secret needed) |

Token stored in `localStorage` (simple, acceptable for this internal tool).

### B.2 New `AuthContext` (`src/contexts/AuthContext.jsx`)

- `login(email, password)` — POST `/api/auth/login`, store token, set axios default header
- `logout()` — clear token, redirect to `/login`
- `currentUser` — decoded claims from stored token
- `isAuthenticated` — derived boolean (token exists and not expired via `jwt-decode`)

### B.3 New `LoginPage` component (`src/components/LoginPage.jsx`)

- MUI `Card` with email + password fields (consistent with existing MUI usage)
- Calls `AuthContext.login()`, shows error on failure
- On success: redirects to `/front/` (main app)

### B.4 `PrivateRoute` wrapper (`src/components/PrivateRoute.jsx`)

- Checks `isAuthenticated`; redirects to `/login` if false
- Wraps all existing `/front/*` routes in `App.jsx`

### B.5 Axios interceptor (`src/config.js`)

- Attach `Authorization: Bearer <token>` to every request
- On `401` response: call `logout()` and redirect to `/login`

### B.6 WebSocket URL update (`src/contexts/WebSocketContext.jsx`)

- Append `?token=<jwt>` to the WebSocket URL

### B.7 New routes in `App.jsx`

```
/login          → LoginPage        (public)
/front/*        → PrivateRoute     → existing app
```

---

## Phase C — Environment & Infrastructure

| Variable | Description |
|---|---|
| `JWT_SECRET` | Secret key for JWT signing — **required**, minimum 32 chars |

Add `JWT_SECRET` to `.env` files and Docker environment configuration.

---

## Implementation Roadmap

| # | Task | Files |
|---|---|---|
| 1 | Add crate dependencies | `Cargo.toml` |
| 2 | DB migration + entity update | `migration/`, `entity/src/user.rs` |
| 3 | `src/auth/` module (claims, password, middleware) | new |
| 4 | `database/requests.rs` — add `get_user_by_email`, `create_user_with_password` | existing |
| 5 | `src/routes/auth.rs` — register / login / me | new |
| 6 | Wire auth routes into `main.rs` + add `JWT_SECRET` to `AppConfig` | `main.rs`, `config.rs` |
| 7 | Protect existing routes with `RequireAuth` extractor | `services.rs`, `parameters.rs`, `socket.rs` |
| 8 | Frontend `AuthContext` + `LoginPage` + `PrivateRoute` | new components |
| 9 | Axios interceptor + WebSocket token | `config.js`, `WebSocketContext.jsx` |
| 10 | Unit tests: hash/verify, JWT encode/decode, login 401 on bad password | `src/auth/` |

---

## Key Design Decisions

- **argon2 over bcrypt**: More memory-hard, recommended by OWASP 2024.
- **JWT over sessions**: Stateless — fits the existing Arc-based state design with no session store
  needed.
- **`RequireAuth` extractor over middleware layer**: More explicit — each handler opts in, making it
  impossible to accidentally forget protection on a new route (compared to a blanket `layer()` which
  could be bypassed by route ordering).
- **No refresh token in v1**: Access tokens expire in 24h. Refresh tokens add complexity (require a
  token store) and can be added in a follow-up.
