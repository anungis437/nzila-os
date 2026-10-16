import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { evidence, files, hash, read, root } from './g3r2i-preservation.mjs'
import { check as checkParent } from './g3r3b-builder-closure.mjs'

const preservation = path.join(evidence, 'G3R3C_PRESERVATION.json')
const ledgerFile = path.join(evidence, 'G3R3C_READ_LEDGER.json')
export const documents = [
  [
    'abac',
    'https://learn.microsoft.com/en-us/azure/container-registry/container-registry-rbac-abac-repository-permissions',
  ],
  ['systemd-run', 'https://www.freedesktop.org/software/systemd/man/latest/systemd-run.html'],
  ['systemd-exec', 'https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html'],
  [
    'systemd-resource-control',
    'https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html',
  ],
  ['systemd-timer', 'https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html'],
  [
    'systemd-service',
    'https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html',
  ],
  ['rootless-docker', 'https://docs.docker.com/engine/security/rootless/'],
]
export function preserve() {
  checkParent()
  if (!existsSync(preservation)) {
    writeFileSync(
      preservation,
      `${JSON.stringify(
        {
          ROOT_1_REOPENED: 'NO',
          BUILDER_B_REOPENED: 'NO',
          evidence: files(evidence).filter((entry) => !entry.path.startsWith('G3R3C')),
          tools: readdirSync(root)
            .filter((name) => /^g3.*\.mjs$/.test(name) && !name.startsWith('g3r3c-'))
            .map((name) => ({ name, sha256: hash(readFileSync(path.join(root, name))) })),
        },
        null,
        2,
      )}\n`,
      { flag: 'wx' },
    )
  }
  return verify()
}
export function verify() {
  checkParent()
  const baseline = read(preservation)
  for (const entry of baseline.evidence)
    assert.equal(
      hash(readFileSync(path.join(evidence, entry.path))),
      entry.sha256,
      `FROZEN_EVIDENCE_CHANGED:${entry.path}`,
    )
  for (const entry of baseline.tools)
    assert.equal(
      hash(readFileSync(path.join(root, entry.name))),
      entry.sha256,
      `FROZEN_TOOL_CHANGED:${entry.name}`,
    )
  return baseline
}
export async function collect(resume = false) {
  preserve()
  assert(resume || !existsSync(ledgerFile), 'NO_READ_LEDGER_OVERWRITE')
  const ledger = existsSync(ledgerFile) ? read(ledgerFile) : []
  const persist = () => writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`)
  for (const [name, url] of documents) {
    if (resume && ledger.some((entry) => entry.name === name && entry.status === 'SUCCEEDED'))
      continue
    const entry = {
      name,
      url,
      method: 'GET',
      mutation: false,
      status: 'STARTED',
      responseFile: `G3R3C_PUBLIC_${ledger.length + 1}_${name}.html`,
      startedAtUtc: new Date().toISOString(),
    }
    ledger.push(entry)
    persist()
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(60000) })
      const text = await response.text()
      writeFileSync(path.join(evidence, entry.responseFile), text, { flag: 'wx' })
      Object.assign(entry, {
        httpStatus: response.status,
        finalUrl: response.url,
        responseSha256: hash(text),
        status: response.ok ? 'SUCCEEDED' : 'FAILED',
        completedAtUtc: new Date().toISOString(),
      })
      persist()
      assert(response.ok, `CONTRACT_READ_FAILED:${name}:${response.status};failed body retained`)
    } catch (error) {
      if (entry.status === 'STARTED') {
        Object.assign(entry, {
          status: 'FAILED',
          error: error.message,
          completedAtUtc: new Date().toISOString(),
        })
        persist()
      }
      throw error
    }
  }
  checkReads()
  console.log(`G3R3C public contract GETs:${ledger.length};no Azure or guest calls`)
}
export function checkReads() {
  verify()
  for (const entry of read(ledgerFile)) {
    assert(documents.some(([name, url]) => entry.name === name && entry.url === url))
    assert.equal(entry.method, 'GET')
    assert.equal(entry.mutation, false)
    assert(['SUCCEEDED', 'FAILED'].includes(entry.status))
    if (entry.responseSha256)
      assert.equal(
        hash(readFileSync(path.join(evidence, entry.responseFile))),
        entry.responseSha256,
      )
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert(
    process.argv.length === 3 &&
      ['--capture', '--collect', '--resume', '--check'].includes(process.argv[2]),
    'PUBLIC_READ_ONLY_FLAGS',
  )
  if (process.argv[2] === '--capture') preserve()
  else if (process.argv[2] === '--check') checkReads()
  else await collect(process.argv[2] === '--resume')
}
