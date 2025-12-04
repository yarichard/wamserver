GIT_TAG := $(shell git describe --tags --abbrev=7 --always 2>/dev/null || git rev-parse --short=7 HEAD)
IMAGE_NAME ?= wamserver:$(GIT_TAG)
DOCKERFILE ?= Dockerfile
CONTEXT ?= .
NPM_TOKEN ?= $(shell echo $$NPM_TOKEN)
SYTRAL_USERNAME ?= $(shell echo $$SYTRAL_USERNAME)
SYTRAL_PASSWORD ?= $(shell echo $$SYTRAL_PASSWORD)

.PHONY: build run

build:
	DOCKER_BUILDKIT=1 docker build \
		--secret id=npm_token,env=NPM_TOKEN \
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
		-e SYTRAL_USERNAME=$(SYTRAL_USERNAME) \
		-e SYTRAL_PASSWORD=$(SYTRAL_PASSWORD) \
		$(IMAGE_NAME)
