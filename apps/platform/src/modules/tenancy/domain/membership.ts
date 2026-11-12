import type { Role } from './rbac.js';

/** Grants one role to one identity-provider subject inside one tenant. */
export class Membership {
  id!: string;
  tenantId!: string;
  subject!: string;
  role!: Role;
  createdAt!: Date;

  constructor(props: {
    id: string;
    tenantId: string;
    subject: string;
    role: Role;
    createdAt: Date;
  }) {
    Object.assign(this, props);
  }
}
