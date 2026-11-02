/**
 * Which physical tables a Django ViewSet can write (UE-CONV-H-007).
 *
 * The database is shared by the Next.js application (Drizzle) and the Django backend. A column the Drizzle declaration requires but the Django model leaves
 * `null=True` may only be made NOT NULL where no Django writer can store a NULL in it: the database must not be stricter than the loosest legitimate writer.
 * A Django ViewSet whose permission_classes names `DenyAllPermission` is contained, and writes nothing; any other ViewSet over a model (a ModelViewSet with
 * IsAuthenticated, or one whose permissions cannot be read from the class body) is treated as a writer. A read-only ViewSet writes nothing.
 *
 * This reads the source of backend/<app>/models.py and views.py. It does not see writes outside a ViewSet (a service, a command, a task), which is why the
 * result decides only where a constraint may NOT yet be applied, never that a table is safe to constrain on its own.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const blocks = (text: string): string[] => text.split(/\n(?=class \w+\()/)

export function djangoLiveTables(appRoot: string = process.cwd()): Set<string> {
  const backend = join(appRoot, 'backend')
  const apps = readdirSync(backend).filter((name) => existsSync(join(backend, name, 'models.py')))
  // A model class name can repeat across apps, and a ViewSet may import a model from another app, so a class name stands for every table that carries it.
  const tablesOf = new Map<string, Set<string>>()
  for (const app of apps) {
    for (const block of blocks(readFileSync(join(backend, app, 'models.py'), 'utf8'))) {
      const model = /^class (\w+)\(/.exec(block)?.[1]
      const table = /db_table\s*=\s*['"]([^'"]+)['"]/.exec(block)?.[1]
      if (!model || !table) continue
      if (!tablesOf.has(model)) tablesOf.set(model, new Set())
      tablesOf.get(model)!.add(table)
    }
  }
  const live = new Set<string>()
  for (const app of apps) {
    const viewsPath = join(backend, app, 'views.py')
    if (!existsSync(viewsPath)) continue
    for (const block of blocks(readFileSync(viewsPath, 'utf8'))) {
      const model = /queryset\s*=\s*(\w+)\.objects/.exec(block)?.[1]
      if (!model) continue
      const bases = /^class \w+\(([^)]*)\)/.exec(block)?.[1] ?? ''
      if (/ReadOnlyModelViewSet/.test(bases)) continue
      const permissions = /permission_classes\s*=\s*\[([^\]]*)\]/.exec(block)?.[1]
      if (permissions !== undefined && /DenyAll/.test(permissions)) continue
      for (const table of tablesOf.get(model) ?? []) live.add(table)
    }
  }
  return live
}
