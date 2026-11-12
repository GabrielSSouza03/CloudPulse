// Public API of the tenancy bounded context. Other modules import only from this file.
export { TenancyModule, TenancyAuthenticationModule } from './tenancy.module.js';
export { ActorGuard, CurrentActor } from './api/actor.guard.js';
export { ApiKeyAuthenticator, type ApiKeyPrincipal } from './application/api-key.service.js';
export { type Actor, authorize, PermissionDeniedError } from './domain/actor.js';
export { type Permission, type Role, ROLES } from './domain/rbac.js';
export { TENANCY_SCHEMAS } from './infrastructure/schemas.js';
