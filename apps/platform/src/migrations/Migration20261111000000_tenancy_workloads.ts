import { Migration } from '@mikro-orm/migrations';

/**
 * Tenancy and workload registry.
 *
 * Isolation model (ADR-008): every tenant-owned row carries tenant_id; RLS policies compare it with
 * the transaction-local setting app.tenant_id. Tables are owned by cloudpulse_migrator, so the
 * cloudpulse_api role (not owner, NOBYPASSRLS) is always subject to the policies. A missing
 * setting evaluates to NULL and matches no rows: the database fails closed.
 */
export class Migration20261111000000TenancyWorkloads extends Migration {
  override name = 'Migration20261111000000_tenancy_workloads';

  override up(): void {
    this.addSql(`
      create or replace function cp_current_tenant() returns uuid
        language sql stable
        as $$ select nullif(current_setting('app.tenant_id', true), '')::uuid $$;
    `);

    this.addSql(`
      create table tenant (
        id uuid primary key,
        slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
        name text not null check (length(name) between 1 and 200),
        status text not null default 'active' check (status in ('active', 'suspended')),
        created_at timestamptz not null default now()
      );
    `);

    this.addSql(`
      create table team (
        id uuid primary key,
        tenant_id uuid not null references tenant (id),
        name text not null check (length(name) between 1 and 120),
        created_at timestamptz not null default now(),
        constraint team_tenant_name_key unique (tenant_id, name),
        constraint team_tenant_id_key unique (tenant_id, id)
      );
    `);

    this.addSql(`
      create table membership (
        id uuid primary key,
        tenant_id uuid not null references tenant (id),
        subject text not null check (length(subject) between 1 and 255),
        role text not null check (role in ('tenant_admin', 'finops_manager', 'approver', 'engineer', 'auditor')),
        created_at timestamptz not null default now(),
        constraint membership_tenant_subject_role_key unique (tenant_id, subject, role)
      );
    `);

    this.addSql(`
      create table api_key (
        id uuid primary key,
        tenant_id uuid not null references tenant (id),
        key_id text not null unique check (key_id ~ '^[0-9a-f]{16}$'),
        name text not null check (length(name) between 1 and 120),
        secret_hash bytea not null check (length(secret_hash) = 32),
        scopes text[] not null check (cardinality(scopes) > 0 and scopes <@ array['ingest:write']::text[]),
        created_by text not null,
        created_at timestamptz not null default now(),
        revoked_at timestamptz
      );
    `);
    this.addSql(`create index api_key_tenant_created_idx on api_key (tenant_id, created_at desc);`);

    this.addSql(`
      create table workload (
        id uuid primary key,
        tenant_id uuid not null references tenant (id),
        team_id uuid not null,
        key text not null check (key ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'),
        name text not null check (length(name) between 1 and 200),
        kind text not null check (kind in ('agent', 'workflow', 'service', 'resource_group')),
        tags jsonb not null default '{}'::jsonb check (jsonb_typeof(tags) = 'object'),
        created_at timestamptz not null default now(),
        constraint workload_tenant_key_key unique (tenant_id, key),
        -- Composite FK: a workload can only reference a team of its own tenant.
        constraint workload_team_fk foreign key (tenant_id, team_id) references team (tenant_id, id)
      );
    `);
    this.addSql(`create index workload_tenant_team_idx on workload (tenant_id, team_id);`);

    this.addSql(`alter table tenant enable row level security;`);
    this.addSql(`create policy tenant_isolation on tenant using (id = cp_current_tenant());`);
    for (const table of ['team', 'membership', 'api_key', 'workload']) {
      this.addSql(`alter table ${table} enable row level security;`);
      this.addSql(`
        create policy tenant_isolation on ${table}
          using (tenant_id = cp_current_tenant())
          with check (tenant_id = cp_current_tenant());
      `);
    }

    this.addSql(
      `grant select on tenant, team, membership, api_key, workload to cloudpulse_api, cloudpulse_worker;`,
    );
    this.addSql(`grant insert, update on team, workload to cloudpulse_api;`);
    this.addSql(`grant insert on api_key to cloudpulse_api;`);
    this.addSql(`grant update (revoked_at) on api_key to cloudpulse_api;`);

    this.addSql(`
      create function cp_lookup_api_key(p_key_id text)
        returns table (id uuid, tenant_id uuid, secret_hash bytea, scopes text[], revoked_at timestamptz, tenant_status text)
        language sql stable security definer
        set search_path = public, pg_temp
        as $$
          select k.id, k.tenant_id, k.secret_hash, k.scopes, k.revoked_at, t.status
          from api_key k join tenant t on t.id = k.tenant_id
          where k.key_id = p_key_id
        $$;
    `);
    this.addSql(`revoke all on function cp_lookup_api_key(text) from public;`);
    this.addSql(
      `grant execute on function cp_lookup_api_key(text) to cloudpulse_api, cloudpulse_worker;`,
    );
    this.addSql(
      `grant execute on function cp_current_tenant() to cloudpulse_api, cloudpulse_worker;`,
    );
  }

  override down(): void {
    this.addSql(`drop function if exists cp_lookup_api_key(text);`);
    this.addSql(`drop table if exists workload, api_key, membership, team, tenant;`);
    this.addSql(`drop function if exists cp_current_tenant();`);
  }
}
