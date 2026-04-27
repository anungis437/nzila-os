import { NextResponse } from 'next/server'
import { getBuildMetadata } from '@nzila/os-core/health'

const APP = 'veridian-care'

export async function GET() {
  return NextResponse.json(getBuildMetadata(APP))
}
