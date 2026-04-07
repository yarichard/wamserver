# Wamserver Architecture Improvement Plan

## Theme 1 — State Design ✅ Done

**1.1 `ws_connections` removed** (`src/routes/socket.rs`, `src/main.rs`)
Dropped `Arc<Mutex<Vec<WsConnection>>>` from `WamServerState`. The push/retain lock blocks in `handle_socket` are removed. Connection lifecycle is now logged using the `conn_id` directly.

**1.2 `sender` removed from `WsConnection`** (`src/messaging/websocket.rs`)
`WsConnection` now holds only `id`. `WsConnection::new()` takes no arguments. The redundant `Arc::clone` of the sender is eliminated.

**1.3 `AppConfig` struct introduced** (`src/config.rs`)
All env vars are parsed once at startup via `AppConfig::from_env()` which returns `Result` — a missing var now causes a clean startup failure instead of a mid-loop panic. `AppConfig` is stored as `Arc<AppConfig>` in `WamServerState` and consumed by:
- `database/mod.rs` — accepts `database_url: &str` parameter
- `kafka.rs` — reads `kafka_url`, `kafka_topic`, `kafka_group` from `state.config`
- `sytral.rs` — credentials and Kafka URL passed as `&str` params to `get_vehicles()` and `send_to_kafka()`
- `parameters.rs` — reads from `state.config` via injected `State`

---

## Theme 2 — Error Handling (High)

**2.1 `.unwrap()` in read handlers**
`get_messages`, `get_messages_count`, and `get_users` in `services.rs` call `.unwrap()` or silently return empty. Write handlers already use `match` + `StatusCode` — read handlers must follow the same pattern.
→ Define a shared `AppError` implementing `IntoResponse` that maps `DbErr` to HTTP status codes.

**2.2 Kafka loop panics on `poll()` and `commit_consumed()`**
Both call `.unwrap()` inside the loop with no backoff — a transient network error causes a panic; a permanent one becomes an infinite busy-wait every 5 seconds.
→ Propagate errors with `?`, add exponential backoff.

**2.3 `broadcast_message` lies about its return type**
It always returns `Ok(())` even on send failure. Call sites chain `.unwrap_or_else(|e| ...)` that will **never fire**.
→ Either return the actual `Result` from `sender.send()`, or change the signature to `()`.

**2.4 SYTRAL fetch errors logged at `info!`**
Failures are invisible in `warn`/`error` filtered deployments.
→ Change to `error!()`.

---

## Theme 3 — Separation of Concerns (Medium)

**3.1 `sytral.rs` does too many things**
One file handles: JSON parsing, HTTP client, Kafka producer, protobuf conversion, and the polling loop. These are independent concerns with different test and change rates.
→ Split into `parser.rs` / `client.rs` / `producer.rs` / `handler.rs`.

**3.2 Entity `Model` types used directly as API DTOs**
`Json<entity::message::Model>` as a POST body couples the HTTP contract to the DB schema. The `#[serde(skip_deserializing)]` on `id` is a workaround, not a solution.
→ Introduce explicit `CreateMessageRequest` / `CreateUserRequest` structs in the routes layer.

**3.3 Dead code in `pages.rs`**
`handler()` is defined but never registered. The `about` endpoint returns `{ "data": 42 }`.
→ Remove `handler()`, replace `about` with a proper health/version response.

**3.4 `parameters.rs` exposes infrastructure info publicly**
`/api/parameters` returns Kafka broker URL to any unauthenticated client. CORS is fully open (`allow_origin(Any)`).
→ Either gate behind auth or remove.

---

## Theme 4 — Testability (Medium)

**4.1 `WamDatabase` is a concrete type — not mockable**
All handlers depend on the concrete struct, forcing a live DB for any handler test.
→ Define a `DatabaseRepository` trait; hold `Arc<dyn DatabaseRepository + Send + Sync>` in state.

**4.2 Background tasks are not independently testable**
`consume_kafka_message` and `sytral_handler` take `WamServerState` and loop forever. The processing logic (parse → persist → broadcast) can't be driven with controlled inputs.
→ Extract the core logic into a function taking explicit dependencies; the loop becomes a thin wrapper.

---

## Theme 5 — Async / Axum Anti-patterns (Low–Medium)

**5.1 `kafka` crate is synchronous — blocking the async thread pool**
`Consumer::poll()` is a blocking call inside `tokio::spawn`. Under load this starves other tasks.
→ Use `tokio::task::spawn_blocking` as an interim fix, or migrate to `rdkafka` (the async-native standard).

**5.2 & 5.3 `reqwest::Client` and Kafka `Producer` re-created every poll**
Both are connection-pool-bearing objects meant to be reused. Creating them every 5 seconds adds latency and wastes resources.
→ Construct once at startup, store in config/state.

**5.4 `serve_index` defined as inner `async fn` inside `main`**
Non-idiomatic, untestable, undiscoverable.
→ Move to `routes/pages.rs`.

---

## Prioritized Roadmap

### Phase 1 — Stability (before any feature work)

| # | Action | Files affected |
|---|--------|----------------|
| 1 | ✅ `AppConfig` struct — parse all env vars once at startup | `main.rs`, `kafka.rs`, `sytral.rs`, `parameters.rs` |
| 2 | `AppError` type — eliminate all `.unwrap()` from handlers | `services.rs`, `database/requests.rs` |
| 3 | Fix `broadcast_message` return type contract | `messaging/websocket.rs`, all callers |
| 4 | ✅ Remove `ws_connections` and dead `Mutex` from state | `main.rs`, `routes/socket.rs`, `messaging/websocket.rs` |

### Phase 2 — Architecture

| # | Action | Files affected |
|---|--------|----------------|
| 5 | `DatabaseRepository` trait — decouple handlers from concrete DB type | `database/mod.rs`, `main.rs`, `services.rs` |
| 6 | Request DTOs — decouple API surface from entity models | `routes/services.rs` |
| 7 | Extract processing logic from Kafka/Sytral loops | `messaging/kafka.rs`, `messaging/sytral.rs` |
| 8 | Split `sytral.rs` into `parser.rs` / `client.rs` / `producer.rs` / `handler.rs` | `messaging/sytral.rs` |

### Phase 3 — Infrastructure

| # | Action | Files affected |
|---|--------|----------------|
| 9 | `spawn_blocking` for Kafka poll (or migrate to `rdkafka`) | `messaging/kafka.rs` |
| 10 | Share `reqwest::Client` and Kafka producer across iterations | `messaging/sytral.rs`, `AppConfig` or state |
| 11 | Clean up `pages.rs`, move `serve_index`, fix CORS policy | `routes/pages.rs`, `main.rs` |
| 12 | Fix SYTRAL error log level (`info!` → `error!`) | `messaging/sytral.rs` |
