# ADR-011: Kafka client

- Status: Accepted
- Date: 2026-11-11

## Context

The gateway and the workers produce and consume through the Kafka protocol (ADR-002). The client
determines delivery guarantees, batching performance and how much control the application has over
offset commits, which the idempotent pipeline depends on.

## Decision

Use `@confluentinc/kafka-javascript` (librdkafka-based, maintained by Confluent) behind a thin
platform module (`platform/messaging`, introduced in Phase 2). Producers use `acks=all` and
idempotence; consumers commit offsets manually after the database transaction commits.

## Alternatives

- **KafkaJS.** Pure JavaScript and pleasant to use, but no longer actively maintained.
- **The NestJS Kafka transport.** Hides offset management and batching behind a request/response
  abstraction that does not fit an at-least-once pipeline with manual commits.

## Consequences

- A native dependency (librdkafka) in the image; build tooling must allow it.
- The messaging module isolates the client so it can be replaced.

## Open questions

- Per-partition concurrency and pause/resume behavior under PostgreSQL outages, measured in Phase 2.
