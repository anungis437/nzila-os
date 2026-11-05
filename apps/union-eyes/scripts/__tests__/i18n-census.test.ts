/**
 * The i18n census (UE-CONV-H-024).
 *
 * Three parts. The first pins how a translator is found and which keys a file asks for (lib/i18n-census/usage.ts): by scope, so two components in one file that call
 * their translator `t` for different namespaces are told apart, and a translator that is only a parameter is not judged. The second pins what the runtime does with a
 * message (lib/i18n-census/catalog.ts): which values it needs, and which messages it cannot parse. The third runs the census over the real tree and holds each kind of
 * finding at or below a ceiling that can only fall: a message that is not in the catalog renders as its own key, one that does not parse throws, and no other test sees it.
 */
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { flattenMessages, parseMessage } from '../lib/i18n-census/catalog'
import { findTranslationUses } from '../lib/i18n-census/usage'
import { countByKind, runCensus, type I18nKind } from '../runtime/i18n-census'

const keysOf = (source: string, file = 'components/x.tsx') => findTranslationUses(file, source).uses.map((use) => `${use.namespace}|${use.key ?? (use.prefix !== null ? `${use.prefix}*` : '?')}|${use.call}`)

describe('which keys a file asks for', () => {
  it('binds a translator to its namespace and reads the key through it', () => {
    expect(keysOf(`import { useTranslations } from 'next-intl'\nexport function A() { const t = useTranslations('billing'); return <p>{t('title')}</p> }`)).toEqual(['billing|title|plain'])
  })

  it('reads a server translator, awaited, with a namespace option or a plain namespace, and the root when there is none', () => {
    const source = `
      import { getTranslations } from 'next-intl/server'
      export async function A({ locale }) {
        const a = await getTranslations({ locale, namespace: 'one' })
        const b = await getTranslations('two')
        const c = await getTranslations()
        return [a('x'), b('y'), c('z.w')]
      }`
    expect(keysOf(source, 'app/page.tsx')).toEqual(['one|x|plain', 'two|y|plain', '|z.w|plain'])
  })

  it('tells two translators called `t` apart by scope', () => {
    const source = `
      import { useTranslations } from 'next-intl'
      export function A() { const t = useTranslations('first'); return t('a') }
      export function B() { const t = useTranslations('second'); return <p>{t('b')}</p> }`
    expect(keysOf(source)).toEqual(['first|a|plain', 'second|b|plain'])
  })

  it('does not judge a translator that is only a parameter, nor one that shadows the file\'s', () => {
    const source = `
      import { useTranslations } from 'next-intl'
      const t = useTranslations('outer')
      export const label = (t: (key: string) => string) => t('inner')
      export const other = ({ t }: { t: (key: string) => string }) => t('props')
      export const same = () => t('outer.key')`
    expect(keysOf(source)).toEqual(['outer|outer.key|plain'])
  })

  it('reads rich, raw, markup and has as calls of the same translator, a template key by its literal prefix, and a computed key as computed', () => {
    const source = `
      import { useTranslations } from 'next-intl'
      const t = useTranslations('ns')
      t.rich('a', { b: (c) => c }); t.raw('list'); t.markup('m', {}); t.has('maybe'); t(\`status.\${state}\`); t(key)`
    expect(keysOf(source)).toEqual(['ns|a|rich', 'ns|list|raw', 'ns|m|markup', 'ns|maybe|has', 'ns|status.*|plain', 'ns|?|plain'])
  })

  it('reads the names a call passes values for, and says so when it cannot', () => {
    const source = `
      import { useTranslations } from 'next-intl'
      const t = useTranslations('ns')
      t('a'); t('b', { name, 'count': 2 }); t('c', values); t('d', { ...rest, name })`
    expect(findTranslationUses('x.tsx', source).uses.map((use) => use.provides)).toEqual([[], ['name', 'count'], null, null])
  })

  it('follows an imported alias of the factory, and counts a computed namespace instead of guessing it', () => {
    const source = `
      import { useTranslations as useT } from 'next-intl'
      const a = useT('aliased')
      const b = useT(namespace)
      a('x'); b('y')`
    const found = findTranslationUses('x.tsx', source)
    expect(found.uses.map((use) => `${use.namespace}|${use.key}`)).toEqual(['aliased|x'])
    expect(found.unresolved).toBe(1)
  })

  it('reads nothing from a file that does not use the library', () => {
    expect(keysOf(`const t = (key: string) => key; t('x')`)).toEqual([])
  })
})

