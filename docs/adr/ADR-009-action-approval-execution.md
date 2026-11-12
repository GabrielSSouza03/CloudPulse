# ADR-009: Action approval and execution

- Status: Proposed
- Date: 2026-11-11

## Context

Policies propose actions with external effects: pausing an agent, scaling a resource, rotating a
model. Critical actions need human approval, provider calls can time out with unknown outcomes, and
a stale approval must never authorize a different action.

## Decision

- A PostgreSQL-backed state machine: `PROPOSED → APPROVED | REJECTED | EXPIRED`,
  `APPROVED → EXECUTING → SUCCEEDED | FAILED | VERIFYING`, `VERIFYING → SUCCEEDED | FAILED`,
  `FAILED → ROLLED_BACK`. Transitions are conditional updates on the current state.
- Action classes: `INFORMATIONAL` (no approval), `AUTO_REVERSIBLE` (auto-approved by policy,
  rollback required), `CRITICAL` (human approval required).
- An approval stores the hash of the action payload and an expiry. The executor re-checks the
  approval and hash when it claims the action. Four-eyes: the proposer cannot approve, and tenant
  admins cannot approve (separation of duties in RBAC).
- Provider adapters implement `execute`, `verify` and `rollback`. A timeout moves the action to
  `VERIFYING` instead of retrying a non-idempotent call.
- Every transition writes an audit record in the same transaction.

## Alternatives

- **Temporal or another workflow engine.** Durable and featureful, but a large dependency for a small
  state machine.

## Consequences

- No code path executes a critical action without a matching, unexpired approval; a test proves it.
- Adapters must expose a way to verify outcomes.

## Open questions

- Multi-step and multi-approver workflows.
