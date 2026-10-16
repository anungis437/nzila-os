import assert from 'node:assert/strict'
import ts from 'typescript'
import { parseDocument } from 'yaml'

const unique = (values) => [...new Set(values)].sort()
const sensitive = /(?:password|credential|token|secret|private.?key|api.?key)/i

export function environmentNames(text) {
  return unique([
    ...[...text.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)].map((m) => m[1]),
    ...[...text.matchAll(/\$\{?([A-Z][A-Z0-9_]*)(?:[}:]|\b)/g)].map((m) => m[1]),
    ...[...text.matchAll(/(?:name:\s*|^\s*-\s*)([A-Z][A-Z0-9_]+)(?:\s*$|=)/gm)].map((m) => m[1]),
  ])
}

function references(value) {
  const text = typeof value === 'string' ? value : ''
  return unique([
    ...[...text.matchAll(/(?:secrets|vars|needs\.plan\.outputs)\.([A-Za-z0-9_]+)/g)].map(
      (m) => m[0],
    ),
    ...[...text.matchAll(/(?:secretref:|\/secrets\/)([a-z][a-z0-9-]*)/gi)].map((m) => m[1]),
  ])
}

function environmentKeys(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item).split('=')[0])
    : Object.keys(value ?? {})
}

function safeCommand(value) {
  if (Array.isArray(value)) value = value.join(' ')
  if (typeof value !== 'string') return null
  if (sensitive.test(value) || /[a-z]+:\/\/|(?:^|\s)[A-Z_]+=/.test(value))
    return 'COMMAND_VALUES_WITHHELD'
  return value.trim()
}

function sqlProducers(text) {
  let index = 0
  let executable = ''
  while (index < text.length) {
    const rest = text.slice(index)
    let end = null
    if (rest.startsWith('--')) {
      const newline = text.indexOf('\n', index)
      end = newline < 0 ? text.length : newline
    } else if (rest.startsWith('/*')) {
      let depth = 1
      let cursor = index + 2
      while (cursor < text.length && depth) {
        if (text.startsWith('/*', cursor)) {
          depth++
          cursor += 2
        } else if (text.startsWith('*/', cursor)) {
          depth--
          cursor += 2
        } else cursor++
      }
      assert.equal(depth, 0, 'Unterminated SQL comment')
      end = cursor
    } else if (rest.startsWith("'")) {
      let cursor = index + 1
      while (cursor < text.length) {
        if (text[cursor] === "'" && text[cursor + 1] === "'") cursor += 2
        else if (text[cursor] === "'") {
          end = cursor + 1
          break
        } else cursor++
      }
      assert.ok(end !== null, 'Unterminated SQL string')
    } else {
      const dollar = /^\$(?:[A-Za-z_]\w*)?\$/.exec(rest)?.[0]
      if (dollar) {
        const close = text.indexOf(dollar, index + dollar.length)
        assert.ok(close >= 0, 'Unterminated SQL body')
        end = close + dollar.length
      }
    }
    if (end !== null) {
      executable += text.slice(index, end).replace(/[^\n]/g, ' ')
      index = end
    } else executable += text[index++]
  }
  return [
    ...executable.matchAll(
      /\bCREATE\s+(?:OR\s+REPLACE\s+)?(ROLE|EXTENSION|TYPE|FUNCTION|SCHEMA|TABLE)\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:"[^"]+"|[\w-]+)(?:\.(?:"[^"]+"|[\w-]+))?)/gi,
    ),
  ].map((match) => ({
    KIND: match[1].toUpperCase(),
    NAME: match[2].replaceAll('"', ''),
    LINE: executable.slice(0, match.index).split('\n').length,
    EXECUTION_AND_PRECONSUMER_AUTHORITY: 'NOT_INFERRED_FROM_SQL_DECLARATION',
  }))
}

