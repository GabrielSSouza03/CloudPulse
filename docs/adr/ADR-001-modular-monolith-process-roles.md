# ADR-001: Modular monolith with multiple process roles

- Status: Accepted
- Date: 2026-11-11

## Context

CloudPulse has 13 bounded contexts, but most business operations must be strongly consistent across
several of them in one PostgreSQL transaction (a cost line, its budget accrual and its ledger
posting). The workloads also differ sharply: ingestion is bursty and stateless, the control plane is
latency-sensitive, and the pipeline is throughput-oriented. The team is small and the project must
run on one developer machine.

## Decision

One NestJS codebase (`apps/platform`), built once into one image, started as separate processes:
`api`, `gateway`, and `worker --role=<cost|analytics-sink|governance|outbox-relay|scheduler>`. Each
role has its own composition root (`src/app/role-modules.ts`) and its own readiness dependencies
(`src/app/role-dependencies.ts`).

Each bounded context is a module with `domain/`, `application/`, `infrastructure/` and `api/` layers
and a public `index.ts`. `dependency-cruiser` enforces the boundaries in CI, and a violation fixture
proves the rules work.

## Alternatives

- **Microservices per context.** Rejected: distributed transactions or sagas for operations that are
  one local transaction today, many deployables, and network failure modes without a scaling need.
- **A single process.** Rejected: an ingestion burst or a slow ClickHouse would degrade the control
  plane and pricing.

## Consequences

- One database schema with ownership enforced by module boundaries, not by separate databases.
- Contexts call each other in process through public APIs, so refactoring stays cheap.
- Processes scale and fail independently; the image is the same for all roles.
- The boundary rules must stay strict, or the monolith degrades into shared internals.

## Open questions

- Extraction criteria. A role becomes its own service only for a measured reason: different scaling,
  release cadence or security perimeter. Likely order: gateway, analytics-sink, action executor
  (holds provider credentials).
