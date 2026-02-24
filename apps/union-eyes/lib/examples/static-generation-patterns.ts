/**
 * Static Generation Examples and Patterns
 * 
 * @NOTE: This is an example file demonstrating Next.js patterns
 * Some schema fields referenced here may not exist in the current schema
 * 
 * Demonstrates Next.js static generation strategies for optimal performance:
 * - Static Site Generation (SSG) with revalidation (ISR)
 * - Dynamic parameters with generateStaticParams
 * - On-demand revalidation
 * - Partial prerendering
 * 
 * Use these patterns for:
 * - Public landing pages
 * - Documentation pages
 * - Blog posts
 * - Product listings
 * - Marketing pages with frequent updates
 */

import { NextResponse } from 'next/server';
import { db } from '@/db/db';

// ============================================================================
// Example 1: Basic Static Page with ISR (Incremental Static Regeneration)
// ============================================================================

/**
 * Public organizations listing page
 * - Statically generated at build time
 * - Revalidates every 5 minutes
 * - Perfect for public directory pages
 * 
 * @file app/public/organizations/page.tsx
 */
export async function getStaticOrganizationsPage() {
  // This would be in your page component:
  // export const revalidate = 300; // 5 minutes
  
  const orgs = await db.query.organizations.findMany({
    where: (organizations, { eq }) => eq(organizations.status, 'active'),
    columns: {
      id: true,
      name: true,
      description: true
    },
    limit: 100
  });
  
  return orgs;
}

// ============================================================================
// Example 2: Dynamic Routes with Static Params
// ============================================================================

/**
 * Generate static paths for organization detail pages
 * - Pre-renders top organizations at build time
 * - Falls back to on-demand generation for others
 * 
 * @file app/public/organizations/[slug]/page.tsx
 */
export async function generateOrganizationStaticParams() {
  // This would be your generateStaticParams function:
  // export async function generateStaticParams() { ... }
  
  const topOrganizations = await db.query.organizations.findMany({
    where: (organizations, { eq }) => eq(organizations.status, 'active'),
    columns: {
      slug: true
    },
    limit: 50 // Pre-render top 50 organizations
  });
  
  return topOrganizations.map((org) => ({
    slug: org.slug
  }));
}

/**
 * Organization detail page data
 * - Revalidates every 10 minutes
 * - Static for top organizations
 * - Dynamic fallback for others
 */
export async function getOrganizationDetailPage(slug: string) {
  // This would be in your page component:
  // export const revalidate = 600; // 10 minutes
  // export const dynamicParams = true; // Allow fallback
  
  const org = await db.query.organizations.findFirst({
    where: (organizations, { eq, and }) => and(
      eq(organizations.slug, slug),
      eq(organizations.status, 'active')
    ),
    with: {
      members: {
        limit: 10
      }
    }
  });
  
  if (!org) {
    return null; // Will trigger 404
  }
  
  return org;
}

// ============================================================================
// Example 3: API Route with Static Generation
// ============================================================================

/**
 * Public API route for organization stats
 * - Cached at CDN edge
 * - Revalidates every 15 minutes
 * 
 * @file app/api/public/stats/route.ts
 */
export const revalidate = 900; // 15 minutes

export async function getPublicStatsAPI() {
  // This would be your GET handler:
  // export async function GET() { ... }
  
  const stats = await db.execute(`
    SELECT 
      COUNT(DISTINCT o.id) as total_organizations,
      COUNT(DISTINCT u.id) as total_members,
      COUNT(DISTINCT e.id) as total_events
    FROM organizations o
    LEFT JOIN users u ON u.organization_id = o.id
    LEFT JOIN events e ON e.organization_id = o.id
    WHERE o.is_public = true
  `);
  
  return NextResponse.json({
    stats: stats[0],
    generated_at: new Date().toISOString(),
    revalidate_in: revalidate
  });
}

// ============================================================================
// Example 4: On-Demand Revalidation
// ============================================================================

/**
 * Trigger revalidation when content is updated
 * 
 * @file app/api/revalidate/route.ts
 */
export async function revalidateOrganization(slug: string, token: string) {
  // This would be your POST handler:
  // export async function POST(request: Request) { ... }
  
  // Verify revalidation token
  const REVALIDATION_TOKEN = process.env.REVALIDATION_TOKEN;
  if (token !== REVALIDATION_TOKEN) {
    return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
  }
  
  try {
    // Revalidate specific paths
    const { revalidatePath, revalidateTag } = await import('next/cache');
    
    // Revalidate by path
    revalidatePath(`/public/organizations/${slug}`);
    revalidatePath('/public/organizations');
    
    // Revalidate by tag (if using cache tags)
    revalidateTag(`organization-${slug}`, 'default');
    
    return NextResponse.json({ revalidated: true, now: Date.now() });
  } catch (_err) {
    return NextResponse.json({ message: 'Error revalidating' }, { status: 500 });
  }
}

// ============================================================================
// Example 5: Partial Prerendering (PPR) - Experimental
// ============================================================================

/**
 * Landing page with mixed static and dynamic content
 * - Static hero section
 * - Dynamic user greeting (if logged in)
 * - Static features list
 * 
 * @file app/page.tsx
 */
export const experimental_ppr = true;

