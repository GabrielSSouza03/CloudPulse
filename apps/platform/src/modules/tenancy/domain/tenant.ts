import { UnprocessableError } from '../../../shared-kernel/errors.js';

export type TenantStatus = 'active' | 'suspended';

export class Tenant {
  id!: string;
  slug!: string;
  name!: string;
  status!: TenantStatus;
  createdAt!: Date;

  constructor(props: {
    id: string;
    slug: string;
    name: string;
    status?: TenantStatus;
    createdAt: Date;
  }) {
    if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(props.slug))
      throw new UnprocessableError('invalid_tenant_slug', `Invalid tenant slug: ${props.slug}.`);
    Object.assign(this, { status: 'active', ...props });
  }

  isActive(): boolean {
    return this.status === 'active';
  }
}
