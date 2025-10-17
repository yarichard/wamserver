GIT_TAG := $(shell git describe --tags --abbrev=7 --always 2>/dev/null || git rev-parse --short=7 HEAD)
IMAGE_NAME ?= wamserver:$(GIT_TAG)
DOCKERFILE ?= Dockerfile
CONTEXT ?= .
NPM_TOKEN ?= $(shell echo $$NPM_TOKEN)

.PHONY: build run

build:
	docker build \
		--build-arg NPM_TOKEN=$(NPM_TOKEN) \
		-t $(IMAGE_NAME) \
		-f $(DOCKERFILE) \
		$(CONTEXT)

DATABASE_URL ?= sqlite://data/db.sqlite?mode=rwc
KAFKA_URL ?= kafka:9092 
KAFKA_TOPIC ?= messages
KAFKA_GROUP ?= wam

run:
	docker run --rm -p 3000:3000 \
		-e DATABASE_URL=$(DATABASE_URL) \
		-e KAFKA_URL=$(KAFKA_URL) \
		-e KAFKA_TOPIC=$(KAFKA_TOPIC) \
		-e KAFKA_GROUP=$(KAFKA_GROUP) \
		$(IMAGE_NAME)
