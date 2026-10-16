import { writeFile } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SyntheticWorkflowGallery } from '../../components/workflow/synthetic-workflow-gallery'
import { buildSyntheticOperatorCollection } from './synthetic-journeys'

async function render() {
  const output = process.argv[2]
  if (!output || !isAbsolute(output) || !output.endsWith('.html'))
    throw new Error('Supply an absolute local .html output path')
  const journeys = await buildSyntheticOperatorCollection()
  const markup = renderToStaticMarkup(createElement(SyntheticWorkflowGallery, { journeys }))
  await writeFile(
    output,
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Cora synthetic workflow reference</title><style>body{background:#eef2f6;color:#172033;font:16px/1.6 system-ui;margin:0;padding:1.5rem}main{max-width:62rem;margin:auto}summary{cursor:pointer;padding:.65rem;font-weight:600}a{color:#174b86}a:focus-visible,summary:focus-visible{outline:3px solid #174b86;outline-offset:3px}details{border:1px solid #64748b;border-radius:.25rem;padding:.25rem;margin:.75rem 0}section{scroll-margin-top:1rem}</style></head><body>${markup}</body></html>`,
    'utf8',
  )
  console.log(`Rendered ${journeys.length} synthetic reference scenarios to ${output}`)
}
void render()