describe('what the runtime does with a message', () => {
  it('serves a message with no brace and no angle bracket as written, needing nothing', () => {
    expect(parseMessage('Save changes')).toEqual({ ok: true, signature: { required: [] } })
    expect(parseMessage("Don't save")).toEqual({ ok: true, signature: { required: [] } })
  })

  it('needs a value for each argument, plural, select and rich-text tag', () => {
    expect(parseMessage('Hello {name}, you have {count, plural, one {# item} other {# items}}')).toEqual({ ok: true, signature: { required: ['count', 'name'] } })
    expect(parseMessage('<b>Bold</b> and {who, select, a {A} other {B}}')).toEqual({ ok: true, signature: { required: ['<b>', 'who'] } })
  })

  it('cannot parse an unbalanced brace, a template placeholder or an unclosed tag, which is what throws when a person opens the screen', () => {
    for (const message of ['Hello {name', 'Use {{name}} here', '<b>never closed']) expect(parseMessage(message).ok, message).toBe(false)
  })

  it('quotes a brace the way ICU says, and a raw HTML sample is a message that needs a value for each of its tags unless its angle brackets are quoted', () => {
    expect(parseMessage("Use '{{'name'}}' here")).toEqual({ ok: true, signature: { required: [] } })
    expect(parseMessage('<html><body>sample</body></html>')).toEqual({ ok: true, signature: { required: ['<body>', '<html>'] } })
    expect(parseMessage("'<'html'>' sample")).toEqual({ ok: true, signature: { required: [] } })
  })

  it('swallows an argument that follows an apostrophe into the text: it does not throw, it prints the braces, and the message needs nothing', () => {
    expect(parseMessage("l'{name} a écrit")).toEqual({ ok: true, signature: { required: [] } })
    expect(parseMessage("l''{name} a écrit")).toEqual({ ok: true, signature: { required: ['name'] } })
  })

  it('refuses a list of messages and a group', () => {
    expect(parseMessage(['a', 'b']).ok).toBe(false)
    expect(parseMessage({ a: 1 }).ok).toBe(false)
  })

  it('lists every message of a catalog by its dotted path', () => {
    expect([...flattenMessages({ a: { b: 'x', c: { d: 'y' } }, e: ['l'] })]).toEqual([['a.b', 'x'], ['a.c.d', 'y'], ['e', ['l']]])
  })
})