export function parseOperationalSource(file, text) {
  const result = {
    FILE: file,
    ENVIRONMENT_VARIABLE_NAMES: environmentNames(text),
    SECRET_REFERENCE_NAMES: references(text),
    IMPORTS: [],
    SQL_PRODUCER_SYMBOLS: [],
    STATIC_ARRAYS: {},
    SERVICES: [],
    JOBS: [],
    SOURCE_EXECUTED: false,
    CREDENTIAL_VALUES_SERIALIZED: false,
  }
  if (/\.env\.(example|template)$/.test(file)) {
    result.ENVIRONMENT_VARIABLE_NAMES = unique(
      [...text.matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*=/gm)].map((m) => m[1]),
    )
    result.SECRET_REFERENCE_NAMES = []
    return result
  }
  if (file.endsWith('package.json')) {
    const json = JSON.parse(text)
    result.PACKAGE_NAME = json.name
    result.SCRIPTS = Object.fromEntries(
      Object.entries(json.scripts ?? {})
        .filter(([key]) =>
          /^(dev|start|build|db:|rls:(?:provision|apply|p4)|icra:capability|schema:contract:fresh)/.test(
            key,
          ),
        )
        .map(([key, command]) => [key, safeCommand(command)]),
    )
    return result
  }
  if (file.endsWith('.sql')) result.SQL_PRODUCER_SYMBOLS = sqlProducers(text)
  if (/\.(ts|mjs|js)$/.test(file)) {
    const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
    assert.equal(tree.parseDiagnostics.length, 0, `Operational syntax invalid: ${file}`)
    function visit(node) {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier))
        result.IMPORTS.push(node.moduleSpecifier.text)
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        ['REQUIRED_EXTENSIONS', 'migrations'].includes(node.name.text) &&
        node.initializer &&
        ts.isArrayLiteralExpression(node.initializer)
      ) {
        if (node.initializer.elements.every(ts.isStringLiteral))
          result.STATIC_ARRAYS[node.name.text] = node.initializer.elements.map((item) => item.text)
      }
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        for (const match of node.text.matchAll(
          /\bCREATE\s+(?:OR\s+REPLACE\s+)?(ROLE|EXTENSION|TYPE|FUNCTION|SCHEMA|TABLE)\s+(?:IF\s+NOT\s+EXISTS\s+)?("?[\w.-]+"?)/gi,
        ))
          result.SQL_PRODUCER_SYMBOLS.push({
            KIND: match[1].toUpperCase(),
            NAME: match[2].replaceAll('"', ''),
            LINE: tree.getLineAndCharacterOfPosition(node.getStart()).line + 1,
            EXECUTION_AND_PRECONSUMER_AUTHORITY: 'NOT_INFERRED_FROM_LITERAL',
          })
      }
      ts.forEachChild(node, visit)
    }
    visit(tree)
    result.IMPORTS = unique(result.IMPORTS)
  }
  if (/\.ya?ml$/.test(file)) {
    const doc = parseDocument(text)
    assert.equal(doc.errors.length, 0, `Operational YAML invalid: ${file}`)
    function plain(value) {
      if (value instanceof Map) {
        if ([...value.keys()].some((key) => typeof key !== 'string')) {
          result.YAML_NON_STRING_KEY_SOURCE_CEILING = true
          return {}
        }
        return Object.fromEntries([...value].map(([key, entry]) => [key, plain(entry)]))
      }
      return Array.isArray(value) ? value.map(plain) : value
    }
    const yaml = plain(doc.toJS({ mapAsMap: true }))
    for (const [name, service] of Object.entries(yaml?.services ?? {})) {
      result.SERVICES.push({
        NAME: name,
        IMAGE_REFERENCE:
          sensitive.test(service.image ?? '') || /:\/\//.test(service.image ?? '')
            ? null
            : (service.image ?? null),
        BUILD_CONTEXT:
          typeof service.build === 'string' ? service.build : (service.build?.context ?? null),
        BUILD_TARGET: service.build?.target ?? null,
        START_COMMAND: safeCommand(service.command),
        ENVIRONMENT_KEYS: environmentKeys(service.environment),
        DEPENDS_ON: Array.isArray(service.depends_on)
          ? service.depends_on
          : Object.keys(service.depends_on ?? {}),
        ENV_FILE_DECLARED: Boolean(service.env_file),
      })
    }
    for (const [name, job] of Object.entries(yaml?.jobs ?? {})) {
      const runs = (job.steps ?? []).map((step) => step.run ?? '').join('\n')
      result.JOBS.push({
        NAME: name,
        JOB_CONDITION: typeof job.if === 'string' || typeof job.if === 'boolean' ? job.if : null,
        DISABLED_LITERAL_FALSE: job.if === false || /^\$\{\{\s*false\s*\}\}$/.test(job.if ?? ''),
        NEEDS: typeof job.needs === 'string' ? [job.needs] : (job.needs ?? []),
        ENVIRONMENT_REFERENCE:
          typeof job.environment === 'string' ? job.environment : (job.environment?.name ?? null),
        ENVIRONMENT_KEYS: Object.keys(job.env ?? {}),
        ENVIRONMENT_VARIABLE_NAMES: environmentNames(runs),
        SECRET_REFERENCE_NAMES: references(runs),
        DJANGO_MIGRATE: /manage\.py migrate|["']manage\.py["'],\s*["']migrate["']/.test(runs),
        SCOPED_ROLLOUT: /icra:capability-rollout|db:scoped-migrate|db:bootstrap/.test(runs),
        SECURITY_MIGRATION_COMMAND: /rls:apply-/.test(runs),
      })
    }
  }
  if (file.endsWith('requirements.txt')) {
    result.PACKAGE_REQUIREMENTS = text.split(/\r?\n/).flatMap((line, index) => {
      const match = /^([A-Za-z][A-Za-z0-9_-]*)(?:\[[^\]]+\])?\s*([<>=!~].*?)?\s*(?:#.*)?$/.exec(
        line.trim(),
      )
      return match
        ? [
            {
              PACKAGE: match[1],
              VERSION_CONSTRAINT: match[2]?.trim() ?? null,
              EXACT_VERSION_PINNED: /^==[^,<>*!]+$/.test(match[2]?.trim() ?? ''),
              LINE: index + 1,
            },
          ]
        : []
    })
  }
  return result
}

