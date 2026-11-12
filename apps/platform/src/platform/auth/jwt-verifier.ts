import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import {
  createLocalJWKSet,
  createRemoteJWKSet,
  errors,
  jwtVerify,
  type JSONWebKeySet,
  type JWTVerifyGetKey,
} from 'jose';
import { UnauthenticatedError } from '../../shared-kernel/errors.js';
import { isUuid } from '../../shared-kernel/ids.js';
import { APP_CONFIG, type AppConfig } from '../config/config.js';

/** Who the identity provider says the caller is. Authorization (roles) is resolved separately. */
export type Identity = { subject: string; tenantId: string };

/** Custom claim carrying the tenant the token is scoped to. */
export const TENANT_CLAIM = 'tid';

const ALLOWED_ALGORITHMS = ['EdDSA', 'ES256', 'RS256'];

/**
 * OIDC resource-server token verification. Production uses the IdP JWKS URL; local development
 * reads a JWKS file written by `pnpm dev:token`, loaded lazily so the api can start first.
 */
@Injectable()
export class JwtVerifier {
  private keySet: JWTVerifyGetKey | null = null;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async verify(token: string): Promise<Identity> {
    const keySet = await this.getKeySet();
    try {
      const { payload } = await jwtVerify(token, keySet, {
        issuer: this.config.auth.issuer,
        audience: this.config.auth.audience,
        algorithms: ALLOWED_ALGORITHMS,
        requiredClaims: ['sub', 'exp', TENANT_CLAIM],
        clockTolerance: 30,
      });
      const tenantId = payload[TENANT_CLAIM];
      if (typeof tenantId !== 'string' || !isUuid(tenantId) || !payload.sub) {
        throw new UnauthenticatedError('Token is missing a valid tenant claim.');
      }
      return { subject: payload.sub, tenantId };
    } catch (error) {
      if (error instanceof UnauthenticatedError) throw error;
      if (error instanceof errors.JWTExpired) throw new UnauthenticatedError('Token expired.');
      if (error instanceof errors.JOSEError)
        throw new UnauthenticatedError('Token verification failed.');
      throw error;
    }
  }

  private async getKeySet(): Promise<JWTVerifyGetKey> {
    if (this.keySet) return this.keySet;
    const { jwksUrl, devJwksPath } = this.config.auth;
    if (jwksUrl) {
      this.keySet = createRemoteJWKSet(new URL(jwksUrl));
      return this.keySet;
    }
    if (!devJwksPath) throw new UnauthenticatedError('No token signing keys are configured.');
    try {
      const jwks = JSON.parse(
        await readFile(resolve(process.cwd(), devJwksPath), 'utf8'),
      ) as JSONWebKeySet;
      this.keySet = createLocalJWKSet(jwks);
      return this.keySet;
    } catch {
      throw new UnauthenticatedError('Development JWKS not found; run `pnpm dev:token` first.');
    }
  }
}
