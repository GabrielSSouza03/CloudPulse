/** Kafka header names attached to every record produced by CloudPulse. */
export const MessageHeaders = {
  eventType: 'cp-event-type',
  schemaVersion: 'cp-schema-version',
  tenantId: 'cp-tenant-id',
  apiKeyId: 'cp-api-key-id',
  receivedAt: 'cp-received-at',
  gatewayId: 'cp-gateway-id',
  traceparent: 'traceparent',
  tracestate: 'tracestate',
} as const;

export const Topics = {
  usageRawV1: 'usage.raw.v1',
  usageRetryV1: 'usage.retry.v1',
  usageRawDlqV1: 'usage.raw.dlq.v1',
  usageCostedV1: 'usage.costed.v1',
  governanceEventsV1: 'governance.events.v1',
} as const;

/**
 * Partition key for raw usage: `tenantId:executionId`, falling back to
 * `tenantId:workloadId:resourceId` for metered usage that has no execution.
 */
export function usagePartitionKey(
  tenantId: string,
  event: { executionId?: string; workloadId: string; resourceId?: string },
): string {
  if (event.executionId) return `${tenantId}:${event.executionId}`;
  return `${tenantId}:${event.workloadId}:${event.resourceId ?? '-'}`;
}
