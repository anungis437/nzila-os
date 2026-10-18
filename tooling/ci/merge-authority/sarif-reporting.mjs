import { appendFileSync } from 'node:fs'

/**
 * Evidence-only SARIF reporting classification.
 *
 * This module does not decide Merge Authority / IaC Security.
 * Checkov remains the only IaC authority feeder.
 *
 * NOT_CONFIGURED means the code-scanning destination is unavailable.
 * CONFIGURED means the destination answered and publication is a separate activation.
 *   It is evidence-only like NOT_CONFIGURED: enabling code scanning must not fail CI.
 * FAILURE means the probe itself did not produce either of those states.
 */

const NOT_CONFIGURED_MARKERS = [
  'Code scanning is not enabled',
  'GitHub Code Security or GitHub Advanced Security must be enabled',
  'GitHub Code Security or GitHub Advanced Security is not enabled',
  'GitHub Code Security or GitHub Advanced Security not enabled',
  'Advanced Security must be enabled for this repository to use code scanning',
]

export function classifySarifProbe(statusCode, body) {
  const text = typeof body === 'string' ? body : ''
  if (NOT_CONFIGURED_MARKERS.some((marker) => text.includes(marker))) {
    return 'NOT_CONFIGURED'
  }
  if (Number(statusCode) === 200) return 'CONFIGURED'
  return 'FAILURE'
}

function reportingState(classification) {
  if (classification === 'NOT_CONFIGURED') return 'NOT_CONFIGURED'
  if (classification === 'CONFIGURED') return 'CONFIGURED'
  return 'FAILURE'
}

function detailFor(classification, statusCode) {
  if (classification === 'NOT_CONFIGURED') {
    return 'GitHub code scanning is not enabled. SARIF was not uploaded. Checkov authority is unchanged.'
  }
  if (classification === 'CONFIGURED') {
    return 'Code scanning is enabled, but SARIF publication is not activated in this job. It remains evidence-only and does not affect Checkov authority.'
  }
  return `SARIF capability probe returned HTTP ${statusCode}. Reporting did not succeed. Checkov authority is unchanged.`
}

function writeSummary(state, detail) {
  const path = process.env.GITHUB_STEP_SUMMARY
  if (!path) return
  const text = [
    '## IaC SARIF Reporting',
    '',
    `SARIF_REPORTING = ${state}`,
    '',
    detail,
    '',
    'Merge Authority / IaC Security is determined only by the Checkov result of IaC Security Validation.',
    'VALIDATION PASSED does not mean REPORTING SUCCEEDED.',
    '',
  ].join('\n')
  appendFileSync(path, text)
}

export async function classifyFromGitHub(fetchImpl = globalThis.fetch) {
  const repository = process.env.GITHUB_REPOSITORY
  const token = process.env.GITHUB_TOKEN
  if (!repository || !token) {
    return {
      classification: 'FAILURE',
      state: 'FAILURE',
      statusCode: 0,
      detail: 'GITHUB_REPOSITORY and GITHUB_TOKEN are required to classify SARIF reporting.',
    }
  }
  const response = await fetchImpl(
    `https://api.github.com/repos/${repository}/code-scanning/alerts?per_page=1`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  )
  const body = await response.text()
  const classification = classifySarifProbe(response.status, body)
  const state = reportingState(classification)
  return {
    classification,
    state,
    statusCode: response.status,
    detail: detailFor(classification, response.status),
  }
}

async function main() {
  const result = await classifyFromGitHub()
  const output = process.env.GITHUB_OUTPUT
  if (output) {
    appendFileSync(output, `state=${result.state}\nclassification=${result.classification}\n`)
  }
  writeSummary(result.state, result.detail)
  process.stdout.write(`SARIF_REPORTING=${result.state}\n${result.detail}\n`)
  if (result.state === 'NOT_CONFIGURED' || result.state === 'CONFIGURED') {
    process.stdout.write(
      `::warning title=SARIF_REPORTING::${result.state} — ${result.detail}\n`,
    )
    process.exit(0)
  }
  process.stdout.write(`::error title=SARIF_REPORTING::${result.state} — ${result.detail}\n`)
  process.exit(1)
}

if (process.argv[1] && process.argv[1].endsWith('sarif-reporting.mjs')) {
  await main()
}
