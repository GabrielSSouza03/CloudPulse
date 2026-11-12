import { UnprocessableError } from '../../../shared-kernel/errors.js';

export class Team {
  id!: string;
  tenantId!: string;
  name!: string;
  createdAt!: Date;

  constructor(props: { id: string; tenantId: string; name: string; createdAt: Date }) {
    const name = props.name.trim();
    if (name.length < 1 || name.length > 120)
      throw new UnprocessableError('invalid_team_name', 'Team name must be 1-120 characters.');
    Object.assign(this, { ...props, name });
  }
}
