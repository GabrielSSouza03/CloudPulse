import { Inject, Injectable } from '@nestjs/common';
import {
  type UsageEnvelopeV1,
  validateUsageEvent,
  type ValidationResult,
} from '@cloudpulse/contracts';
import { CLOCK, type Clock } from '../../../shared-kernel/clock.js';
import {
  checkEventTime,
  DEFAULT_EVENT_TIME_WINDOW,
  type EventTimeWindow,
} from '../domain/event-time-window.js';

export const EVENT_TIME_WINDOW = Symbol('EventTimeWindow');

/**
 * Full gateway-side validation of one usage event: contract (schema + semantics) and the
 * receive-time window. Invalid events are rejected to the caller, never sent to a DLQ.
 */
@Injectable()
export class UsageEventValidator {
  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(EVENT_TIME_WINDOW) private readonly window: EventTimeWindow = DEFAULT_EVENT_TIME_WINDOW,
  ) {}

  validate(input: unknown): ValidationResult<UsageEnvelopeV1> {
    const result = validateUsageEvent(input);
    if (!result.ok) return result;
    const timeIssue = checkEventTime(result.value.occurredAt, this.clock.now(), this.window);
    return timeIssue ? { ok: false, errors: [timeIssue] } : result;
  }
}
