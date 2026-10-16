import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { walk } from './g3r2-source-closure.mjs'

const root = fileURLToPath(new URL('./', import.meta.url))
const repo = path.resolve(root, '..', '..')
export async function scanSource() {
  const scratch = mkdtempSync(path.join(os.tmpdir(), 'nzila-g3r2-secrets-'))
  const report = path.join(scratch, 'redacted.json')
  try {
    const command = [
      'dir',
      path.join(root, 'g3-source'),
      '--config',
      path.join(repo, '.gitleaks.toml'),
      '--redact',
      '--no-banner',
      '--report-format',
      'json',
      '--report-path',
      report,
    ]
    const result = spawnSync('gitleaks', command, { cwd: repo, encoding: 'utf8' })
    assert([0, 1].includes(result.status), `GITLEAKS_TOOL_FAILURE:${result.stderr}`)
    const findings = JSON.parse(readFileSync(report, 'utf8'))
    const names = JSON.parse(
      readFileSync(path.join(root, 'g3-readiness-evidence', 'G3_EXECUTION_READINESS.json'), 'utf8'),
    ).candidateNames
    const exactNonsecretLines = new Set([
      `"keyVault": "${names.keyVault}",`,
      `"keyVaultEndpoint": "${names.keyVaultEndpoint}",`,
      '"role": "Key Vault Secrets User:4633458b-17de-408a-b874-0445c86b69e6",',
    ])
    const adjudication = findings.map((finding) => {
      const file = path.resolve(repo, finding.File)
      assert(
        file.startsWith(`${path.join(root, 'g3-source')}${path.sep}`),
        'SECRET_SCAN_FINDING_OUTSIDE_SOURCE',
      )
      const line = readFileSync(file, 'utf8').split(/\r?\n/)[finding.StartLine - 1].trim()
      assert(
        finding.RuleID === 'generic-api-key' &&
          finding.StartLine === finding.EndLine &&
          exactNonsecretLines.has(line),
        `UNADJUDICATED_SECRET_SCAN_FINDING:${finding.RuleID}:${finding.File}:${finding.StartLine}`,
      )
      return {
        rule: finding.RuleID,
        file: finding.File,
        startLine: finding.StartLine,
        endLine: finding.EndLine,
        classification: 'EXACT_CANONICAL_RESOURCE_NAME_OR_PUBLIC_BUILTIN_ROLE_ID_NOT_SECRET',
        rawScannerResult: 'FINDING;not suppressed or scannerPASS',
      }
    })
    const output = {
      invocation: 'node infrastructure\\landing-zone\\g3r2-secret-scan.mjs',
      command: ['gitleaks', ...command],
      scannerExitCode: result.status,
      rawFindings: findings.length,
      exactNonsecretAdjudications: adjudication,
      sourceDigests: walk(path.join(root, 'g3-source')),
      repositoryScannerConfigSha256: createHash('sha256')
        .update(readFileSync(path.join(repo, '.gitleaks.toml')))
        .digest('hex'),
      unresolvedFindings: 0,
      secretValuesFound: 0,
      status: 'PASS_EXACT_NONSECRET_ADJUDICATION_NOT_RAW_SCANNER_PASS',
      repositoryScannerConfigChanged: false,
      generatedAllowlistOrBaselineUsed: false,
      redaction: true,
    }
    writeFileSync(
      path.join(root, 'g3-readiness-evidence', 'G3R2_SECRET_SCAN.json'),
      `${JSON.stringify(output, null, 2)}\n`,
    )
    console.log(
      `PASS secret adjudication;raw scannerexit${result.status},${findings.length} exactresource-name/role-ID falsepositives;no scannerconfig/baseline suppression.`,
    )
    return output
  } finally {
    try {
      unlinkSync(report)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    rmdirSync(scratch)
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 2, 'NO_SECRET_SCAN_FLAGS_ALLOWED')
  await scanSource()
}