export async function getLandingPage() {
  // Static content (prerendered)
  const staticFeatures = [
    { title: 'Secure', description: 'Enterprise-grade security' },
    { title: 'Fast', description: 'Lightning-fast performance' },
    { title: 'Reliable', description: '99.9% uptime SLA' }
  ];
  
  // This would be rendered as:
  // <div>
  //   <HeroSection features={staticFeatures} /> {/* Static */}
  //   <Suspense fallback={<UserGreetingSkeleton />}>
  //     <UserGreeting /> {/* Dynamic */}
  //   </Suspense>
  // </div>
  
  return { features: staticFeatures };
}

// ============================================================================
// Example 6: Route Segment Config Best Practices
// ============================================================================

/**
 * Complete route configuration for different page types
 */

// Public marketing page (fully static)
export const marketingPageConfig = {
  revalidate: 3600, // 1 hour
  dynamic: 'force-static' as const,
  dynamicParams: true,
  fetchCache: 'force-cache' as const
};

// Public directory page (ISR with fallback)
export const directoryPageConfig = {
  revalidate: 300, // 5 minutes
  dynamic: 'auto' as const,
  dynamicParams: true,
  fetchCache: 'default-cache' as const
};

// Dynamic user page (SSR with caching)
export const userPageConfig = {
  revalidate: 60, // 1 minute
  dynamic: 'force-dynamic' as const,
  fetchCache: 'default-no-store' as const
};

// Real-time dashboard (no caching)
export const dashboardPageConfig = {
  revalidate: 0, // No revalidation
  dynamic: 'force-dynamic' as const,
  fetchCache: 'force-no-store' as const
};

// ============================================================================
// Example 7: Static Generation with Cache Tags
// ============================================================================

/**
 * Blog post page with granular revalidation
 * 
 * @file app/blog/[slug]/page.tsx
 */
export async function getBlogPost(slug: string) {
  // This would include cache tag in fetch:
  // const post = await fetch(`/api/posts/${slug}`, {
  //   next: { 
  //     revalidate: 600, 
  //     tags: [`post-${slug}`, 'blog-posts'] 
  //   }
  // });
  
  const post = await db.query.publicContent.findFirst({
    where: (publicContent, { eq }) => eq(publicContent.slug, slug)
  });
  
  return post;
}

// ============================================================================
// Usage Guide
// ============================================================================

/**
 * RECOMMENDED PATTERNS:
 * 
 * 1. Public Landing Pages:
 *    - revalidate: 3600 (1 hour)
 *    - dynamic: 'force-static'
 *    - Use for: Homepage, about, pricing
 * 
 * 2. Public Directories:
 *    - revalidate: 300 (5 minutes)
 *    - dynamic: 'auto'
 *    - generateStaticParams for top items
 *    - Use for: Organization listings, member directories
 * 
 * 3. Blog/Documentation:
 *    - revalidate: 600 (10 minutes)
 *    - Cache tags for granular invalidation
 *    - Use for: Blog posts, docs, help articles
 * 
 * 4. User Dashboards:
 *    - revalidate: 0
 *    - dynamic: 'force-dynamic'
 *    - Use for: Authenticated pages, real-time data
 * 
 * PERFORMANCE IMPACT:
 * 
 * Static Generation (SSG):
 * - First Byte: <10ms (served from CDN)
 * - Reduced server load by 90%+
 * - No database queries for cached pages
 * 
 * ISR (Incremental Static Regeneration):
 * - Fresh content within revalidation period
 * - Background regeneration (no user wait)
 * - Best of static + dynamic
 * 
 * DEPLOYMENT CONSIDERATIONS:
 * 
 * 1. Build Time:
 *    - Limit generateStaticParams to top items (50-100)
 *    - Use dynamicParams: true for fallback
 * 
 * 2. CDN Configuration:
 *    - Set Cache-Control headers correctly
 *    - Use stale-while-revalidate
 *    - Configure edge caching
 * 
 * 3. Monitoring:
 *    - Track static vs dynamic ratio
 *    - Monitor ISR regeneration frequency
 *    - Alert on high fallback usage
 */

// Example page.tsx implementation:
/*
// app/public/organizations/page.tsx

import { db } from '@/db/db';
import { organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Route Segment Config
export const revalidate = 300; // 5 minutes
export const dynamic = 'force-static';
export const dynamicParams = true;

export default async function OrganizationsPage() {
  const orgs = await db.query.organizations.findMany({
    where: eq(organizations.isPublic, true),
    limit: 100
  });

  return (
    <div>
      <h1>Public Organizations</h1>
      <ul>
        {orgs.map(org => (
          <li key={org.id}>{org.name}</li>
        ))}
      </ul>
    </div>
  );
}
*/

// Example dynamic page.tsx implementation:
/*
// app/public/organizations/[slug]/page.tsx

import { db } from '@/db/db';
import { organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';

// Route Segment Config
export const revalidate = 600; // 10 minutes
export const dynamicParams = true;

// Generate static params for top organizations
export async function generateStaticParams() {
  const topOrgs = await db.query.organizations.findMany({
    where: eq(organizations.isPublic, true),
    columns: { slug: true },
    limit: 50
  });

  return topOrgs.map((org) => ({
    slug: org.slug
  }));
}

export default async function OrganizationPage({ 
  params 
}: { 
  params: { slug: string } 
}) {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, params.slug)
  });

  if (!org) {
    notFound();
  }

  return (
    <div>
      <h1>{org.name}</h1>
      <p>{org.description}</p>
    </div>
  );
}
*/
