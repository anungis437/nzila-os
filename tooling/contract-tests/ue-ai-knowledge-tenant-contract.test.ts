/**
 * UE Gate 0: tenant-isolation source contract for AI knowledge retrieval.
 *
 * These checks prevent an accidental reintroduction of the public-knowledge
 * cross-tenant bypass. They are source checks, not a substitute for PG15/16
 * and authenticated HTTP adversarial acceptance.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..', '..', 'apps', 'union-eyes');
const source = (path: string) => readFileSync(join(root, path), 'utf8');

/** One exported handler: from its `export const NAME =` to the next export (or the end), so what one method of a route does is not credited to another. */
const handlerOf = (file: string, name: 'POST' | 'GET'): string => {
  const start = file.indexOf(`export const ${name} =`);
  expect(start).toBeGreaterThan(-1);
  const next = file.indexOf('\nexport const ', start + 1);
  return next === -1 ? file.slice(start) : file.slice(start, next);
};

/** What the route hands the wrapper, which enforces it before the handler runs: the handler's text up to its `async (`. */
const wrapperOptionsOf = (file: string, name: 'POST' | 'GET'): string => {
  const handler = handlerOf(file, name);
  const end = handler.indexOf('\n  async (');
  expect(end).toBeGreaterThan(-1);
  return handler.slice(0, end);
};

describe('UE AI knowledge tenant isolation', () => {
  it('summarize requires an authenticated organization before entitlement and retrieval', () => {
    const file = source('app/api/ai/summarize/route.ts');
    const guard = file.indexOf('if (!organizationId)');
    const entitlement = file.indexOf('await checkEntitlement(');
    const lookup = file.indexOf('tx.query.knowledgeBase.findFirst(');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(entitlement);
    expect(entitlement).toBeLessThan(lookup);
  });

  it('summarize binds document ID and tenant in the database predicate, not a post-read public flag', () => {
    const file = source('app/api/ai/summarize/route.ts');
    const lookup = file.match(/tx\.query\.knowledgeBase\.findFirst\(\{[\s\S]*?\}\);/);
    expect(lookup).not.toBeNull();
    expect(lookup![0]).toContain('eq(knowledgeBase.id, document_id)');
    expect(lookup![0]).toContain('eq(knowledgeBase.organizationId, orgId)');
    expect(lookup![0]).not.toMatch(/\bisPublic\s*\?/);
    // The lookup runs in the organization's own row-level-security context, which binds the tenant again.
    expect(file).toContain('withRLSContext({ organizationId: orgId }');
  });

  it('semantic search binds knowledge rows to authenticated organization', () => {
    const file = source('app/api/ai/search/route.ts');
    // The wrapper refuses a caller with no resolved organization before the POST handler runs (requireOrg defaults to true for an authenticated route).
    const post = wrapperOptionsOf(file, 'POST');
    expect(post).toContain("auth: { minRole: 'member' }");
    expect(post).not.toContain('requireOrg: false');
    // The index-health GET opts out of the wrapper's refusal and answers a caller with no organization 400 itself, before it queries anything.
    expect(wrapperOptionsOf(file, 'GET')).toContain('requireOrg: false');
    const get = handlerOf(file, 'GET');
    expect(get).toContain('if (!organizationId)');
    expect(get.indexOf('if (!organizationId)')).toBeLessThan(get.indexOf('withRLSContext('));
    expect(file).toContain('const orgId = organizationId as string');
    // The route hands only the authenticated organization to the one query, which binds it in its predicate (and row-level security binds it again).
    expect(file).toContain('organizationId: orgId,');
    expect(file).toContain('knowledgeBaseSourceCondition(reader, orgId)');
    expect(source('lib/ai/knowledge-base-embeddings.ts')).toContain('eq(knowledgeBase.organizationId, query.organizationId)');
  });

  it('chatbot RAG rejects missing tenant before embedding and uses RLS and an SQL predicate', () => {
    const file = source('lib/ai/chatbot-service.ts');
    const rag = file.slice(file.indexOf('export class RAGService'), file.indexOf('/**\n * NZ-RISK-026'));
    const guard = rag.indexOf("if (!options.organizationId?.trim())");
    const embed = rag.indexOf('await aiEmbed(query, options.organizationId)');
    expect(guard).toBeGreaterThan(-1);
    expect(embed).toBeGreaterThan(guard);
    expect(rag).toContain('withRLSContext({ organizationId: options.organizationId }');
    // The organization predicate is the shared query's; the retrieval passes the session's organization and the reader's levels into it.
    expect(rag).toContain('organizationId: options.organizationId,');
    expect(rag).toContain('knowledgeBaseSourceCondition(');
    expect(source('lib/ai/knowledge-base-embeddings.ts')).toContain('eq(knowledgeBase.organizationId, query.organizationId)');
  });
});
