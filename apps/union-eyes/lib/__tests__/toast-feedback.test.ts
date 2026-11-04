/**
 * Feedback a user can see (UE-CONV-H-022).
 *
 * A screen that says "Saved" or "Could not save" through a toast depends on something drawing that toast. Two toast libraries are in use: the radix toast behind
 * `@/components/ui/use-toast`, drawn by `<Toaster />` from `@/components/ui/toaster`, and `sonner`, drawn by `<Toaster />` from `sonner` (wrapped in
 * `@/components/ui/sonner`). The root layout mounted only the first, so every `toast` from `sonner` (success and failure alike, in a dozen screens) was invisible, and a
 * third hook, `lib/hooks/use-toast.ts`, held its toasts in component state and drew nothing at all, so the eleven components that used it reported nothing to anyone. No unit
 * test noticed: each one asserts that `toast` was called, and it was. This holds the pairing: each source the application imports has its renderer mounted in app/layout.tsx,
 * and a source nothing draws cannot be introduced.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '..', '..')
const SKIP_DIRS = new Set(['node_modules', '.next', '.turbo', 'dist', 'coverage', 'archive', 'backups', 'mobile', 'backend', 'e2e', 'tests', 'public', 'docs', 'scripts', '__tests__', '__mocks__', 'nzila-scripts-book-template', '.git'])

function productionFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(name)) productionFiles(full, out)
    } else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec|stories|d)\.tsx?$/.test(name)) out.push(full)
  }
  return out
}

/** Every module specifier a production file imports whose last segment is `use-toast`, or which is the `sonner` package. */
function toastSources(): Map<string, string[]> {
  const sources = new Map<string, string[]>()
  for (const file of productionFiles(ROOT)) {
    const text = readFileSync(file, 'utf8')
    for (const found of text.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const specifier = found[1]
      if (specifier === 'sonner' || /(^|\/)use-toast$/.test(specifier)) sources.set(specifier, [...(sources.get(specifier) ?? []), path.relative(ROOT, file).replace(/\\/g, '/')])
    }
  }
  return sources
}

/** What the root layout draws: the toast source each mounted renderer serves. Comments are not read: a renderer named in a comment draws nothing. */
function mountedRenderers(): Set<string> {
  const layout = readFileSync(path.join(ROOT, 'app', 'layout.tsx'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  const mounted = new Set<string>()
  const rendered = (component: string) => new RegExp(`<${component}\\b`).test(layout)
  const imported = (component: string, from: string) => new RegExp(`import\\s*\\{[^}]*\\b${component}\\b[^}]*\\}\\s*from\\s*['"]${from.replace(/[/.]/g, '\\$&')}['"]`).test(layout)
  // The radix toaster draws what `useToast` from components/ui/use-toast holds (components/ui/toaster.tsx reads it).
  if (imported('Toaster', '@/components/ui/toaster') && rendered('Toaster')) mounted.add('@/components/ui/use-toast')
  if (imported('Toaster as SonnerToaster', '@/components/ui/sonner') && rendered('SonnerToaster')) mounted.add('sonner')
  return mounted
}

describe('the feedback a screen gives', () => {
  it('is drawn: every toast source the application imports has its renderer mounted in the root layout', () => {
    const mounted = mountedRenderers()
    const undrawn = [...toastSources()].filter(([source]) => !mounted.has(source)).map(([source, files]) => `${source}: ${files.slice(0, 5).join(', ')}`)
    expect(undrawn).toEqual([])
  })

  it('has no toast hook that keeps its toasts to itself: the only hook is the canonical one', () => {
    for (const hook of [...toastSources().keys()].filter((source) => /use-toast$/.test(source))) expect(['@/components/ui/use-toast'], hook).toContain(hook)
  })

  it('reads both renderers from the layout, so a source cannot be paired with a renderer that is not there', () => {
    expect([...mountedRenderers()].sort()).toEqual(['@/components/ui/use-toast', 'sonner'])
  })
})
