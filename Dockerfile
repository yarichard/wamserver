# Start from the official Rust image for building
FROM rust:latest AS builder

WORKDIR /app

# Copy manifests and build dependencies first for caching
COPY Cargo.toml Cargo.lock ./
COPY entity/Cargo.toml entity/Cargo.toml
COPY migration/Cargo.toml migration/Cargo.toml
COPY src ./src
COPY entity/src entity/src
COPY migration/src migration/src

# Build the entire workspace in release mode
RUN cargo build --release --workspace

# Use a minimal base image for the final image
FROM debian:bookworm-slim
WORKDIR /app

# Install OpenSSL runtime library
RUN apt-get update && apt-get install -y --no-install-recommends libssl3 && rm -rf /var/lib/apt/lists/*

# Copy the compiled binary from the builder stage
COPY --from=builder /app/target/release/wamserver /usr/local/bin/wamserver

# Create an empty folder data for SQLite database
RUN mkdir data

# Expose the application port
EXPOSE 3000

# Set environment variables (override at runtime as needed)
ENV DATABASE_URL=sqlite://data/db.sqlite?mode=rwc \
    KAFKA_URL=kafka:9092 \
    KAFKA_TOPIC=messages \
    KAFKA_GROUP=wam

# Set the entrypoint
ENTRYPOINT ["/usr/local/bin/wamserver"]
