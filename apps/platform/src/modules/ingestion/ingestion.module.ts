import { Module } from '@nestjs/common';
import { EVENT_TIME_WINDOW, UsageEventValidator } from './application/usage-event-validator.js';
import { DEFAULT_EVENT_TIME_WINDOW } from './domain/event-time-window.js';

/** Telemetry ingestion. Phase 1 ships validation only; the Redpanda producer arrives in Phase 2. */
@Module({
  providers: [
    UsageEventValidator,
    { provide: EVENT_TIME_WINDOW, useValue: DEFAULT_EVENT_TIME_WINDOW },
  ],
  exports: [UsageEventValidator],
})
export class IngestionModule {}
