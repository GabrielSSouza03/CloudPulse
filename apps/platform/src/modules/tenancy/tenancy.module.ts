import { Module } from '@nestjs/common';
import { ActorResolver } from './application/actor-resolver.js';
import { ApiKeyAuthenticator, ApiKeyService } from './application/api-key.service.js';
import { TeamService } from './application/team.service.js';
import { ActorGuard } from './api/actor.guard.js';
import { ApiKeysController, TeamsController } from './api/tenancy.controller.js';

@Module({
  controllers: [TeamsController, ApiKeysController],
  providers: [ActorResolver, ActorGuard, TeamService, ApiKeyService, ApiKeyAuthenticator],
  exports: [ActorGuard, ActorResolver, ApiKeyAuthenticator],
})
export class TenancyModule {}

/** Machine-credential authentication only, for processes that serve no human routes (gateway). */
@Module({
  providers: [ApiKeyAuthenticator],
  exports: [ApiKeyAuthenticator],
})
export class TenancyAuthenticationModule {}
