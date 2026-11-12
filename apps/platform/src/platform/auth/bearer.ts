import type { FastifyRequest } from 'fastify';
import { UnauthenticatedError } from '../../shared-kernel/errors.js';

export function bearerToken(request: FastifyRequest): string {
  const header = request.headers.authorization;
  if (!header) throw new UnauthenticatedError('Missing Authorization header.');
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw new UnauthenticatedError('Authorization header must use the Bearer scheme.');
  }
  return token;
}
