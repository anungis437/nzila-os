/**
 * `.env.example` (UE-CONV-H-024): generated from the environment registry, so the example cannot say anything the registry does not, and read back for the census.
 *
 * One comment line per variable, grouped as `ENV_GROUPS` orders them. A variable that must never reach a deployed environment (`dev-only`, and the `staging` ones
 * that must not reach production) is written commented out: copying the example into a deployment then cannot switch it on. Test-only variables are left out.
 */
import { ENV_GROUPS, type EnvEntry } from '../../../lib/config/env-registry'

const HEADER = [
  '# Union Eyes environment template.',
  '# GENERATED from lib/config/env-registry.ts by `pnpm census:env --write-example`. Edit the registry, never this file: `pnpm census:env` fails when they differ.',
  '# One comment line per variable: [when it is required | what kind] what it is for.',
  '#   production = every deployed environment   staging = staging and pilot only, never production   optional = a feature or a tuning knob',
  '#   dev-only = local development only (shown commented out on purpose: copying this file into a deployment must not switch it on)',
  '# Secrets are left empty. A value generated with `openssl rand -hex 32` suits any key the comment does not describe otherwise.',
]

/** True for the variables the example shows commented out. */
export const isCommentedOut = (entry: EnvEntry): boolean => entry.required === 'dev-only' || entry.required === 'staging'

export function exampleEntries(registry: readonly EnvEntry[]): EnvEntry[] {
  return registry.filter((entry) => entry.required !== 'test-only')
}

export function generateExample(registry: readonly EnvEntry[]): string {
  const lines = [...HEADER]
  for (const [group, title] of Object.entries(ENV_GROUPS)) {
    const members = exampleEntries(registry).filter((entry) => entry.group === group)
    if (members.length === 0) continue
    lines.push('', `# ── ${title} ${'─'.repeat(Math.max(4, 96 - title.length))}`)
    for (const entry of members) {
      lines.push(`# [${entry.required} | ${entry.kind}] ${entry.description}`)
      lines.push(`${isCommentedOut(entry) ? '# ' : ''}${entry.name}=${entry.example ?? ''}`)
    }
  }
  return `${lines.join('\n')}\n`
}

export interface ExampleVariable {
  name: string
  commented: boolean
  value: string
  line: number
}

/** The variables an example file declares, commented out or not. */
export function parseExample(text: string): ExampleVariable[] {
  const variables: ExampleVariable[] = []
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const match = /^(#\s*)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim())
    if (match) variables.push({ name: match[2], commented: Boolean(match[1]), value: match[3], line: index + 1 })
  }
  return variables
}
