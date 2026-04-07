# wamserver Rust Codebase — Code Review

**Date**: 2026-04-02  
**Scope**: All Rust source files under `/workspaces/rust/wamserver/src/`, `entity/`, and `Cargo.toml`.

---

## Summary Table

| # | File | Line(s) | Severity | Issue |
|---|------|---------|----------|-------|
| 1 | `messaging/kafka.rs` | 24, 58 | **High** | `unwrap()` panics kill Kafka consumer task permanently |
| 2 | `routes/socket.rs` | 14–32 | **High** | JWT token exposed in URL query string |
| 3 | `routes/socket.rs` | 55–62 | **High** | Authenticated clients can flood all other WS clients |
| 4 | `messaging/websocket.rs` | 28–40 | Medium | `broadcast_message` always returns `Ok`, hides real errors |
| 5 | `main.rs` | 96–102 | **High** | Wildcard CORS in production allows cross-origin data theft |
| 6 | `routes/services.rs` | 77, 82 | Medium | `unwrap()` panics on DB error in read handlers |
| 7 | `messaging/kafka.rs` | 14–63 | Medium | Blocking Kafka I/O on async runtime thread |
| 8 | `messaging/sytral.rs` | 163–167 | Medium | New Kafka producer created every 5 seconds |
| 9 | `messaging/sytral.rs` | 126 | Low | New `reqwest::Client` created every 5 seconds |
| 10 | `routes/parameters.rs` | 13–19 | Medium | Kafka infrastructure details exposed to any JWT holder |
| 11 | `routes/auth.rs` | 55 | Medium | All DB errors mapped to 409 Conflict on register |
| 12 | `routes/services.rs` | 61 | **High** | `POST /api/user` creates users with empty password hash |
| 13 | `routes/auth.rs`, `services.rs` | various | Medium | No input length validation, Argon2 DoS via long password |

---

## Critical Issues

### 1. Kafka Consumer Panics on Every Poll Failure — Kills the Task

**File**: `src/messaging/kafka.rs`, lines 24 and 58  
**Severity**: High

`c.poll().unwrap()` and `c.commit_consumed().unwrap()` will panic if the Kafka broker is unreachable or a transient error occurs. Because this runs inside a `tokio::spawn` task with the `JoinHandle` discarded (`let _ =` in `main.rs:113`), the panic aborts the task silently with no restart logic. After one failure the entire Kafka consumption pipeline stops permanently for the lifetime of the process.

The consumer is recreated inside the loop on every iteration (lines 9–20), but `poll().unwrap()` panics before control reaches the `sleep` at the bottom, so the reconnect logic never fires on the error path.

**Fix**: Replace both `.unwrap()` calls with `match` or `?`-based error handling that logs and `continue`s or `break`s the loop, allowing the outer loop's `sleep` and reconnect to work as intended.

---

### 2. WebSocket Token Exposed in URL Query String

**File**: `src/routes/socket.rs`, lines 13–32  
**Severity**: High

The JWT is accepted as a plain URL query parameter (`?token=...`). Tokens in query strings are:
- Logged verbatim in every HTTP access log and reverse-proxy log by default.
- Stored in browser history.
- Leaked in the `Referer` header when navigating away.

The existing `Authorization: Bearer` header mechanism already works for all other REST endpoints.

**Fix**: Accept the token as the first WebSocket message immediately after the upgrade, before forwarding any application data to the broadcast channel. Return a `Close` frame with code 4401 if the token is missing or invalid.

---

### 3. Unauthenticated WebSocket Message Relay to All Clients

**File**: `src/routes/socket.rs`, lines 55–62  
**Severity**: High

Any authenticated WebSocket client can send arbitrary `Text` messages that are immediately re-broadcast to every other connected client (line 61). There is no size limit, no rate limit, and no schema validation. A single authenticated user can flood all other clients or inject malformed JSON that breaks frontend parsing.

**Fix**: Either remove the client-to-server relay entirely if it is not a product requirement, or enforce a message size cap (e.g., 4 KB), validate the JSON schema, and rate-limit per connection.

---

### 5. CORS Wildcard `Any` Combined with Credentialed Requests

**File**: `src/main.rs`, lines 96–102  
**Severity**: High

The CORS policy uses `.allow_origin(tower_http::cors::Any)` alongside `.allow_headers(tower_http::cors::Any)`. The comment acknowledges this is intentional for Docker, but the same binary is built for production (`make build`/`make run`). A wildcard `Access-Control-Allow-Origin: *` means:
- Any origin can read API responses, including JWT-protected ones.
- Any origin can set any header, bypassing browser-enforced CORS protections.

This is particularly significant because the server handles authentication (`/auth/login`, `/auth/register`) and holds a JWT secret.

**Fix**: Make allowed origins configurable via an `ALLOWED_ORIGINS` environment variable. Default to a restrictive list for production; document the wildcard as a local-dev-only override.

---

### 12. `create_user` Endpoint Ignores Provided Password — Stores Empty Hash

**File**: `src/routes/services.rs`, line 61; `src/database/requests.rs`, lines 19–27  
**Severity**: High

The `POST /api/user` endpoint deserializes a raw `entity::user::Model` and passes it to `create_user`, which only sets `name` and `email` via `ActiveModel` and leaves `password_hash` as `Default::default()` (empty string). This creates users with no usable password hash — they can never log in, and the empty-string hash is a data integrity issue. The `/auth/register` endpoint is the correct path and properly hashes the password. `POST /api/user` appears to be a legacy endpoint not updated when auth was added.

