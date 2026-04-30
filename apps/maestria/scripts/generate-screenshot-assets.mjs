import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const locale = process.env.LOCALE === 'fr-CA' ? 'fr-CA' : 'en-CA'
const actor = process.env.ACTOR ?? 'lissa'
const baseUrl = process.env.MAESTRIA_BASE_URL ?? 'http://localhost:3021'
const outputRoot = process.env.OUTPUT_ROOT ?? join(process.cwd(), 'artifacts', 'screenshots', 'maestria')

async function main() {
  const url = `${baseUrl}/api/maestria/assets/screenshots?as=${encodeURIComponent(actor)}&locale=${encodeURIComponent(locale)}&outputPath=${encodeURIComponent(outputRoot)}`
  const response = await fetch(url, { method: 'POST' })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Screenshot queue request failed (${response.status}): ${body}`)
  }

  const payload = await response.json()

  const targetDir = join(outputRoot, locale)
  mkdirSync(targetDir, { recursive: true })
  const manifestPath = join(targetDir, 'capture-manifest.json')

  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        actor,
        locale,
        baseUrl,
        queueResponse: payload,
        captureHowTo: [
          '1) Ensure Maestria is running locally on MAESTRIA_BASE_URL.',
          '2) Use Playwright CI/browser capture against each queued route.',
          '3) Save files to the filePath values provided in queueResponse.',
          '4) Commit the generated assets for sales/demo packs if required.',
        ],
      },
      null,
      2,
    ),
    'utf8',
  )

  console.log(`Screenshot manifest written to ${manifestPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
