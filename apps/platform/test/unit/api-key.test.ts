import { describe, expect, it } from 'vitest';
import {
  ApiKey,
  hashSecret,
  parseApiKey,
  secretMatches,
} from '../../src/modules/tenancy/domain/api-key.js';
import { UnprocessableError } from '../../src/shared-kernel/errors.js';

const issue = (overrides: Partial<Parameters<typeof ApiKey.issue>[0]> = {}) =>
  ApiKey.issue({
    id: '01a1ca14-5ca5-748e-9b51-594f7ba1ecaa',
    tenantId: '01a1ca13-f794-751b-8e6b-10ef35043f26',
    name: 'ingest',
    scopes: ['ingest:write'],
    createdBy: 'alice',
    now: new Date('2026-11-11T00:00:00Z'),
    ...overrides,
  });

describe('ApiKey', () => {
  it('issues a parseable key and stores only the SHA-256 of the secret', () => {
    const { apiKey, plaintext } = issue();
    const parsed = parseApiKey(plaintext);
    expect(parsed).not.toBeNull();
    expect(parsed?.keyId).toBe(apiKey.keyId);
    expect(apiKey.secretHash).toHaveLength(32);
    expect(apiKey.secretHash.equals(hashSecret(parsed?.secret as string))).toBe(true);
    expect(JSON.stringify(apiKey)).not.toContain(parsed?.secret);
  });

  it('matches only the original secret', () => {
    const { apiKey, plaintext } = issue();
    const { secret } = parseApiKey(plaintext) as { secret: string };
    expect(secretMatches(secret, apiKey.secretHash)).toBe(true);
    const tampered = secret.slice(0, -1) + (secret.endsWith('A') ? 'B' : 'A');
    expect(secretMatches(tampered, apiKey.secretHash)).toBe(false);
    expect(secretMatches(secret, Buffer.alloc(16))).toBe(false);
  });

  it('generates unique keys', () => {
    const keys = new Set(Array.from({ length: 50 }, () => issue().plaintext));
    expect(keys.size).toBe(50);
  });

  it.each([
    '',
    'cp_live_',
    'cp_test_0123456789abcdef_' + 'a'.repeat(43),
    'cp_live_0123456789ABCDEF_' + 'a'.repeat(43),
    'cp_live_0123456789abcdef_' + 'a'.repeat(42),
    'cp_live_0123456789abcdef_' + 'a'.repeat(42) + '!',
    ' cp_live_0123456789abcdef_' + 'a'.repeat(43),
  ])('rejects malformed key %#', (value) => {
    expect(parseApiKey(value)).toBeNull();
  });

  it('validates name and scopes and deduplicates scopes', () => {
    expect(() => issue({ name: '   ' })).toThrow(UnprocessableError);
    expect(() => issue({ scopes: [] })).toThrow(UnprocessableError);
    expect(issue({ scopes: ['ingest:write', 'ingest:write'] }).apiKey.scopes).toEqual([
      'ingest:write',
    ]);
  });

  it('revocation is idempotent and keeps the first timestamp', () => {
    const { apiKey } = issue();
    const first = new Date('2026-11-12T00:00:00Z');
    apiKey.revoke(first);
    apiKey.revoke(new Date('2026-11-13T00:00:00Z'));
    expect(apiKey.isRevoked()).toBe(true);
    expect(apiKey.revokedAt).toEqual(first);
  });
});
