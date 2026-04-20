import { NextResponse } from 'next/server'
import { getBuildMetadata } from '@nzila/os-core/health'

const APP = 'union-eyes'

export async function GET() {
  return NextResponse.json(getBuildMetadata(APP))
}