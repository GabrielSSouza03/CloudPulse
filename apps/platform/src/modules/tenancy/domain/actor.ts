import { ForbiddenError } from '../../../shared-kernel/errors.js';
import { type Permission, type Role, rolesGrant } from './rbac.js';

/** An authenticated human acting inside exactly one tenant, with roles resolved from memberships. */
export type Actor = {
  readonly kind: 'user';
  readonly subject: string;
  readonly tenantId: string;
  readonly roles: readonly Role[];
};

export class PermissionDeniedError extends ForbiddenError {
  constructor(readonly permission: Permission) {
    super(`Missing permission ${permission}.`, 'permission_denied');
  }
}

/** Application-layer authorization check. Guards authenticate; use cases authorize. */
export function authorize(actor: Actor, permission: Permission): void {
  if (!rolesGrant(actor.roles, permission)) throw new PermissionDeniedError(permission);
}
