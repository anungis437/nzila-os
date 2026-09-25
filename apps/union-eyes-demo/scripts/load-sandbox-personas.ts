/**
 * Idempotent persona load helper.
 *
 * Prints the load guide and a public seed summary. Refuses to print
 * password values. Does not send mail and does not write a schema.
 */
import { formatPersonaLoadGuide } from '../lib/demo/sandbox/personas';
import { buildSandboxSeed, publicSeedSummary } from '../lib/demo/sandbox/seed';

const guide = formatPersonaLoadGuide();
const summary = JSON.stringify(publicSeedSummary(buildSandboxSeed()), null, 2);
const output = `${guide}\n\nSeed summary (idempotent):\n${summary}\n`;

if (/password\s*[:=]\s*\S+/i.test(output)) {
  console.error('Refusing to print credential values.');
  process.exit(1);
}

const first = buildSandboxSeed();
const second = buildSandboxSeed();
if (JSON.stringify(publicSeedSummary(first)) !== JSON.stringify(publicSeedSummary(second))) {
  console.error('Seed is not idempotent.');
  process.exit(1);
}

process.stdout.write(output);
