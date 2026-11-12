// Regenerates the committed JSON Schema snapshot used by the compatibility test.
// Run only after confirming the change is additive (the test lists breaking changes).
import { writeFileSync } from 'node:fs';
import { UsageEnvelopeV1 } from '../dist/index.js';

const target = new URL('../schemas/usage-envelope.v1.json', import.meta.url);
writeFileSync(target, `${JSON.stringify(UsageEnvelopeV1, null, 2)}\n`);
console.log(`wrote ${target.pathname}`);
