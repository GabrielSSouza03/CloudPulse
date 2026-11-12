# CloudPulse

CloudPulse is a cost-intelligence and financial-governance platform for AI agents, autonomous
workflows and cloud workloads. It ingests usage telemetry, prices it against versioned price books,
attributes cost to tenants, teams, workloads and agents, enforces budgets through reservations
before work runs, and reconciles estimates against provider invoices.

The design goal is financial correctness under at-least-once delivery: no duplicate charges, no
budget overspend under concurrency, and every amount traceable to an event, a price version and a
ledger entry.

> **Status: Milestone 1 (foundation).** This repository contains the walking skeleton: process
> roles, tenancy with database-enforced isolation, the workload registry, API keys, the usage event
> contract v1, CI, and the architecture decisions. Ingestion, pricing, budgets, policies and
> analytics arrive in later phases.

## Capabilities

| Capability                                                              | State          |
| ----------------------------------------------------------------------- | -------------- |
| Multi-tenant control-plane API (teams, workloads, API keys)             | Milestone 1    |
| PostgreSQL row-level security on every tenant-owned table               | Milestone 1    |
| Usage event contract v1 (TypeBox / JSON Schema) with compatibility gate | Milestone 1    |
| Per-role health and readiness (gateway, api, five worker roles)         | Milestone 1    |
| Telemetry gateway producing to Redpanda                                 | Phase 2        |
| Pricing catalog, cost engine, double-entry ledger                       | Phase 3        |
| Budget reservations, policies, approvals and actions                    | Phases 4 and 5 |
| Anomaly detection, forecasting, reconciliation                          | Phases 6 and 7 |

## Quick start

Requirements: Node 24, Docker with Compose v2, and corepack (`corepack enable` provides pnpm).

```bash
pnpm install
pnpm dev:up        # PostgreSQL 18, Redpanda, Redis, ClickHouse; waits until healthy
pnpm migrate
pnpm start:api     # http://localhost:3000
```

The scripts read `.env.example` and then an optional `.env`, so no copy step is required. Create a
`.env` only to override values (for example, host ports that conflict with other local services).
Shell environment variables take precedence over both files.

Call the API with a development token:

```bash
TOKEN=$(pnpm -s dev:token)   # creates tenant "acme", team "default", and an admin membership
curl -s localhost:3000/health/ready
curl -s -X POST localhost:3000/v1/workloads -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"teamId":"<team id from GET /v1/teams>","key":"support-bot","name":"Support bot","kind":"agent"}'
```

`pnpm dev:token -- --tenant globex --subject bob --role engineer` mints tokens for other tenants and
roles. The signing key lives in `.dev/` (gitignored) and is only accepted outside production.

### Other process roles

```bash
pnpm start:gateway                       # :3002, readiness checks Redpanda, Redis, PostgreSQL
WORKER_ROLE=cost pnpm start:worker       # :3003, roles: cost | analytics-sink | governance | outbox-relay | scheduler
```

### Observability stack (optional)

```bash
pnpm dev:up:obs    # adds OTel Collector, Prometheus (:9090), Tempo (:3200), Grafana (:3001)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 pnpm start:api
```

Telemetry export is off unless `OTEL_EXPORTER_OTLP_ENDPOINT` is set.

### Local resource footprint

Measured on the development machine (16 CPUs, 14 GB RAM) with `pnpm dev:stats`, core profile idle
after migrations:

| Container  | Memory used | Limit       |
| ---------- | ----------- | ----------- |
| ClickHouse | 327 MiB     | 1.5 GiB     |
| Redpanda   | 164 MiB     | 1 GiB       |
| PostgreSQL | 44 MiB      | 512 MiB     |
| Redis      | 24 MiB      | 128 MiB     |
| **Total**  | **559 MiB** | **3.1 GiB** |

A second measurement after a full reset and a few API calls gave 576 MiB. The `obs` profile is
not included in these numbers.

Host ports default to a high range (PostgreSQL `15432`, Redis `16379`, Kafka `19092`, ClickHouse
`18123`) so the stack does not collide with other local services. Override with `CP_*_PORT`
variables, see `infra/compose/docker-compose.yml`.

## Development

| Command                 | Purpose                                                                 |
| ----------------------- | ----------------------------------------------------------------------- |
| `pnpm test`             | Unit and contract tests                                                 |
| `pnpm test:integration` | Testcontainers PostgreSQL 18: migrations, RLS isolation, API end to end |
| `pnpm lint`             | ESLint (zero warnings)                                                  |
| `pnpm format:check`     | Prettier                                                                |
| `pnpm typecheck`        | TypeScript strict, every package                                        |
| `pnpm boundaries`       | Module boundary rules (dependency-cruiser)                              |
| `pnpm dev:reset`        | Stop the stack and delete its volumes                                   |

CI (`.github/workflows/ci.yml`) runs all of the above plus a contract snapshot check and the
container image build.

## Architecture summary

One NestJS codebase (`apps/platform`), built once, deployed as separate processes:

- **gateway**: the ingestion hot path. Authenticates API keys, validates events, produces to Redpanda.
- **api**: the control plane. OIDC JWT authentication, RBAC per use case.
- **worker `--role=<role>`**: stream consumers and scheduled jobs (`cost`, `analytics-sink`,
  `governance`, `outbox-relay`, `scheduler`).

PostgreSQL is the financial source of truth, ClickHouse is a rebuildable analytics copy, Redis is
cache and rate limits only, and Redpanda is the durable, replayable transport (Kafka protocol only).
Business logic is organized into bounded-context modules with enforced public APIs.

- [Architecture overview](docs/architecture/overview.md)
- [Domain model](docs/architecture/domain-model.md)
- [Domain language and invariants](CONTEXT.md)
- [Architecture decision records](docs/adr/)

## Repository layout

```
apps/platform/          NestJS application: three entrypoints, modules, platform, shared kernel
  src/modules/          bounded contexts: tenancy, workloads, ingestion (more per phase)
  src/platform/         config, logging, HTTP errors, auth, database, health
  src/shared-kernel/    Money, ids, clock, coded errors
  src/migrations/       PostgreSQL migrations (MikroORM migrator)
  test/                 unit, integration (Testcontainers), boundary fixture
packages/contracts/     usage envelope v1, event types, fixtures, compatibility checks
infra/compose/          docker-compose.yml with core, obs and tools profiles
infra/monitoring/       OTel Collector, Prometheus, Tempo, Grafana provisioning
docs/                   architecture documents and ADRs
```
