import type { ProcessRole, WorkerRole } from '../platform/config/config.js';
import type { DependencyName } from '../platform/health/checks.js';

/** What each process needs to be ready. Liveness never depends on these. */
export function dependenciesFor(
  role: ProcessRole,
  workerRole: WorkerRole | null,
): DependencyName[] {
  switch (role) {
    case 'api':
      return ['postgres'];
    case 'gateway':
      return ['redpanda', 'redis', 'postgres'];
    case 'worker':
      switch (workerRole) {
        case 'cost':
        case 'governance':
        case 'outbox-relay':
          return ['postgres', 'redpanda'];
        case 'analytics-sink':
          return ['redpanda', 'clickhouse'];
        case 'scheduler':
          return ['postgres', 'clickhouse'];
        default:
          return [];
      }
  }
}
