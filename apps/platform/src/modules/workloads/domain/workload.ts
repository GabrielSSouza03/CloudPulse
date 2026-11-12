import { UnprocessableError } from '../../../shared-kernel/errors.js';

export const WORKLOAD_KINDS = ['agent', 'workflow', 'service', 'resource_group'] as const;
export type WorkloadKind = (typeof WORKLOAD_KINDS)[number];

/** Same shape as `workloadId` in usage envelope v1, so events can reference a workload by key. */
export const WORKLOAD_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const TAG_KEY_PATTERN = /^[a-z][a-z0-9_.-]{0,62}$/;
const MAX_TAGS = 32;

export type WorkloadTags = Record<string, string>;

/** Something that consumes resources and to which cost is attributed. Owned by exactly one team. */
export class Workload {
  id!: string;
  tenantId!: string;
  teamId!: string;
  key!: string;
  name!: string;
  kind!: WorkloadKind;
  tags!: WorkloadTags;
  createdAt!: Date;

  constructor(props: {
    id: string;
    tenantId: string;
    teamId: string;
    key: string;
    name: string;
    kind: WorkloadKind;
    tags?: WorkloadTags;
    createdAt: Date;
  }) {
    if (!WORKLOAD_KEY_PATTERN.test(props.key)) {
      throw new UnprocessableError('invalid_workload_key', `Invalid workload key: ${props.key}.`);
    }
    const name = props.name.trim();
    if (name.length < 1 || name.length > 200) {
      throw new UnprocessableError(
        'invalid_workload_name',
        'Workload name must be 1-200 characters.',
      );
    }
    const tags = props.tags ?? {};
    const entries = Object.entries(tags);
    if (entries.length > MAX_TAGS) {
      throw new UnprocessableError(
        'too_many_tags',
        `A workload may have at most ${MAX_TAGS} tags.`,
      );
    }
    for (const [key, value] of entries) {
      if (!TAG_KEY_PATTERN.test(key) || typeof value !== 'string' || value.length > 256) {
        throw new UnprocessableError('invalid_tag', `Invalid tag "${key}".`);
      }
    }
    Object.assign(this, { ...props, name, tags });
  }
}
