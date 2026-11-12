import { Inject, Injectable } from '@nestjs/common';
import { UniqueConstraintViolationException } from '@mikro-orm/core';
import { TenantTransactions } from '../../../platform/database/tenant-transactions.js';
import { CLOCK, type Clock } from '../../../shared-kernel/clock.js';
import { ConflictError } from '../../../shared-kernel/errors.js';
import { newId } from '../../../shared-kernel/ids.js';
import { type Actor, authorize } from '../domain/actor.js';
import { Team } from '../domain/team.js';
import { TenancyRepository } from '../infrastructure/repositories.js';

export type TeamView = { id: string; name: string; createdAt: string };

const toView = (t: Team): TeamView => ({
  id: t.id,
  name: t.name,
  createdAt: t.createdAt.toISOString(),
});

@Injectable()
export class TeamService {
  constructor(
    private readonly tx: TenantTransactions,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async create(actor: Actor, input: { name: string }): Promise<TeamView> {
    authorize(actor, 'teams:write');
    const team = new Team({
      id: newId(),
      tenantId: actor.tenantId,
      name: input.name,
      createdAt: this.clock.now(),
    });
    try {
      await this.tx.run(actor.tenantId, async (em) => new TenancyRepository(em).addTeam(team));
    } catch (error) {
      if (error instanceof UniqueConstraintViolationException) {
        throw new ConflictError(
          'team_name_conflict',
          `A team named "${team.name}" already exists.`,
        );
      }
      throw error;
    }
    return toView(team);
  }

  async list(actor: Actor): Promise<TeamView[]> {
    authorize(actor, 'teams:read');
    const teams = await this.tx.run(actor.tenantId, (em) => new TenancyRepository(em).listTeams());
    return teams.map(toView);
  }
}
