// Public API of the workloads bounded context. Other modules import only from this file.
export { WorkloadsModule } from './workloads.module.js';
export { type WorkloadView } from './application/workload.service.js';
export { WORKLOAD_KINDS, WORKLOAD_KEY_PATTERN, type WorkloadKind } from './domain/workload.js';
export { WORKLOADS_SCHEMAS } from './infrastructure/schemas.js';
