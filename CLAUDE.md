# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product description

The objective of this product is to connect to SYTRAL source to get vehicle data information (done by the **wamserver** backend project) and use it into several ways:
- display traffic of vehicles in real time (done by this **wamserver** project)
- store vehicles information and use them as data source for data science purposes (done by the **flink** project located in flink repo, ../flink folder locally)

## Technical architecture
The product is made of several layers that are connected together and work as a whole:
- **wamserver**: a web server that :
  - polls SYTRAL data source at regular intervals to read vehicles traffic information and publishes it to Kafka
  - consumes data from Kafka (both SYTRAL data and wam_message_gatling fake data) and broadcasts it to WebSocket clients
  - displays vehicle traffic in real time on a map
- **wam_message_gatling**: A load testing tool that sends fake messages. In native mode it can target Kafka directly or wamserver via HTTP. In WASM/browser mode, only HTTP to wamserver is supported (no Kafka). The WASM package is embedded in the frontend and must be updated manually by bumping the version when the library changes.
- **flink**: a module written in Java, located in ../flink folder. This module is OUTSIDE of this workspace. It consumes data from Kafka and stores raw data into S3-compatible folders (minio). It also flattens arrays of vehicles into per-vehicle folders.

In a nutshell, the architecture is as follows:
```
SYTRAL <--(poll)-- wamserver --> Kafka <-- flink --> minio
                                   ^
                    wam_message_gatling (native: Kafka or HTTP, WASM: HTTP only)
                                   |
                     wamserver consumers --> WebSocket clients
```

> **Note on SYTRAL protobuf schema (`proto/vehicles.proto`)**: The schema is assumed stable. If SYTRAL updates their format, the `.proto` file and generated code must be updated manually.

### wamserver

The server uses Rust 2024 edition with an Axum-based architecture:

