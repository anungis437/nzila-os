import { NextResponse } from 'next/server'

const SERVICE_START = Date.now()

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'maestria',
      version: process.env.npm_package_version ?? '0.1.0',
      uptime: Math.floor((Date.now() - SERVICE_START) / 1000),
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  )
}
