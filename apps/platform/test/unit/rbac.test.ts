import { describe, expect, it } from 'vitest';
import {
  authorize,
  PermissionDeniedError,
  type Actor,
} from '../../src/modules/tenancy/domain/actor.js';
import {
  isRole,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLES,
  rolesGrant,
} from '../../src/modules/tenancy/domain/rbac.js';

describe('RBAC', () => {
  it('separates duties: tenant admins cannot approve actions', () => {
    expect(rolesGrant(['tenant_admin'], 'actions:approve')).toBe(false);
    expect(rolesGrant(['approver'], 'actions:approve')).toBe(true);
  });

  it('keeps engineers and auditors read-only', () => {
    for (const role of ['engineer', 'auditor'] as const) {
      for (const permission of ROLE_PERMISSIONS[role])
        expect(permission.endsWith(':read')).toBe(true);
    }
    expect(rolesGrant(['auditor'], 'audit:read')).toBe(true);
    expect(rolesGrant(['engineer'], 'audit:read')).toBe(false);
  });

  it('grants the union of multiple roles', () => {
    expect(rolesGrant(['engineer', 'approver'], 'actions:approve')).toBe(true);
    expect(rolesGrant([], 'teams:read')).toBe(false);
  });

  it('only issues API keys to tenant admins', () => {
    const holders = ROLES.filter((r) => ROLE_PERMISSIONS[r].has('api_keys:write'));
    expect(holders).toEqual(['tenant_admin']);
  });

  it('every role permission is a known permission', () => {
    for (const role of ROLES)
      for (const p of ROLE_PERMISSIONS[role]) expect(PERMISSIONS).toContain(p);
    expect(isRole('tenant_admin')).toBe(true);
    expect(isRole('root')).toBe(false);
  });

  it('authorize throws a coded 403 error', () => {
    const actor: Actor = { kind: 'user', subject: 'bob', tenantId: 't', roles: ['engineer'] };
    expect(() => authorize(actor, 'workloads:read')).not.toThrow();
    expect(() => authorize(actor, 'workloads:write')).toThrow(PermissionDeniedError);
  });
});
