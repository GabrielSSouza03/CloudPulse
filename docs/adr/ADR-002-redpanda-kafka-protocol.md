# ADR-002: Redpanda for development and initial builds, Kafka protocol only

- Status: Proposed
- Date: 2026-11-11

## Context

Usage events need a durable, partitioned, replayable log between the gateway and the workers. The
development machine has 14 GB of RAM shared with other work, so the broker's footprint matters.

## Decision

Use Redpanda in development and for the initial build (`redpandadata/redpanda`, `--smp 1`,
768 MB, single broker). Application code uses only the Kafka protocol and generic Kafka client
features, so switching brokers is a configuration change. A nightly CI job will run the integration
suite against `apache/kafka` to prove compatibility.

## Alternatives

- **Apache Kafka with KRaft.** Apache 2.0 license and the largest ecosystem, but a heavier JVM
  footprint locally. Remains the production candidate.
- **Redis Streams or a PostgreSQL queue.** Rejected: weaker partitioned replay semantics and they
  would overload stores that have other responsibilities.

## Consequences

- Low local memory: measured 164 MiB idle.
- Redpanda Community is source-available under the BSL, not Apache. This must be acceptable for any
  hosted offering, or production must use Kafka or a managed Kafka service.
- No Redpanda-only features (for example, data transforms) may be used.

## Open questions

- Which broker runs in production, and whether the built-in schema registry is needed (see ADR-005).
