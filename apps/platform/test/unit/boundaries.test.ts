import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const run = promisify(execFile);
const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const depcruise = join(repoRoot, 'node_modules/.bin/depcruise');

async function cruise(target: string): Promise<{ code: number; out: string }> {
  try {
    const { stdout } = await run(depcruise, [target, '--config', '.dependency-cruiser.cjs'], {
      cwd: repoRoot,
    });
    return { code: 0, out: stdout };
  } catch (error) {
    const failure = error as { code: number; stdout: string };
    return { code: failure.code, out: failure.stdout };
  }
}

describe('module boundaries', () => {
  it('passes for the application source', async () => {
    const result = await cruise('apps/platform/src');
    expect(result.out).toContain('no dependency violations found');
    expect(result.code).toBe(0);
  }, 60_000);

  it('rejects each kind of violation in the fixture', async () => {
    const result = await cruise('apps/platform/test/boundaries/fixture/src');
    expect(result.code).not.toBe(0);
    for (const rule of [
      'no-cross-module-internals',
      'domain-is-framework-free',
      'domain-does-not-import-outer-layers',
      'platform-does-not-import-modules',
    ]) {
      expect(result.out).toContain(rule);
    }
  }, 60_000);
});
