import { NextResponse } from 'next/server'

const defaultChecklist = [
  'Confirm top 3 priorities for the week',
  'Review cash runway and overdue invoices',
  'Review pipeline movement and at-risk deals',
  'Record one expected blocker and one mitigation',
  'Publish weekly focus note to your team',
]

export async function POST() {
  const timestamp = new Date().toISOString()
  return NextResponse.json({
    ok: true,
    mondayResetAt: timestamp,
    checklist: defaultChecklist,
  })
}
