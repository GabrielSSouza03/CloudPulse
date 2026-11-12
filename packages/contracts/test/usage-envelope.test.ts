import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { usagePartitionKey, validateUsageEvent } from '../src/index.js';

const fixturesDir = new URL('../fixtures/usage/v1/', import.meta.url);
const readJson = (relative: string): unknown =>
  JSON.parse(readFileSync(new URL(relative, fixturesDir), 'utf8'));

const validFixtures = readdirSync(new URL('valid/', fixturesDir)).filter((f) =>
  f.endsWith('.json'),
);

type InvalidCase = {
  name: string;
  base: string;
  patch?: Record<string, unknown>;
  remove?: string[];
  expected: { path: string; code: string }[];
};
const invalidCases = readJson('invalid/cases.json') as InvalidCase[];

describe('usage envelope v1', () => {
  it.each(validFixtures)('accepts valid fixture %s', (file) => {
    const result = validateUsageEvent(readJson(`valid/${file}`));
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  it.each(invalidCases.map((c) => [c.name, c] as const))('rejects: %s', (_name, c) => {
    const event = { ...(readJson(`valid/${c.base}`) as Record<string, unknown>), ...c.patch };
    for (const key of c.remove ?? []) delete event[key];

    const result = validateUsageEvent(event);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map(({ path, code }) => ({ path, code }))).toEqual(c.expected);
    }
  });
});

describe('usagePartitionKey', () => {
  it('keys by execution when present', () => {
    expect(usagePartitionKey('t1', { executionId: 'e1', workloadId: 'w1' })).toBe('t1:e1');
  });

  it('falls back to workload and resource for metered usage', () => {
    expect(usagePartitionKey('t1', { workloadId: 'w1', resourceId: 'r1' })).toBe('t1:w1:r1');
    expect(usagePartitionKey('t1', { workloadId: 'w1' })).toBe('t1:w1:-');
  });
});
