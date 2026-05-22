import { spawnSync } from 'node:child_process'

const steps: Array<{ command: string; args: string[]; label: string }> = [
  {
    label: 'financial-service typecheck',
    command: 'pnpm',
    args: ['--filter', 'financial-service', 'typecheck'],
  },
  {
    label: 'financial-service lint',
    command: 'pnpm',
    args: ['--filter', 'financial-service', 'lint'],
  },
  {
    label: 'financial-service test',
    command: 'pnpm',
    args: ['--filter', 'financial-service', 'test'],
  },
]

for (const step of steps) {
  // Keep output streamed so CI logs show the failing gate directly.
  console.log(`\n[financial-service:health] running: ${step.label}`)
  const result = spawnSync(step.command, step.args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (result.status !== 0) {
    console.error(
      `[financial-service:health] failed at step: ${step.label} (exit ${result.status ?? 1})`
    )
    process.exit(result.status ?? 1)
  }
}

console.log('\n[financial-service:health] PASS')
