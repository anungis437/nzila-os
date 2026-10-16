import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { evidence, files, hash, read, root, source } from './g3r2i-preservation.mjs'

export function scan() {
  const repo = path.resolve(root, '..', '..')
  const config = path.join(repo, '.gitleaks.toml')
  const scratch = mkdtempSync(path.join(os.tmpdir(), 'nzila-g3r2i-scan-'))
  const names = read(path.join(evidence, 'G3_EXECUTION_READINESS.json')).candidateNames
  const exactPublicLines = new Set([
    `"keyVault": "${names.keyVault}",`,
    `"keyVaultEndpoint": "${names.keyVaultEndpoint}",`,
    '"role": "Key Vault Secrets User:4633458b-17de-408a-b874-0445c86b69e6",',
  ])
  try {
    const report = path.join(scratch, 'source.json')
    const result = spawnSync(
      'gitleaks',
      [
        'dir',
        source,
        '--config',
        config,
        '--redact',
        '--no-banner',
        '--report-format',
        'json',
        '--report-path',
        report,
      ],
      { cwd: repo, encoding: 'utf8' },
    )
    assert([0, 1].includes(result.status), `SCANNER_TOOL_FAILURE:${result.stderr}`)
    const findings = read(report)
    const adjudications = findings.map((finding) => {
      const file = path.resolve(repo, finding.File)
      assert(file.startsWith(`${source}${path.sep}`), 'SCANNER_PATH_OUTSIDE_SOURCE')
      const line = readFileSync(file, 'utf8').split(/\r?\n/)[finding.StartLine - 1].trim()
      assert(
        finding.RuleID === 'generic-api-key' &&
          finding.StartLine === finding.EndLine &&
          exactPublicLines.has(line),
        `UNRESOLVED_SECRET_FINDING:${finding.RuleID}:${finding.File}:${finding.StartLine}`,
      )
      return {
        file: finding.File,
        rule: finding.RuleID,
        line: finding.StartLine,
        fileSha256: hash(readFileSync(file)),
        classification: 'EXACT_PUBLIC_RESOURCE_NAME_OR_BUILTIN_ROLE_ID_NOT_SECRET',
      }
    })
    const tooling = files(root).filter(
      (entry) => !entry.path.includes('/') && /^g3r2i.*\.mjs$/.test(entry.path),
    )
    const toolingFindings = []
    for (const [index, entry] of tooling.entries()) {
      const toolReport = path.join(scratch, `tool-${index}.json`)
      const toolResult = spawnSync(
        'gitleaks',
        [
          'stdin',
          '--config',
          config,
          '--redact',
          '--no-banner',
          '--report-format',
          'json',
          '--report-path',
          toolReport,
        ],
        { cwd: repo, encoding: 'utf8', input: readFileSync(path.join(root, entry.path), 'utf8') },
      )
      assert(
        [0, 1].includes(toolResult.status),
        `NEW_TOOLING_SCANNER_FAILURE:${entry.path}:${toolResult.stderr}`,
      )
      for (const finding of read(toolReport)) {
        const line = readFileSync(path.join(root, entry.path), 'utf8')
          .split(/\r?\n/)
          [finding.StartLine - 1].trim()
        assert(
          finding.RuleID === 'generic-api-key' &&
            finding.StartLine === finding.EndLine &&
            line.startsWith("'") &&
            line.endsWith("',") &&
            exactPublicLines.has(line.slice(1, -2)),
          `UNRESOLVED_TOOLING_SECRET_FINDING:${entry.path}:${finding.StartLine}`,
        )
        toolingFindings.push({
          file: entry.path,
          rule: finding.RuleID,
          line: finding.StartLine,
          fileSha256: entry.sha256,
          rawScannerExit: toolResult.status,
          classification: 'EXACT_PUBLIC_BUILTIN_ROLE_ID_IN_ADJUDICATION_CODE_NOT_SECRET',
        })
      }
    }
    return {
      status:
        'PASS_ZERO_UNRESOLVED_FINDINGS;EXACT_NONSECRET_ADJUDICATION_NOT_RAW_SOURCE_SCANNER_PASS',
      command:
        'gitleaks dir g3-source --config .gitleaks.toml --redact --no-banner --report-format json; gitleaks stdin for each new g3r2i*.mjs',
      rawSourceScannerExit: result.status,
      rawSourceFindings: findings.length,
      exactFalsePositiveAdjudications: adjudications,
      toolingFalsePositiveAdjudications: toolingFindings,
      UNRESOLVED_SECRET_FINDINGS: 0,
      sourceScanFiles: files(source).filter((entry) => !entry.path.startsWith('build/')),
      toolingScanFiles: tooling,
      scannerConfigSha256: hash(readFileSync(config)),
      scannerConfigurationChanged: false,
      generatedSuppressionOrAllowlist: false,
      redacted: true,
    }
  } finally {
    rmSync(scratch, { recursive: true })
  }
}
