import type { ValidationIssue } from '@cloudpulse/contracts';

export type EventTimeWindow = {
  /** Oldest accepted `occurredAt`, relative to receive time. Older events need a backfill path. */
  maxLatenessMs: number;
  /** Tolerated producer clock skew into the future. */
  maxFutureSkewMs: number;
};

export const DEFAULT_EVENT_TIME_WINDOW: EventTimeWindow = {
  maxLatenessMs: 35 * 24 * 60 * 60 * 1000,
  maxFutureSkewMs: 5 * 60 * 1000,
};

/** Checks `occurredAt` against the receiver clock. Pricing always uses `occurredAt`, never receive time. */
export function checkEventTime(
  occurredAt: string,
  receivedAt: Date,
  window: EventTimeWindow,
): ValidationIssue | null {
  const occurred = Date.parse(occurredAt);
  const now = receivedAt.getTime();
  if (occurred < now - window.maxLatenessMs) {
    return {
      path: '/occurredAt',
      code: 'event_too_old',
      message: 'occurredAt is older than the accepted lateness window',
    };
  }
  if (occurred > now + window.maxFutureSkewMs) {
    return {
      path: '/occurredAt',
      code: 'event_in_future',
      message: 'occurredAt is too far in the future',
    };
  }
  return null;
}
