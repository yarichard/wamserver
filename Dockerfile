# Start from the official Rust image for building
FROM rust:latest AS builder

WORKDIR /app

# Install protoc first (needed for build.rs)
RUN apt-get update && apt-get install -y protobuf-compiler && rm -rf /var/lib/apt/lists/*

# Copy manifests and build dependencies first for caching
COPY Cargo.toml Cargo.lock ./
COPY entity/Cargo.toml entity/Cargo.toml
COPY migration/Cargo.toml migration/Cargo.toml

# Copy build.rs and proto files (required by build.rs)
COPY build.rs ./
COPY proto ./proto

# Copy source code
COPY src ./src
COPY entity/src entity/src
COPY migration/src migration/src

# Build the entire workspace in release mode
RUN RUSTFLAGS="-C target-cpu=native -C link-arg=-s" cargo build --release --workspace

# Build the front end
FROM node:20 AS frontend-builder

WORKDIR /app
COPY frontend/package*.json frontend/
COPY frontend/.npmrc frontend/
WORKDIR /app/frontend

# Use BuildKit secret mount for NPM_TOKEN
RUN --mount=type=secret,id=npm_token \
    NPM_TOKEN=$(cat /run/secrets/npm_token) npm install

COPY frontend/ ./

RUN npm run build -- --mode production && ls -la ../static

# Use a minimal base image for the final image
FROM debian:bookworm-slim
WORKDIR /app

# Install OpenSSL runtime library and curl for healthcheck
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Copy the compiled binary and set up the environment
COPY --from=builder /app/target/release/wamserver /usr/local/bin/wamserver

# Create necessary directories
RUN mkdir data

# Copy the built frontend files
COPY --from=frontend-builder /app/static /app/static

# Expose the application port (different from the dev one to avoid port forwarding collision)
EXPOSE 8080

# Environment configuration
ENV DATABASE_URL=sqlite://data/db.sqlite?mode=rwc \
    KAFKA_URL=kafka:9092 \
    KAFKA_TOPIC=messages \
    KAFKA_GROUP=wam \
    RUST_LOG=info \
    RUST_BACKTRACE=1
    
# Set the command (using shell form to see output)
ENTRYPOINT ["/usr/local/bin/wamserver"]

# Use LABEL for metadata
LABEL maintainer="Yann Richard" \
      version="1.0" \
      description="WAM Server application"
