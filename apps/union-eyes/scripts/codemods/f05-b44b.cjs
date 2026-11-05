const fs=require('fs');
function edit(p,pairs){let s=fs.readFileSync(p,'utf8');for(const [a,b] of pairs){if(!s.includes(a))throw new Error('missing in '+p+': '+a.slice(0,60));s=s.split(a).join(b);}fs.writeFileSync(p,s);}
edit('app/api/organization/members/search/route.ts',[
["import { eq, and, isNull, or, ilike, sql } from 'drizzle-orm';","import { eq, and, asc, isNull, or, ilike, sql } from 'drizzle-orm';\nimport { ApiError } from '@/lib/api/framework';\nimport { likeContaining, SEARCH_TERM_MAX_LENGTH } from '@/lib/api/like-pattern';"],
["import { withApi } from '@/lib/api/framework';\n",""],
["    const q = url.searchParams.get('q') || '';\n","    const q = (url.searchParams.get('q') || '').trim();\n    if (q.length > SEARCH_TERM_MAX_LENGTH) throw ApiError.badRequest(`q must be at most ${SEARCH_TERM_MAX_LENGTH} characters`);\n    const pageSize = Math.min(Math.max(Number(url.searchParams.get('limit') ?? PAGE_SIZE) || PAGE_SIZE, 1), PAGE_SIZE);\n    const offset = Math.max(Number(url.searchParams.get('offset') ?? 0) || 0, 0);\n"],
["export const dynamic = 'force-dynamic';\n","export const dynamic = 'force-dynamic';\n\nconst PAGE_SIZE = 50;\n"],
["ilike(organizationMembers.name, `%${q}%`),\n            ilike(organizationMembers.email, `%${q}%`),","ilike(organizationMembers.name, likeContaining(q)),\n            ilike(organizationMembers.email, likeContaining(q)),"],
["        .where(and(...conditions))\n        .limit(50);","        .where(and(...conditions))\n        .orderBy(asc(organizationMembers.name), asc(organizationMembers.id))\n        .limit(pageSize)\n        .offset(offset);"],
]);
