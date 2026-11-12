import { Type } from '@sinclair/typebox';
import { WORKLOAD_KINDS } from '../domain/workload.js';

const Kind = Type.Union(WORKLOAD_KINDS.map((k) => Type.Literal(k)));

export const RegisterWorkloadBody = Type.Object(
  {
    key: Type.String({ minLength: 1, maxLength: 128, pattern: '^[A-Za-z0-9][A-Za-z0-9_.:-]*$' }),
    name: Type.String({ minLength: 1, maxLength: 200 }),
    kind: Kind,
    teamId: Type.String({ format: 'uuid' }),
    tags: Type.Optional(
      Type.Record(Type.String({ maxLength: 63 }), Type.String({ maxLength: 256 }), {
        maxProperties: 32,
      }),
    ),
  },
  { additionalProperties: false },
);

export const ListWorkloadsQuery = Type.Object(
  {
    limit: Type.Integer({ minimum: 1, maximum: 200, default: 50 }),
    cursor: Type.Optional(Type.String({ maxLength: 512 })),
    teamId: Type.Optional(Type.String({ format: 'uuid' })),
    kind: Type.Optional(Kind),
  },
  { additionalProperties: false },
);
