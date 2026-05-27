#!/usr/bin/env node

const groups = [
  {
    title: 'Core engineering',
    commands: [
      'pnpm check:core',
      'pnpm lint',
      'pnpm typecheck',
      'pnpm test:changed',
    ],
  },
  {
    title: 'Governance and compliance',
    commands: [
      'pnpm check:governance',
      'pnpm validate:governance',
      'pnpm exec tsx tooling/governance/validate-governance-gate.ts',
      'pnpm validate:evidence:lifecycle',
    ],
  },
  {
    title: 'Release and risk control',
    commands: [
      'pnpm check:release-readiness',
      'pnpm verify:security',
      'pnpm coverage:dashboard',
      'pnpm strategic:quarterly',
    ],
  },
]

console.log('Nzila Command Catalog')
console.log('=====================')
for (const group of groups) {
  console.log(`\n${group.title}:`)
  for (const command of group.commands) {
    console.log(`  - ${command}`)
  }
}

console.log('\nFor full details, see docs/platform/COMMAND_CATALOG.md')