**Fix**: Remove `POST /api/user` or update it to require and hash a password. Make `create_user` in `requests.rs` private or remove it to prevent accidental use.

---

## Important Issues

### 4. `broadcast_message` Always Returns `Ok` — Hides Real Errors

**File**: `src/messaging/websocket.rs`, lines 28–40  
**Severity**: Medium

`broadcast_message` has return type `Result<(), broadcast::error::SendError<Message>>` but always returns `Ok(())` regardless of whether `sender.send()` succeeds. The actual send error is logged internally but swallowed, making the error-handling contract misleading.

Additionally, `broadcast::Sender::send` returns `Err` when there are **no active receivers** — a normal condition at startup — which is being logged as an error on every poll cycle when no WebSocket clients are connected.

**Fix**: Either return the real `Result` to callers, or change the return type to `()`. Separately, treat `SendError` (no receivers) as a `debug!`-level event, not `error!`.

---

### 6. `get_messages` and `get_messages_count` Panic on Database Error

**File**: `src/routes/services.rs`, lines 77 and 82  
**Severity**: Medium

```rust
let messages = state.db.get_messages().await.unwrap();   // line 77
let nb = state.db.get_messages_count().await.unwrap();   // line 82
```

Both `.unwrap()` calls will panic on any database error, crashing the Axum worker thread for that request. The other endpoints in the same file correctly return `Err(StatusCode::INTERNAL_SERVER_ERROR)`.

**Fix**: Replace with `.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?` and change the return types to `Result<Json<...>, StatusCode>`.

---

### 7. Kafka Consumer Blocks the Async Runtime Thread

**File**: `src/messaging/kafka.rs`, lines 14–63  
**Severity**: Medium

The `kafka` crate (v0.10) is a synchronous blocking client. `Consumer::create()` and `c.poll()` perform blocking network I/O directly from within an `async fn` on the Tokio multi-thread runtime, starving other tasks scheduled on that thread.

**Fix**: Wrap the blocking Kafka calls in `tokio::task::spawn_blocking`, or migrate to an async-native Kafka client such as `rdkafka` with the `tokio` feature.

---

### 8. Kafka Producer in `sytral.rs` Is Recreated on Every Poll Cycle

**File**: `src/messaging/sytral.rs`, lines 163–167  
**Severity**: Medium

A new `Producer` is constructed inside `send_to_kafka`, which is called every 5 seconds from the `sytral_handler` loop. Each `Producer::from_hosts(...).create()` establishes a new TCP connection to the Kafka broker, producing connection churn that appears in broker logs and eventually causes connection-table exhaustion under load.

**Fix**: Create the `Producer` once at startup and reuse it across loop iterations, reconnecting only on error.

---

### 10. Sensitive Kafka Configuration Exposed via Authenticated API

**File**: `src/routes/parameters.rs`, lines 13–19  
**Severity**: Medium

The `/api/parameters` endpoint returns `kafka_url`, `kafka_topic`, and `kafka_group` to any valid JWT holder. If a JWT is compromised (e.g., via the URL-in-logs issue in finding #2), an attacker learns the Kafka broker address and topic names, enabling direct broker enumeration or targeted attacks.

**Fix**: Remove this endpoint if not required by the frontend, gate it on an admin role claim in the JWT, or return only the subset of information the frontend actually needs.

---

### 11. `register` Maps All DB Errors to `409 Conflict`

**File**: `src/routes/auth.rs`, line 55  
**Severity**: Medium

```rust
.map_err(|_| StatusCode::CONFLICT)?;
```

Any database error during user creation (disk full, connection dropped, constraint violation on a non-email field) is returned as `409 Conflict`, misleading the client into thinking the email is already taken when the real cause may be a server-side infrastructure failure.

**Fix**: Inspect the `DbErr` variant — return `409` only for unique-constraint violations; return `500` for all other variants.

---

### 13. No Input Length Validation — Argon2 DoS via Long Password

**File**: `src/routes/auth.rs`, `src/routes/services.rs` (all POST/PUT handlers)  
**Severity**: Medium

There are no length limits on `text`, `name`, `email`, or `password` fields accepted from HTTP request bodies. A client can submit a multi-megabyte password to `hash_password`, causing Argon2 to spend significant CPU time (Argon2 has no internal length cap that prevents DoS for extremely large inputs). Similarly, an arbitrarily large `text` field will be stored in SQLite and broadcast to all WebSocket clients.

**Fix**: Add a validation step before processing each request, rejecting inputs exceeding reasonable maximums (e.g., 1 KB for passwords, 10 KB for message text).

---

## Low Priority

### 9. `reqwest::Client` Recreated on Every SYTRAL Fetch

**File**: `src/messaging/sytral.rs`, line 126  
**Severity**: Low

`Client::new()` is called inside `get_vehicles`, invoked every 5 seconds. `reqwest::Client` owns a connection pool and TLS session cache; creating a new instance every call discards pooled connections, forcing a full TCP + TLS handshake on every request to the SYTRAL API.

**Fix**: Create the `Client` once in `sytral_handler` and pass it as a parameter to `get_vehicles`, or store it in `WamServerState`.
