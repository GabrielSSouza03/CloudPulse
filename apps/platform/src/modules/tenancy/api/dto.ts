import { Type } from '@sinclair/typebox';
import { API_KEY_SCOPES } from '../domain/api-key.js';

export const CreateTeamBody = Type.Object(
  { name: Type.String({ minLength: 1, maxLength: 120 }) },
  { additionalProperties: false },
);

export const IssueApiKeyBody = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 120 }),
    scopes: Type.Array(Type.Union(API_KEY_SCOPES.map((s) => Type.Literal(s))), {
      minItems: 1,
      maxItems: 8,
    }),
  },
  { additionalProperties: false },
);

export const IdParams = Type.Object(
  { id: Type.String({ format: 'uuid' }) },
  { additionalProperties: false },
);
