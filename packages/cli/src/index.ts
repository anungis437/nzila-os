/**
 * Nzila OS — CLI Entrypoint
 *
 * Binary: nzila
 * Commands:
 *   create-vertical <name>  — Scaffold a new vertical with full governance posture
 */
import { Command } from 'commander'
import { createVertical } from './commands/create-vertical.js'

const program = new Command()

program
  .name('nzila')
  .description('Nzila OS platform CLI — structural enforcement tools')
  .version('0.1.0')

program
  .command('create-vertical <name>')
  .description('Scaffold a new vertical app with full governance posture (scopedDb, audit, RBAC, telemetry)')
  .option('--profile <profile>', 'Governance profile (union-eyes, abr-insights, fintech, commerce, agtech, media, advisory)', 'commerce')
  .option('--dry-run', 'Preview files without writing', false)
  .action(async (name: string, options: { profile: string; dryRun: boolean }) => {
    await createVertical(name, options)
  })

program.parse()
