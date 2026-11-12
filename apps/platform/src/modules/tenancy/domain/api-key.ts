import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { UnprocessableError } from '../../../shared-kernel/errors.js';

export const API_KEY_SCOPES = ['ingest:write'] as const;
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

const PREFIX = 'cp_live_';
const KEY_ID_LENGTH = 16;
const KEY_PATTERN = /^cp_live_([0-9a-f]{16})_([A-Za-z0-9_-]{43})$/;

/**
 * Parsed form of `cp_live_<keyId>_<secret>`. `keyId` is a public lookup handle; `secret` is
 * 256 bits of randomness and is never stored, only its SHA-256 digest. A slow password hash is
 * unnecessary because the secret is not guessable, and it would cost gateway CPU per request.
 */
export type ParsedApiKey = { keyId: string; secret: string };

export function parseApiKey(plaintext: string): ParsedApiKey | null {
  const match = KEY_PATTERN.exec(plaintext);
  return match ? { keyId: match[1] as string, secret: match[2] as string } : null;
}

export function hashSecret(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest();
}

export function secretMatches(secret: string, storedHash: Buffer): boolean {
  const candidate = hashSecret(secret);
  return candidate.length === storedHash.length && timingSafeEqual(candidate, storedHash);
}

export class ApiKey {
  id!: string;
  tenantId!: string;
  keyId!: string;
  name!: string;
  secretHash!: Buffer;
  scopes!: ApiKeyScope[];
  createdBy!: string;
  createdAt!: Date;
  revokedAt!: Date | null;

  /** Creates a key and returns the plaintext once. The plaintext cannot be recovered later. */
  static issue(props: {
    id: string;
    tenantId: string;
    name: string;
    scopes: ApiKeyScope[];
    createdBy: string;
    now: Date;
  }): { apiKey: ApiKey; plaintext: string } {
    const name = props.name.trim();
    if (name.length < 1 || name.length > 120) {
      throw new UnprocessableError(
        'invalid_api_key_name',
        'API key name must be 1-120 characters.',
      );
    }
    if (props.scopes.length === 0) {
      throw new UnprocessableError('invalid_api_key_scopes', 'API key needs at least one scope.');
    }

    const keyId = randomBytes(KEY_ID_LENGTH / 2).toString('hex');
    const secret = randomBytes(32).toString('base64url');
    const apiKey = Object.assign(new ApiKey(), {
      id: props.id,
      tenantId: props.tenantId,
      keyId,
      name,
      secretHash: hashSecret(secret),
      scopes: [...new Set(props.scopes)],
      createdBy: props.createdBy,
      createdAt: props.now,
      revokedAt: null,
    });
    return { apiKey, plaintext: `${PREFIX}${keyId}_${secret}` };
  }

  revoke(now: Date): void {
    this.revokedAt ??= now;
  }

  isRevoked(): boolean {
    return this.revokedAt !== null;
  }
}
