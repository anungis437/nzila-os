import { NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'

export async function GET() {
  const agreementPath = join(process.cwd(), 'docs', 'zonga', 'pilot-commercial-model.md')
  const content = await fs.readFile(agreementPath, 'utf-8')

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': 'attachment; filename="zonga-pilot-commercial-model.md"',
    },
  })
}
