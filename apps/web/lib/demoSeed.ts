/**
 * Web — Demo Seed Data
 *
 * Creates demo org, users, workflow examples, and analytics data
 * for pilot demonstrations. WeekOne demo data is seeded independently
 * via `tsx apps/weekone/lib/demoSeed.ts` (no app-to-app coupling).
 */

export interface DemoOrg {
  id: string
  name: string
  domain: string
}

export interface DemoUser {
  id: string
  email: string
  role: string
  orgId: string
}

export interface DemoPage {
  slug: string
  title: string
  status: 'draft' | 'published'
  author: string
}

export function createDemoOrg(): DemoOrg {
  return { id: 'demo-org-web', name: 'Nzila Demo Web', domain: 'demo.nzila.io' }
}

export function createDemoUsers(orgId: string): DemoUser[] {
  return [
    { id: 'demo-editor', email: 'editor@demo.nzila.io', role: 'editor', orgId },
    { id: 'demo-admin', email: 'admin@demo.nzila.io', role: 'admin', orgId },
    { id: 'demo-viewer', email: 'viewer@demo.nzila.io', role: 'viewer', orgId },
  ]
}

export function createDemoPages(): DemoPage[] {
  return [
    { slug: 'about', title: 'About Nzila', status: 'published', author: 'demo-editor' },
    { slug: 'pricing', title: 'Pricing Plans', status: 'published', author: 'demo-editor' },
    { slug: 'enterprise', title: 'Enterprise Solutions', status: 'draft', author: 'demo-admin' },
    {
      slug: 'blog-launch',
      title: 'Platform Launch Announcement',
      status: 'published',
      author: 'demo-editor',
    },
  ]
}

export function createDemoAnalytics() {
  return {
    pageViews: 15400,
    uniqueVisitors: 8200,
    leadsCapture: 340,
    conversionRate: 0.041,
    topPages: ['/pricing', '/about', '/enterprise'],
  }
}

export async function seedDemo() {
  const org = createDemoOrg()
  const users = createDemoUsers(org.id)
  const pages = createDemoPages()
  const analytics = createDemoAnalytics()

  console.log(`[demo:seed] Web demo data created`)
  console.log(`  Web Org: ${org.name}`)
  console.log(`  Web Users: ${users.length}`)
  console.log(`  Web Pages: ${pages.length}`)
  console.log(`  Web Analytics: ready`)
  console.log(`  (WeekOne demo data: run \`tsx apps/weekone/lib/demoSeed.ts\` separately)`)

  return { web: { org, users, pages, analytics } }
}

if (process.argv[1]?.includes('demoSeed')) {
  seedDemo().catch(console.error)
}