export function selfTest() {
  const secret = 'test-only-do-not-serialize'
  const template = parseOperationalSource(
    'test/.env.example',
    `PGHOST=localhost\nPGPASSWORD=${secret}`,
  )
  assert.deepEqual(template.ENVIRONMENT_VARIABLE_NAMES, ['PGHOST', 'PGPASSWORD'])
  assert.ok(!JSON.stringify(template).includes(secret))
  const source = parseOperationalSource(
    'test.ts',
    `throw new Error("must not execute");
    const hidden = "${secret}";
    const REQUIRED_EXTENSIONS = ['pgcrypto', 'vector'];
    const conn = process.env.DATABASE_URL;
    import { x } from './runner';
    const sql = 'CREATE TYPE public.mode AS ENUM (\\'a\\')';`,
  )
  assert.deepEqual(source.STATIC_ARRAYS.REQUIRED_EXTENSIONS, ['pgcrypto', 'vector'])
  assert.deepEqual(source.IMPORTS, ['./runner'])
  assert.equal(source.SQL_PRODUCER_SYMBOLS[0].NAME, 'public.mode')
  assert.ok(!JSON.stringify(source).includes(secret))
  const yaml = parseOperationalSource(
    'test.yml',
    `services:
  django:
    command: python manage.py runserver
    environment:
      PGPASSWORD: ${secret}
      PGHOST: db
`,
  )
  assert.ok(!JSON.stringify(yaml).includes(secret))
  assert.deepEqual(yaml.SERVICES[0].ENVIRONMENT_KEYS, ['PGPASSWORD', 'PGHOST'])
  assert.throws(() => parseOperationalSource('bad.yml', 'services: ['))
  assert.throws(() => parseOperationalSource('bad.ts', 'const ='))
  const sql = parseOperationalSource(
    'test.sql',
    `/* CREATE TYPE not_real; */
    DO $$ BEGIN CREATE TYPE dynamic_not_promoted; END $$;
    SELECT 'CREATE TABLE string_not_real';
    CREATE TYPE public.actual_type AS ENUM ('a');`,
  )
  assert.deepEqual(
    sql.SQL_PRODUCER_SYMBOLS.map((row) => row.NAME),
    ['public.actual_type'],
  )
  console.log(
    'PASS: syntax-only operational parsing, malformed input fails, secret values withheld.',
  )
}

if (process.argv[1]?.endsWith('read-operational-bootstrap-sources.mjs')) {
  assert.deepEqual(process.argv.slice(2), ['--self-test'])
  selfTest()
}
