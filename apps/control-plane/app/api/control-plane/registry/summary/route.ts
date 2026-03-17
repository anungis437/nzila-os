import { NextResponse } from 'next/server'
import * as fs from 'node:fs'
import * as path from 'node:path'

export const dynamic = 'force-dynamic'

function readJsonSafe<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }
}

export async function GET() {
  const root = path.resolve(process.cwd(), '..', '..')
  const registryDir = path.join(root, 'platform', 'registry')

  const files = ['apps.json', 'layers.json', 'platform-registry.json', 'platform-surfaces.json', 'environments.json']

  const status: Record<string, { exists: boolean; entry_count: number | null }> = {}

  for (const file of files) {
    const filePath = path.join(registryDir, file)
    const exists = fs.existsSync(filePath)
    let entryCount: number | null = null

    if (exists) {
      const data = readJsonSafe<Record<string, unknown>>(filePath)
      if (data) {
        // Count primary array in each registry
        const arrayKeys = ['apps', 'surfaces', 'environments', 'services']
        for (const key of arrayKeys) {
          if (Array.isArray(data[key])) {
            entryCount = (data[key] as unknown[]).length
            break
          }
        }
        if (entryCount === null && data.layers && typeof data.layers === 'object') {
          entryCount = Object.keys(data.layers).length
        }
      }
    }

    status[file] = { exists, entry_count: entryCount }
  }

  const allExist = Object.values(status).every((s) => s.exists)

  return NextResponse.json({
    registry_complete: allExist,
    files: status,
    registry_path: 'platform/registry/',
    checked_at: new Date().toISOString(),
  })
}
