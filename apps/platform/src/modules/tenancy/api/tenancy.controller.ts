import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import type { Static } from '@sinclair/typebox';
import { TypeBoxPipe } from '../../../platform/validation/typebox.pipe.js';
import {
  ApiKeyService,
  type ApiKeyView,
  type IssuedApiKey,
} from '../application/api-key.service.js';
import { TeamService, type TeamView } from '../application/team.service.js';
import type { Actor } from '../domain/actor.js';
import { CurrentActor } from './actor.guard.js';
import { CreateTeamBody, IdParams, IssueApiKeyBody } from './dto.js';

@Controller('v1/teams')
export class TeamsController {
  constructor(private readonly teams: TeamService) {}

  @Post()
  create(
    @CurrentActor() actor: Actor,
    @Body(new TypeBoxPipe(CreateTeamBody)) body: Static<typeof CreateTeamBody>,
  ): Promise<TeamView> {
    return this.teams.create(actor, body);
  }

  @Get()
  async list(@CurrentActor() actor: Actor): Promise<{ items: TeamView[] }> {
    return { items: await this.teams.list(actor) };
  }
}

@Controller('v1/api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeyService) {}

  /** The plaintext `secret` is returned only in this response. */
  @Post()
  issue(
    @CurrentActor() actor: Actor,
    @Body(new TypeBoxPipe(IssueApiKeyBody)) body: Static<typeof IssueApiKeyBody>,
  ): Promise<IssuedApiKey> {
    return this.apiKeys.issue(actor, body);
  }

  @Get()
  async list(@CurrentActor() actor: Actor): Promise<{ items: ApiKeyView[] }> {
    return { items: await this.apiKeys.list(actor) };
  }

  @Delete(':id')
  @HttpCode(204)
  async revoke(
    @CurrentActor() actor: Actor,
    @Param(new TypeBoxPipe(IdParams)) params: Static<typeof IdParams>,
  ): Promise<void> {
    await this.apiKeys.revoke(actor, params.id);
  }
}
