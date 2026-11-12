# ADR-008: Multi-tenant isolation

- Status: Accepted
- Date: 2026-11-11

## Context

All tenants share one PostgreSQL schema. A single missing `WHERE tenant_id = ?` would expose another
customer's financial data. Isolation must not depend only on every query being written correctly.

## Decision

- **Shared schema, `tenant_id` on every tenant-owned row**, with indexes that start with `tenant_id`.
- **Tenant from the credential only**: the JWT claim `tid` or the API key's tenant. Request bodies
  never choose the tenant.
- **Three database roles**:
  - `cloudpulse_migrator` owns all tables and runs migrations.
  - `cloudpulse_api` (api and gateway) is not the owner and has `NOBYPASSRLS`, so row-level security
    always applies. It has no `DELETE` grant and column-limited `UPDATE` grants.
  - `cloudpulse_worker` has `BYPASSRLS` for cross-tenant batch processing; its repositories must
    scope every statement by tenant.
- **RLS policy `tenant_isolation`** on every tenant-owned table:
  `USING (tenant_id = cp_current_tenant()) WITH CHECK (tenant_id = cp_current_tenant())`, where
  `cp_current_tenant()` reads `current_setting('app.tenant_id', true)`. A missing setting is `NULL`
  and matches nothing, so the database fails closed.
- **Transaction-scoped tenant context**: `TenantTransactions.run(tenantId, work)` opens a transaction
  and sets `app.tenant_id` with transaction-local `set_config`, so a pooled connection never carries
  one tenant's context into another request. It also enables the MikroORM `tenant` filter, which
  adds the same predicate in application code and throws if enabled without a tenant.
- **Composite foreign keys** (`(tenant_id, team_id) → team (tenant_id, id)`) prevent references
  across tenants even by the owner role.
- **Pre-tenant lookups** go through narrow `SECURITY DEFINER` functions. The gateway authenticates
  API keys through `cp_lookup_api_key(key_id)`, which returns only verification fields for one key.

## Alternatives

- **Schema per tenant or database per tenant.** Stronger isolation, but migrations, connection pools
  and analytics multiply with tenant count.
- **Application filter only.** Rejected as the sole control: one raw SQL statement would bypass it.

## Consequences

- Integration tests run against PostgreSQL 18 and prove: zero rows without a tenant context, no
  cross-tenant reads even when asking explicitly, no cross-tenant writes or updates, no context
  leakage between transactions on one connection, and that the api role cannot disable RLS, delete,
  or switch roles. Disabling the tenant setting makes these tests fail.
- RLS adds a predicate to every query; indexes leading with `tenant_id` keep it cheap.
- The worker role is the residual risk and needs code review and repository tests.

## Open questions

- Dedicated databases for enterprise tenants that require physical isolation.
- A read-only reporting role when reporting queries move off the api role.
