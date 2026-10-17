import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

export interface EnvironmentReference {
  file: string
  sourceDigest: string
  line: number
  key: string | null
}

const connectionSetting =
  /(?:URL|URI|HOST|ENDPOINT|DSN|CONNECTION_STRING|API_KEY|SECRET_KEY|ACCESS_KEY|CLIENT_SECRET|REST_TOKEN|IDENTITY_HEADER|EXTRA_CA_CERTS)$/

export function environmentReferences(text: string, file: string): EnvironmentReference[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const digest = createHash('sha256').update(text).digest('hex')
  const references: EnvironmentReference[] = []
  const environment = (node: ts.Node) =>
    ts.isPropertyAccessExpression(node) &&
    node.name.text === 'env' &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'process'
  const add = (node: ts.Node, key: string | null) => {
    if (key && !connectionSetting.test(key)) return
    references.push({
      file,
      sourceDigest: digest,
      line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      key,
    })
  }
  const visit = (node: ts.Node) => {
    if (ts.isPropertyAccessExpression(node) && environment(node.expression))
      add(node, node.name.text)
    else if (ts.isElementAccessExpression(node) && environment(node.expression))
      add(
        node,
        ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression.text : null,
      )
    else if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      environment(node.initializer) &&
      ts.isObjectBindingPattern(node.name)
    ) {
      for (const binding of node.name.elements) {
        const property = binding.propertyName ?? binding.name
        add(
          binding,
          ts.isIdentifier(property) || ts.isStringLiteralLike(property) ? property.text : null,
        )
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return references
}

/** Source evidence only: unresolved dynamic lookups remain explicit and block a complete census. */
export function collectConnectionEnvironmentSurface(directory: string) {
  const references: EnvironmentReference[] = []
  const excluded = new Set([
    'node_modules',
    '.git',
    '.next',
    '.turbo',
    '.venv',
    '__pycache__',
    'tests',
    '__tests__',
    'bootstrap-v2',
  ])
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      if (excluded.has(entry.name) || entry.isSymbolicLink()) continue
      const absolute = path.join(current, entry.name)
      if (entry.isDirectory()) walk(absolute)
      else if (
        /\.(?:[cm]?tsx?|[cm]?jsx?)$/.test(entry.name) &&
        !/\.(?:test|spec|d)\.[cm]?[jt]sx?$/.test(entry.name)
      )
        references.push(
          ...environmentReferences(
            readFileSync(absolute, 'utf8'),
            path.relative(directory, absolute),
          ),
        )
    }
  }
  walk(directory)
  return {
    sourceScope:
      'Current TypeScript/JavaScript application and copied workspace-package source; dynamic selectors are not inferred',
    references,
    dynamicSelectors: references.filter((entry) => entry.key === null),
    keys: [...new Set(references.flatMap((entry) => (entry.key ? [entry.key] : [])))].sort(),
    sourceDigest: createHash('sha256').update(JSON.stringify(references)).digest('hex'),
  }
}

export function classifyConnectionEnvironment(
  surface: ReturnType<typeof collectConnectionEnvironmentSurface>,
  env: NodeJS.ProcessEnv,
) {
  const ports = new Set(env.UE_V2_LOCAL_PORTS?.split(',') ?? [])
  return surface.keys.map((key) => {
    const references = surface.references.filter((entry) => entry.key === key)
    const value = env[key]
    if (!value) return { key, classification: 'ABSENT', references }
    if (key === 'NODE_EXTRA_CA_CERTS') {
      assert.equal(value, path.join(env.HOME!, 'owned-vault-public-ca.pem'))
      return { key, classification: 'OWNED_PUBLIC_CA_CERTIFICATE', references }
    }
    if (key === 'IDENTITY_HEADER') {
      const identity = new URL(env.IDENTITY_ENDPOINT!)
      assert.equal(identity.hostname, '127.0.0.1')
      assert.ok(ports.has(identity.port))
      return { key, classification: 'OWNED_SYNTHETIC_AUTHENTICATION_SECRET', references }
    }
    const url = new URL(value)
    const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    const ownedVault =
      key === 'AZURE_KEY_VAULT_URL' &&
      env.UE_V2_LOCAL_VAULT_ALIAS === '1' &&
      url.hostname === 'vault.ue-v2.localhost' &&
      url.protocol === 'https:'
    assert.ok(
      (loopback || ownedVault) && ports.has(url.port),
      `Unowned connection-bearing setting: ${key}`,
    )
    return { key, classification: 'OWNED_LOOPBACK_FIXTURE', references }
  })
}