describe('the census over a small tree', () => {
  const tree = (files: Record<string, string>, catalogs: Record<string, Record<string, unknown>>): string => {
    const root = mkdtempSync(path.join(tmpdir(), 'i18n-census-'))
    for (const [name, text] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(root, name)), { recursive: true })
      writeFileSync(path.join(root, name), text)
    }
    mkdirSync(path.join(root, 'messages'), { recursive: true })
    for (const catalog of ['en', 'en-CA', 'fr', 'fr-CA', 'it', 'pt']) writeFileSync(path.join(root, 'messages', `${catalog}.json`), JSON.stringify(catalogs[catalog] ?? {}))
    return root
  }
  const kinds = async (root: string) => (await runCensus(root)).findings.map((finding) => `${finding.kind}:${finding.key}`)

  it('finds a key that is missing, one that is only in English, a group asked for as a message, and a call that leaves out a value', async () => {
    const root = tree(
      {
        'components/a.tsx': `
          import { useTranslations } from 'next-intl'
          export function A() {
            const t = useTranslations('page')
            return [t('present'), t('absent'), t('onlyEnglish'), t('group'), t('hello'), t('hello', { name: 'x' }), t('items', { count: 1 })]
          }`,
      },
      {
        'en-CA': { page: { present: 'P', onlyEnglish: 'E', group: { inner: 'i' }, hello: 'Hi {name}', items: '{count, plural, one {# item} other {# items}}' } },
        'fr-CA': { page: { present: 'P', group: { inner: 'i' }, hello: 'Salut {name}', items: '{count, plural, one {# élément} other {# éléments}}' } },
      },
    )
    try {
      expect(await kinds(root)).toEqual([
        'MISSING_ARGUMENT:page.hello',
        'MISSING_ARGUMENT:page.hello',
        'MISSING_IN_FRENCH:page.onlyEnglish',
        'MISSING_KEY:page.absent',
        'NOT_A_MESSAGE:page.group',
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('judges a key against the catalog the application loads: the region catalog over its base language, which is how en.json fills en-CA', async () => {
    const root = tree(
      { 'components/a.tsx': `import { useTranslations } from 'next-intl'\nconst t = useTranslations('page')\nexport const x = [t('fromBase'), t('fromRegion')]` },
      { en: { page: { fromBase: 'B' } }, 'en-CA': { page: { fromRegion: 'R' } }, fr: { page: { fromBase: 'B' } }, 'fr-CA': { page: { fromRegion: 'R' } } },
    )
    try {
      expect(await kinds(root)).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('finds a message that does not parse, and an English and a French message that need different values', async () => {
    const root = tree(
      { 'components/a.tsx': `export const x = 1` },
      { 'en-CA': { a: 'Use {{name}}', b: 'Hello {name}', c: ['list'] }, 'fr-CA': { a: 'Use {{name}}', b: "Salut l'{name}", c: ['liste'] } },
    )
    try {
      expect(await kinds(root)).toEqual(['ARGUMENT_MISMATCH:b', 'INVALID_MESSAGE:a', 'INVALID_MESSAGE:a'])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('reads a list of messages with t.raw, and refuses it with any other call', async () => {
    const root = tree(
      { 'components/a.tsx': `import { useTranslations } from 'next-intl'\nconst t = useTranslations('page')\nexport const x = [t.raw('items'), t('items')]` },
      { 'en-CA': { page: { items: ['a', 'b'] } }, 'fr-CA': { page: { items: ['a', 'b'] } } },
    )
    try {
      expect(await kinds(root)).toEqual(['INVALID_MESSAGE:page.items'])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

// Messages the screens ask for that the catalogs cannot give. Each ceiling can only fall; the end is zero.
const CEILING: Record<I18nKind, number> = { MISSING_KEY: 0, MISSING_IN_FRENCH: 0, NOT_A_MESSAGE: 0, INVALID_MESSAGE: 0, ARGUMENT_MISMATCH: 0, MISSING_ARGUMENT: 0 }

describe('the frontend against its catalogs', () => {
  it('holds every kind of finding at or below its ceiling', async () => {
    const report = await runCensus()
    expect(report.files).toBeGreaterThan(1000)
    expect(report.uses).toBeGreaterThan(3000)
    const counts = countByKind(report.findings)
    const over = (Object.keys(CEILING) as I18nKind[]).filter((kind) => counts[kind] > CEILING[kind]).map((kind) => `${kind}: ${counts[kind]} > ${CEILING[kind]}\n${report.findings.filter((finding) => finding.kind === kind).slice(0, 40).map((finding) => `  ${finding.file ? `${finding.file}:${finding.line}` : 'catalog'}  ${finding.key}  ${finding.detail}`).join('\n')}`)
    expect(over).toEqual([])
  }, 180_000)

  it('keeps the live locales whole: no message the French catalog lacks that the English has, once each is merged over its base language', async () => {
    const report = await runCensus()
    expect(report.findings.filter((finding) => finding.kind === 'MISSING_IN_FRENCH' || finding.kind === 'ARGUMENT_MISMATCH')).toEqual([])
  }, 180_000)
})
