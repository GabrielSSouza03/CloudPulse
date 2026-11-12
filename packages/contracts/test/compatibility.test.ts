import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findBreakingChanges, UsageEnvelopeV1 } from '../src/index.js';

const snapshot = JSON.parse(
  readFileSync(new URL('../schemas/usage-envelope.v1.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;
const current = JSON.parse(JSON.stringify(UsageEnvelopeV1)) as Record<string, unknown>;

describe('usage envelope v1 compatibility', () => {
  it('has no breaking change against the committed snapshot', () => {
    expect(findBreakingChanges(snapshot, current)).toEqual([]);
  });

  it('snapshot is up to date (run `pnpm --filter @cloudpulse/contracts schemas:snapshot`)', () => {
    expect(current).toEqual(snapshot);
  });
});

describe('findBreakingChanges', () => {
  const base = {
    type: 'object',
    required: ['a'],
    properties: {
      a: { type: 'string', maxLength: 10 },
      kind: { anyOf: [{ const: 'x' }, { const: 'y' }] },
    },
  };

  it('allows a new optional field and a new literal', () => {
    const next = structuredClone(base);
    Object.assign(next.properties, {
      b: { type: 'string' },
      kind: { anyOf: [{ const: 'x' }, { const: 'y' }, { const: 'z' }] },
    });
    expect(findBreakingChanges(base, next)).toEqual([]);
  });

  it('flags removed fields, new required fields, removed literals and tightened limits', () => {
    const next = {
      type: 'object',
      required: ['a', 'b'],
      properties: {
        a: { type: 'string', maxLength: 5 },
        b: { type: 'string' },
        kind: { anyOf: [{ const: 'x' }] },
      },
    };
    expect(findBreakingChanges(base, next)).toEqual([
      '/b: became required',
      '/a: maxLength tightened',
      '/kind: literal "y" removed',
    ]);
  });
});