- **src/main.rs**: Application entry point, sets up routes, CORS, and spawns background tasks for Kafka consumption and SYTRAL integration
- **src/routes/**: HTTP and WebSocket handlers
  - `services.rs`: CRUD endpoints for messages and users
  - `socket.rs`: WebSocket handler for real-time updates
  - `parameters.rs`: Configuration endpoints
- **src/messaging/**: Background messaging systems
  - `kafka.rs`: Kafka consumer that broadcasts messages to WebSocket clients
  - `sytral.rs`: SYTRAL vehicle data integration using protobuf
  - `websocket.rs`: WebSocket connection management
- **src/database/**: SeaORM database layer
- **entity/**: SeaORM entity definitions (Message, User)
- **migration/**: SeaORM migration files
- **proto/vehicles.proto**: Protobuf schema for SYTRAL vehicle data (compiled via prost in build.rs)
- **frontend/**: React SPA using MUI, Leaflet maps, and the wam_message_gatling WASM package

#### Key Dependencies

- **axum**: Web framework with WebSocket support (v0.8+: use `{param}` syntax for path parameters, not `:param`)
- **sea-orm**: Async ORM for SQLite
- **kafka**: Kafka client for message queue integration
- **prost**: Protocol buffers for SYTRAL data
- **reqwest**: HTTP client for API calls

### wam_message_gatling

Dual-target library (native + WASM):

- **src/gatling_core.rs**: Core logic for message generation and sending (platform-agnostic parts)
- **src/wasm_binding.rs**: WASM bindings using wasm-bindgen (compiled only for wasm32 target)
- **src/sender/**: Message delivery backends
  - `kafka.rs`: Kafka producer (native only)
  - `wamserver.rs`: HTTP POST to wamserver
- **src/main.rs**: CLI entry point for native execution

> **WASM integration**: The CI builds and publishes the package to GitHub Packages using `wasm-pack build --target web`. The `--target web` flag is mandatory — it produces a default `init` export required by `Gatling.jsx` for async WASM initialization. To update the frontend locally (e.g. before a CI publish), run `wasm-pack build --target web` in `wam_message_gatling/` and copy the `pkg/` files into `wamserver/frontend/node_modules/@yarichard/wam_message_gatling/`. In production, sync is done by bumping the package version in `wamserver/frontend/package.json` after a new CI publish.


#### Key Dependencies

- **axum**: Web framework with WebSocket support
- **wasm-bindgen**: WASM interop for browser builds
- **reqwest**: HTTP client for API calls

## Working infrastructure
### Local
This project runs into a dev container, defined by the Docker compose '../docker-compose.yml'.

This docker compose runs:
- the dev container used by this vscode project (related to rust developing environment) (**rust-node** image). This image uses the **./wamserver/Dockerfile** file
- the flink dev container used to run Java flink pipeline (**flink-job** image), outside of this workspace
- the Kafka related docker images (**confluentinc/cp-zookeeper**, **confluentinc/cp-kafka**, and **provectuslabs/kafka-ui**), outside of this workspace
- minio storage (**minio**), outside of this workspace
- Jupyter docker for data analysis (**jupyter/pyspark-notebook**), outside of this workspace


The `rust-node` and `flink-job` containers communicate through Kafka and minio. The minio shared data volume is mounted at `./minio/data` (relative to the docker-compose file location).

## Repository Overview

This workspace contains two related Rust projects, each with its own independent git repository:

- **wamserver** (`wamserver/` — git repo at `wamserver/.git`): A web server built with Axum that provides REST APIs, WebSocket connections, and serves a React frontend. It integrates with Kafka for message consumption and SYTRAL for vehicle data.
- **wam_message_gatling** (`wam_message_gatling/` — git repo at `wam_message_gatling/.git`): A load testing tool that sends messages to wamserver. Can run as a native binary (with Kafka support) or compile to WebAssembly for browser use.

Git commands (commit, push, branch, etc.) must be run from within the respective project folder, not from the workspace root.

## Build Commands

All the build commands must be executed into the devcontainer environments. No rust compilation is allowed outside of this environment for now.

### wamserver

```bash
# Build and run locally
cd wamserver
cargo build
cargo run

# Build Docker image
make build

# Run Docker container
make run
```

### wam_message_gatling

```bash
# Native build
cd wam_message_gatling
cargo build
cargo run

# WebAssembly build (for browser)
wasm-pack build --target web

# Docker
make build
make run
```

### Frontend (React)

```bash
cd wamserver/frontend
npm install
npm run dev          # Development server
npm run build        # Production build
npm test             # Run tests with Vitest
npm run test:ui      # Run tests with UI
```

### Database Migrations (SeaORM)

```bash
cd wamserver/migration
cargo run -- up              # Apply all pending migrations
cargo run -- down            # Rollback last migration
cargo run -- fresh           # Drop all tables and reapply
cargo run -- status          # Check migration status
cargo run -- generate NAME   # Generate new migration
```

## Environment Variables

### wamserver
- `DATABASE_URL`: SQLite connection string (default: `sqlite://data/db.sqlite?mode=rwc`)
- `KAFKA_URL`: Kafka broker address
- `KAFKA_TOPIC`: Topic for message consumption
- `KAFKA_GROUP`: Kafka consumer group
- `SYTRAL_USERNAME`, `SYTRAL_PASSWORD`: SYTRAL API credentials

### wam_message_gatling
- `WAM_SERVER_URL`: Target wamserver URL
- `GATLING_MSG_NB`: Number of messages per batch
- `GATLING_MSG_SEC`: Sending frequency in seconds
- `SEND_TYPE`: `kafka` or HTTP
- `KAFKA_URL`, `KAFKA_TOPIC`: Kafka configuration

## Testing

- There are **no integration tests** at this time. Only unit tests are in place.
- When adding a new feature, always create relevant unit tests. This applies to both backend (Rust) and frontend (React/Vitest).

## Development guidelines

- When adding a new feature, always ensure that you create relevant unit test for this feature. This is valid for backend and front end modification
- Keep it simple. No over engineering
- Identify root cause before fixing issues
- Plannings docs should be stored in `docs/`, 