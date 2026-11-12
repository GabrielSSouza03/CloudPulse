/**
 * Usage event types accepted in envelope v1 and the measurement dimensions each one may carry.
 *
 * Dimension names follow OpenTelemetry GenAI semantic conventions where the spec defines them
 * (`gen_ai.usage.*`). Anything the spec does not define lives under the `cloudpulse.*` namespace.
 */

export const USAGE_EVENT_TYPES = [
  'ai.llm.call',
  'ai.embedding.call',
  'ai.tool.call',
  'ai.vector.op',
  'execution.started',
  'execution.completed',
  'compute.usage',
  'storage.usage',
  'network.transfer',
  'external.service.call',
] as const;

export type UsageEventType = (typeof USAGE_EVENT_TYPES)[number];

export const MEASUREMENT_UNITS = [
  'token',
  'request',
  'call',
  'operation',
  'second',
  'vcpu_second',
  'gb_second',
  'gpu_second',
  'gb_month',
  'byte',
  'gb',
] as const;

export type MeasurementUnit = (typeof MEASUREMENT_UNITS)[number];

export type DimensionSpec = { readonly unit: MeasurementUnit };

const tokens = (dimension: string): [string, DimensionSpec] => [dimension, { unit: 'token' }];

export const ALLOWED_DIMENSIONS: Readonly<
  Record<UsageEventType, ReadonlyMap<string, DimensionSpec>>
> = {
  'ai.llm.call': new Map([
    tokens('gen_ai.usage.input_tokens'),
    tokens('gen_ai.usage.output_tokens'),
    tokens('cloudpulse.usage.cached_input_tokens'),
    tokens('cloudpulse.usage.cache_write_input_tokens'),
    tokens('cloudpulse.usage.reasoning_tokens'),
    tokens('cloudpulse.usage.total_tokens'),
    ['cloudpulse.usage.requests', { unit: 'request' }],
  ]),
  'ai.embedding.call': new Map([
    tokens('gen_ai.usage.input_tokens'),
    ['cloudpulse.usage.requests', { unit: 'request' }],
  ]),
  'ai.tool.call': new Map([
    ['cloudpulse.usage.calls', { unit: 'call' }],
    ['cloudpulse.usage.duration', { unit: 'second' }],
  ]),
  'ai.vector.op': new Map([
    ['cloudpulse.usage.operations', { unit: 'operation' }],
    ['cloudpulse.usage.storage', { unit: 'gb_month' }],
  ]),
  'execution.started': new Map(),
  'execution.completed': new Map([['cloudpulse.usage.duration', { unit: 'second' }]]),
  'compute.usage': new Map([
    ['cloudpulse.usage.vcpu', { unit: 'vcpu_second' }],
    ['cloudpulse.usage.memory', { unit: 'gb_second' }],
    ['cloudpulse.usage.gpu', { unit: 'gpu_second' }],
  ]),
  'storage.usage': new Map([['cloudpulse.usage.storage', { unit: 'gb_month' }]]),
  'network.transfer': new Map([
    ['cloudpulse.usage.egress', { unit: 'gb' }],
    ['cloudpulse.usage.ingress', { unit: 'gb' }],
  ]),
  'external.service.call': new Map([
    ['cloudpulse.usage.calls', { unit: 'call' }],
    ['cloudpulse.usage.requests', { unit: 'request' }],
  ]),
};
