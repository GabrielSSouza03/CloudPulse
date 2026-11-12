import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { bearerToken } from '../../../platform/auth/bearer.js';
import { JwtVerifier } from '../../../platform/auth/jwt-verifier.js';
import { IS_PUBLIC } from '../../../platform/auth/public.decorator.js';
import { UnauthenticatedError } from '../../../shared-kernel/errors.js';
import { ActorResolver } from '../application/actor-resolver.js';
import type { Actor } from '../domain/actor.js';

type RequestWithActor = FastifyRequest & { actor?: Actor };

/** Global guard for the control-plane api: verifies the JWT, then resolves tenant roles. */
@Injectable()
export class ActorGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: JwtVerifier,
    private readonly actors: ActorResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<RequestWithActor>();
    const identity = await this.verifier.verify(bearerToken(request));
    request.actor = await this.actors.resolve(identity);
    return true;
  }
}

export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Actor => {
    const actor = context.switchToHttp().getRequest<RequestWithActor>().actor;
    if (!actor) throw new UnauthenticatedError();
    return actor;
  },
);
