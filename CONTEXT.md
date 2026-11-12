# CloudPulse domain context

This file defines the language used in code, APIs, documents and conversations. When a term here
conflicts with a casual usage elsewhere, this file wins. Terms marked _(planned)_ are designed but
not implemented in the current milestone.

## Purpose and boundaries

CloudPulse measures, prices, attributes, limits and reconciles the cost of AI agents, autonomous
workflows and cloud workloads for many tenants.

In scope: usage ingestion, pricing, cost attribution, budgets and reservations, a financial ledger,
policies and governed actions, anomaly detection and forecasting, billing reconciliation, reporting.

Out of scope: executing the customer's agents, storing prompts or model outputs, acting as a
payment processor, and producing tax-compliant invoices.

## Core terms

**Tenant.** An isolated customer organization. Every business record belongs to exactly one tenant.
The tenant is always derived from the credential (JWT claim `tid` or API key), never from a request
body.

**Team.** A group inside a tenant that owns workloads and, later, budgets. Team names are unique per
tenant.

**Membership.** The grant of one role to one subject (an identity-provider user id) within one
tenant. A subject may hold several roles. Roles come from memberships, never from token claims.

**Role.** `tenant_admin`, `finops_manager`, `approver`, `engineer`, `auditor`. Permissions are
checked per use case in the application layer. A tenant admin cannot approve actions (separation of
duties).

**Actor.** An authenticated human acting inside one tenant with roles resolved from memberships.

**API key.** A machine credential scoped to one tenant and a set of scopes (`ingest:write`). Format
`cp_live_<keyId>_<secret>`. The key id is a public lookup handle; only the SHA-256 digest of the
secret is stored. The plaintext is shown once at creation. A revoked key never authenticates.

**Workload.** The unit cost is attributed to: an `agent`, `workflow`, `service` or `resource_group`.
A workload belongs to one team of the same tenant and has a `key` that is unique per tenant and is
what producers reference in events.

**Execution.** One run of a workload (for example, one agent task). Identified by `executionId`.
Cost per successful execution is a primary metric.

**Usage event.** An immutable fact that something consumed resources, described by envelope v1
(`packages/contracts`). It carries `eventId`, `eventType`, `occurredAt`, the workload, optional
execution context, and a list of measurements.

**Measurement.** A `(dimension, quantity, unit)` triple. Quantities are decimal strings. Each event
type allows a fixed set of dimensions with a fixed unit. Dimension names follow OpenTelemetry GenAI
conventions (`gen_ai.usage.input_tokens`) and use the `cloudpulse.usage.*` namespace otherwise.

**occurredAt / receivedAt.** When usage happened versus when CloudPulse received it. Pricing and
budget periods always use `occurredAt`. Events older than the lateness window (35 days) or more than
5 minutes in the future are rejected by the gateway and need the backfill path.

**Money.** A decimal amount with an ISO 4217 currency. Never a float. Stored as `NUMERIC(38,12)`,
serialized as a string, rounded HALF_EVEN, and displayed at the currency's minor unit. Amounts in
different currencies are never added.

**Price book** _(planned)_. A versioned catalog of unit prices per meter
(provider, service, sku, region, dimension). Published versions are immutable and have effective
periods.

**Cost line** _(planned)_. The append-only result of pricing one measurement of one event. Unique
per `(tenant, eventId, component)`. Corrections are new lines that supersede old ones.

**Budget, budget period, reservation** _(planned)_. A budget limits spend for a scope (tenant, team,
workload, agent) per period. A reservation holds part of a period's remaining amount before work
runs and is later settled with actual cost, released, or expired.

**Ledger** _(planned)_. A double-entry, append-only journal. Every movement of reserved or consumed
money is a balanced transaction with an idempotency key.

**Policy, action, approval** _(planned)_. A policy evaluates facts and proposes actions. Critical
actions need an approval bound to the action's payload hash before execution.

## Invariants enforced today

1. A row of one tenant is never visible to or writable by another tenant through the api role.
   PostgreSQL row-level security enforces this; the ORM filter repeats it in application code.
2. Without a tenant context, the api role sees zero rows (fail closed).
3. A workload can only reference a team of its own tenant (composite foreign key).
4. Workload keys are unique per tenant; team names are unique per tenant.
5. API key secrets are never stored or logged; any authentication failure returns the same error.
6. Domain code does not import frameworks, and modules use each other only through `index.ts`.

## Invariants planned (designed, not yet implemented)

- One cost line per `(tenant, eventId, component)`; accruals only from newly inserted lines.
- `reserved + consumed <= limit` for hard-limited budget periods, under any concurrency.
- Every ledger transaction balances to zero per currency.
- No critical action executes without a matching, unexpired approval.
- The audit log is append-only and hash-chained per tenant.

## Delivery semantics

Delivery is at-least-once everywhere. Duplicates are expected and neutralized by unique
constraints and conditional state transitions in PostgreSQL. CloudPulse never claims exactly-once.
