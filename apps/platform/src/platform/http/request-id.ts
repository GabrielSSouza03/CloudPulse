import type { IncomingMessage } from 'node:http';
import { newId } from '../../shared-kernel/ids.js';

export const REQUEST_ID_HEADER = 'x-request-id';

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;

/**
 * Honors a caller-supplied `X-Request-Id` only when it is a safe token (it ends up in logs and
 * responses); otherwise generates a UUIDv7.
 */
export function generateRequestId(req: IncomingMessage): string {
  const header = req.headers[REQUEST_ID_HEADER];
  const candidate = Array.isArray(header) ? header[0] : header;
  return candidate && SAFE_REQUEST_ID.test(candidate) ? candidate : newId();
}
