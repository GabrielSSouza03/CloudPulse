type JsonSchema = {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  anyOf?: JsonSchema[];
  const?: unknown;
  maxItems?: number;
  maxLength?: number;
  pattern?: string;
  [key: string]: unknown;
};

/**
 * Lists changes from `previous` to `next` that would reject events a v1 producer may already send.
 * Only additive evolution is allowed inside one schema version: new optional fields, new enum
 * literals, relaxed limits. Anything else needs a new `schemaVersion`.
 */
export function findBreakingChanges(previous: JsonSchema, next: JsonSchema, path = ''): string[] {
  const problems: string[] = [];
  const at = path || '/';

  if (JSON.stringify(previous.type) !== JSON.stringify(next.type)) {
    problems.push(
      `${at}: type changed from ${JSON.stringify(previous.type)} to ${JSON.stringify(next.type)}`,
    );
  }
  if (previous.pattern !== next.pattern && previous.pattern !== undefined) {
    problems.push(`${at}: pattern changed`);
  }
  if (previous.const !== undefined && previous.const !== next.const) {
    problems.push(`${at}: const changed`);
  }
  for (const limit of ['maxItems', 'maxLength'] as const) {
    const before = previous[limit];
    const after = next[limit];
    if (after !== undefined && (before === undefined || after < before)) {
      problems.push(`${at}: ${limit} tightened`);
    }
  }

  const newlyRequired = (next.required ?? []).filter((r) => !(previous.required ?? []).includes(r));
  for (const r of newlyRequired) problems.push(`${path}/${r}: became required`);

  for (const [name, schema] of Object.entries(previous.properties ?? {})) {
    const nextSchema = next.properties?.[name];
    if (!nextSchema) {
      problems.push(`${path}/${name}: removed`);
    } else {
      problems.push(...findBreakingChanges(schema, nextSchema, `${path}/${name}`));
    }
  }

  if (previous.items && next.items) {
    problems.push(...findBreakingChanges(previous.items, next.items, `${path}/items`));
  }

  if (previous.anyOf) {
    const literals = (s: JsonSchema) =>
      (s.anyOf ?? []).filter((b) => b.const !== undefined).map((b) => b.const);
    const nextLiterals = literals(next);
    for (const lit of literals(previous)) {
      if (!nextLiterals.includes(lit))
        problems.push(`${at}: literal ${JSON.stringify(lit)} removed`);
    }
  }

  return problems;
}
