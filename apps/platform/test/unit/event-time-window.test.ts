import { describe, expect, it } from 'vitest';
import {
  checkEventTime,
  DEFAULT_EVENT_TIME_WINDOW,
} from '../../src/modules/ingestion/domain/event-time-window.js';

const received = new Date('2026-11-11T12:00:00Z');
const at = (offsetMs: number) => new Date(received.getTime() + offsetMs).toISOString();
const day = 24 * 60 * 60 * 1000;

describe('checkEventTime', () => {
  it('accepts events inside the lateness window and the allowed skew', () => {
    expect(checkEventTime(at(-34 * day), received, DEFAULT_EVENT_TIME_WINDOW)).toBeNull();
    expect(checkEventTime(at(4 * 60 * 1000), received, DEFAULT_EVENT_TIME_WINDOW)).toBeNull();
  });

  it('rejects events older than the lateness window', () => {
    expect(checkEventTime(at(-36 * day), received, DEFAULT_EVENT_TIME_WINDOW)?.code).toBe(
      'event_too_old',
    );
  });

  it('rejects events too far in the future', () => {
    expect(checkEventTime(at(6 * 60 * 1000), received, DEFAULT_EVENT_TIME_WINDOW)?.code).toBe(
      'event_in_future',
    );
  });
});
