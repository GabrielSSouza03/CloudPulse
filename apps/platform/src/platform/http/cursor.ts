import { ValidationFailedError } from '../../shared-kernel/errors.js';
import { isUuid } from '../../shared-kernel/ids.js';

/** Opaque keyset cursor. Clients must treat it as a token; its encoding may change. */
export function encodeCursor(lastId: string): string {
  return Buffer.from(JSON.stringify({ id: lastId }), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): string {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      id?: unknown;
    };
    if (typeof parsed.id === 'string' && isUuid(parsed.id)) return parsed.id;
  } catch {
    // fall through
  }
  throw new ValidationFailedError([
    { path: '/cursor', code: 'invalid_value', message: 'invalid cursor' },
  ]);
}
