import { Type, type Static } from '@sinclair/typebox';
import { MEASUREMENT_UNITS, USAGE_EVENT_TYPES } from './event-types.js';

export const USAGE_SCHEMA_VERSION = 1 as const;

/** Non-negative decimal as a string. Quantities and amounts never travel as JSON numbers. */
export const DecimalString = Type.String({
  pattern: '^(0|[1-9][0-9]{0,23})(\\.[0-9]{1,12})?$',
  maxLength: 40,
  description: 'Non-negative decimal string, up to 24 integer and 12 fractional digits.',
});

export const CurrencyCode = Type.String({ pattern: '^[A-Z]{3}$', description: 'ISO 4217 code.' });

const Identifier = Type.String({
  minLength: 1,
  maxLength: 128,
  pattern: '^[A-Za-z0-9][A-Za-z0-9_.:-]*$',
});

const Uuid = Type.String({ format: 'uuid' });

export const Measurement = Type.Object(
  {
    dimension: Type.String({ minLength: 1, maxLength: 128, pattern: '^[a-z][a-z0-9_.]*$' }),
    quantity: DecimalString,
    unit: Type.Union(MEASUREMENT_UNITS.map((u) => Type.Literal(u))),
  },
  { additionalProperties: false },
);

export const Money = Type.Object(
  { amount: DecimalString, currency: CurrencyCode },
  { additionalProperties: false },
);

export const EventSource = Type.Object(
  {
    kind: Type.Union([
      Type.Literal('sdk'),
      Type.Literal('otel'),
      Type.Literal('collector'),
      Type.Literal('provider'),
    ]),
    name: Type.String({ minLength: 1, maxLength: 128 }),
    version: Type.Optional(Type.String({ maxLength: 64 })),
  },
  { additionalProperties: false },
);

const AttributeValue = Type.Union([
  Type.String({ maxLength: 1024 }),
  Type.Number(),
  Type.Boolean(),
]);

export const UsageEnvelopeV1 = Type.Object(
  {
    eventId: Uuid,
    eventType: Type.Union(USAGE_EVENT_TYPES.map((t) => Type.Literal(t))),
    schemaVersion: Type.Literal(USAGE_SCHEMA_VERSION),
    occurredAt: Type.String({ format: 'date-time' }),
    source: EventSource,
    workloadId: Identifier,
    executionId: Type.Optional(Uuid),
    parentExecutionId: Type.Optional(Type.Union([Uuid, Type.Null()])),
    agentId: Type.Optional(Identifier),
    resourceId: Type.Optional(Type.String({ minLength: 1, maxLength: 512 })),
    stepIndex: Type.Optional(Type.Integer({ minimum: 0 })),
    attempt: Type.Optional(Type.Integer({ minimum: 1 })),
    reservationId: Type.Optional(Uuid),
    attributes: Type.Optional(
      Type.Record(Type.String({ maxLength: 128 }), AttributeValue, { maxProperties: 64 }),
    ),
    measurements: Type.Array(Measurement, { maxItems: 32 }),
    reportedCost: Type.Optional(Money),
    outcome: Type.Optional(
      Type.Union([Type.Literal('success'), Type.Literal('failure'), Type.Null()]),
    ),
  },
  { additionalProperties: false, $id: 'https://cloudpulse.dev/schemas/usage-envelope.v1.json' },
);

export type UsageEnvelopeV1 = Static<typeof UsageEnvelopeV1>;

export const MAX_BATCH_EVENTS = 1000;

export const UsageBatchV1 = Type.Object(
  { events: Type.Array(Type.Unknown(), { minItems: 1, maxItems: MAX_BATCH_EVENTS }) },
  { additionalProperties: false },
);

export type UsageBatchV1 = Static<typeof UsageBatchV1>;
