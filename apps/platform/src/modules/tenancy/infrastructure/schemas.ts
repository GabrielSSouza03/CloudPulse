import { ArrayType, EntitySchema } from '@mikro-orm/core';
import { ApiKey, type ApiKeyScope } from '../domain/api-key.js';
import { Membership } from '../domain/membership.js';
import { ROLES, type Role } from '../domain/rbac.js';
import { Team } from '../domain/team.js';
import { Tenant, type TenantStatus } from '../domain/tenant.js';

const timestamptz = { type: 'datetime', columnType: 'timestamptz' } as const;

export const TenantSchema = new EntitySchema<Tenant>({
  class: Tenant,
  tableName: 'tenant',
  properties: {
    id: { type: 'uuid', primary: true },
    slug: { type: 'string' },
    name: { type: 'string' },
    status: { type: 'string', enum: true, items: (): TenantStatus[] => ['active', 'suspended'] },
    createdAt: { ...timestamptz },
  },
});

export const TeamSchema = new EntitySchema<Team>({
  class: Team,
  tableName: 'team',
  properties: {
    id: { type: 'uuid', primary: true },
    tenantId: { type: 'uuid' },
    name: { type: 'string' },
    createdAt: { ...timestamptz },
  },
});

export const MembershipSchema = new EntitySchema<Membership>({
  class: Membership,
  tableName: 'membership',
  properties: {
    id: { type: 'uuid', primary: true },
    tenantId: { type: 'uuid' },
    subject: { type: 'string' },
    role: { type: 'string', enum: true, items: (): Role[] => [...ROLES] },
    createdAt: { ...timestamptz },
  },
});

export const ApiKeySchema = new EntitySchema<ApiKey>({
  class: ApiKey,
  tableName: 'api_key',
  properties: {
    id: { type: 'uuid', primary: true },
    tenantId: { type: 'uuid' },
    keyId: { type: 'string' },
    name: { type: 'string' },
    secretHash: { type: 'blob', hidden: true },
    scopes: { type: ArrayType<ApiKeyScope> },
    createdBy: { type: 'string' },
    createdAt: { ...timestamptz },
    revokedAt: { ...timestamptz, nullable: true },
  },
});

export const TENANCY_SCHEMAS = [TenantSchema, TeamSchema, MembershipSchema, ApiKeySchema];
