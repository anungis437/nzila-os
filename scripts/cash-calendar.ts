#!/usr/bin/env npx tsx

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { buildCapitalOutputs } from './lib/capital-allocation'
import { findRepoRoot } from './lib/portfolio-governance'

function formatMoney(value: number): string {
  return `$${Math.round(value).toLocaleString()}`
}

function writeFile(root: string, relativePath: string, content: string): void {
  const absolutePath = join(root, relativePath)
  mkdirSync(dirname(absolutePath), { recursive: true })
  writeFileSync(absolutePath, content)
}

function main(): void {
  const root = findRepoRoot()
  const outputs = buildCapitalOutputs(root)

  if (outputs.validation.errors.length > 0) {
    console.log('\n[cash-calendar] FAIL')
    for (const error of outputs.validation.errors) console.log(` - ${error}`)
    process.exit(1)
  }

  const content = [
    '# Cash Calendar',
    '',
    `Assumptions: ${outputs.cash_calendar.assumptions_note}`,
    '',
    '| Horizon | Date | Starting Cash | Obligations | Receivables | Ending Cash |',
    '| --- | --- | ---: | ---: | ---: | ---: |',
    ...outputs.cash_forecast.map((checkpoint) => `| ${checkpoint.days} days | ${checkpoint.date} | ${formatMoney(checkpoint.starting_cash)} | ${formatMoney(checkpoint.obligations)} | ${formatMoney(checkpoint.receivables)} | ${formatMoney(checkpoint.ending_cash)} |`),
    '',
  ].join('\n') + '\n'

  writeFile(root, 'reports/cash-calendar.md', content)
  console.log('\n[cash-calendar] PASS')
  console.log('Wrote reports/cash-calendar.md')
}

main()