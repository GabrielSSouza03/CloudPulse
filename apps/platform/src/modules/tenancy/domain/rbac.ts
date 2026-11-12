export const ROLES = ['tenant_admin', 'finops_manager', 'approver', 'engineer', 'auditor'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'teams:read',
  'teams:write',
  'workloads:read',
  'workloads:write',
  'api_keys:read',
  'api_keys:write',
  'budgets:read',
  'budgets:write',
  'policies:read',
  'policies:write',
  'actions:read',
  'actions:approve',
  'costs:read',
  'audit:read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const READ_ONLY: readonly Permission[] = [
  'teams:read',
  'workloads:read',
  'budgets:read',
  'policies:read',
  'actions:read',
  'costs:read',
];

export const ROLE_PERMISSIONS: Readonly<Record<Role, ReadonlySet<Permission>>> = {
  tenant_admin: new Set(PERMISSIONS.filter((p) => p !== 'actions:approve')),
  finops_manager: new Set([
    ...READ_ONLY,
    'budgets:write',
    'policies:write',
    'workloads:write',
    'teams:write',
  ]),
  approver: new Set([...READ_ONLY, 'actions:approve']),
  engineer: new Set(READ_ONLY),
  auditor: new Set([...READ_ONLY, 'audit:read']),
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function rolesGrant(roles: readonly Role[], permission: Permission): boolean {
  return roles.some((role) => ROLE_PERMISSIONS[role].has(permission));
}
