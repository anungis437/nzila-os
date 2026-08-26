import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as yaml from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localizedInsightsRoot = path.join(__dirname, '../scripts/articles/fr-CA');

export interface InsightCategory {
  slug: string;
  name: string;
  description: string;
}

export interface InsightArticle {
  slug: string;
  title: string;
  excerpt: string;
  categorySlug: string;
  categoryName: string;
  readTime: string;
  format: string;
  audience: string;
  publishedOn: string;
  author: string;
  featured: boolean;
  takeaways: string[];
  headings: string[];
  bodyMarkdown: string;
}

export interface UpcomingInsightTopic {
  slug: string;
  title: string;
}

type MarkdownInsightFrontmatter = {
  title: string;
  slug: string;
  category: string;
  author: string;
  publishedOn: string;
  readTime: string;
  format: string;
  audience: string;
  excerpt: string;
};

const insightLibraryPath = path.join(__dirname, '../scripts/articles/union_eyes_insights_markdown_library_phase_1.md');

const featuredSlugs = new Set([
  'continuity-crisis',
  'labour-safe-ai-defined',
  'explainable-governance',
  'tribal-to-institutional-memory',
]);

const categoryDescriptions: Record<string, string> = {
  'Organizational Continuity':
    'How labour organizations build organizational memory, navigate leadership transitions, and strengthen continuity resilience.',
  // Legacy label alias used by existing markdown frontmatter.
  'Institutional Continuity':
    'How labour organizations build organizational memory, navigate leadership transitions, and strengthen continuity resilience.',
  'Governance Modernization':
    'Transforming governance operations with explainable intelligence and modern oversight controls.',
  'Explainable Governance Reasoning':
    'Why explainability is non-negotiable in labour environments and how to operationalize it.',
  // Legacy alias — retained so older article frontmatter continues to parse during transition.
  'Explainable Organizational Intelligence':
    'Why explainability is non-negotiable in labour environments and how to operationalize it.',
  'Labour-Safe AI':
    'The principles, practices, and governance safeguards for responsible AI in labour organizations.',
  'Organizational Memory':
    'Capturing organizational memory: preserving organizational knowledge and making it operationally accessible across leadership transitions.',
  'Governance Resilience':
    'Building governance structures that withstand leadership transitions, disputes, and modernization pressure.',
  'Operational Fragility':
    'Identifying and reducing coordination breakdowns that undermine organizational effectiveness.',
};

const categorySlugByName: Record<string, string> = {
  'Organizational Continuity': 'institutional-continuity',
  // Legacy label alias — keep canonical slug stable.
  'Institutional Continuity': 'institutional-continuity',
  'Governance Modernization': 'governance-modernization',
  'Explainable Governance Reasoning': 'explainable-intelligence',
  // Legacy alias — keep slug stable for procurement deep links.
  'Explainable Organizational Intelligence': 'explainable-intelligence',
  'Labour-Safe AI': 'labour-safe-ai',
  'Organizational Memory': 'organizational-memory',
  'Governance Resilience': 'governance-resilience',
  'Operational Fragility': 'operational-fragility',
};

function readInsightLibrary(): string {
  return fs.readFileSync(insightLibraryPath, 'utf8');
}

// Safe slug allowlist: lowercase alphanumerics + hyphens, no dots, no slashes.
// Blocks path-traversal payloads ("..", "/etc/passwd", encoded separators, etc.)
// before any filesystem lookup. Aikido SAST AIK_ts_generic_path_traversal.
const SAFE_INSIGHT_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,126}[a-z0-9])?$/;

function readLocalizedInsightMarkdown(locale: string, slug: string): string | null {
  if (locale !== 'fr-CA') return null;
  // Reject any slug that isn't in our safe allowlist BEFORE touching the filesystem.
  if (!SAFE_INSIGHT_SLUG.test(slug)) return null;

  // Enumerate the localized insights directory (a trusted, module-owned root).
  // We match the user slug against the directory listing rather than
  // concatenating it into a path, so `fs.readFileSync` only ever receives a
  // path built from module constants + a filename returned by `readdirSync`.
  // Aikido SAST AIK_ts_generic_path_traversal.
  if (!fs.existsSync(localizedInsightsRoot)) return null;
  const expected = `${slug}.md`;
  for (const entry of fs.readdirSync(localizedInsightsRoot, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (entry.name !== expected) continue;
    const trustedPath = path.join(localizedInsightsRoot, entry.name);
    return fs.readFileSync(trustedPath, 'utf8');
  }
  return null;
}

function splitInsightDocuments(markdown: string): string[] {
  const normalized = markdown.replace(/\r\n/g, '\n').trim();
  return normalized
    .split(/\n(?=# [^\n]+\.md\n+---\n)/g)
    .map((block) => block.trim())
    .filter(Boolean);
}

function parseInsightDocument(document: string): InsightArticle {
  const match = document.match(/^#\s+([^\n]+)\n+---\n([\s\S]*?)\n---\n+([\s\S]*)$/);

  if (!match) {
    throw new Error('Unable to parse insight markdown document.');
  }

  // Parse frontmatter with the JSON-subset schema: no custom tags, no !!js/function,
  // no code-execution vectors — only null/bool/int/float/string. Aikido SAST
  // AIK_ts_yaml_deserialize; js-yaml v4 default is already safe but JSON_SCHEMA
  // makes the safety guarantee explicit and machine-checkable.
  const frontmatter = yaml.load(match[2], { schema: yaml.JSON_SCHEMA }) as MarkdownInsightFrontmatter;
  const bodyMarkdown = match[3].trim();
  const categoryName = frontmatter.category === 'Institutional Continuity'
    ? 'Organizational Continuity'
    : frontmatter.category;
  const categorySlug = categorySlugByName[categoryName] ?? categorySlugByName[frontmatter.category];

  if (!categorySlug) {
    throw new Error(`Unknown insight category: ${frontmatter.category}`);
  }

  return {
    slug: frontmatter.slug,
    title: frontmatter.title,
    excerpt: frontmatter.excerpt,
    categorySlug,
    categoryName,
    readTime: frontmatter.readTime,
    format: frontmatter.format,
    audience: frontmatter.audience,
    publishedOn: String(frontmatter.publishedOn),
    author: frontmatter.author,
    featured: featuredSlugs.has(frontmatter.slug),
    takeaways: extractTakeaways(bodyMarkdown),
    headings: extractHeadings(bodyMarkdown),
    bodyMarkdown,
  };
}

function extractTakeaways(markdown: string): string[] {
  const bullets: string[] = [];

  for (const line of markdown.split('\n')) {
    const match = line.match(/^[-*]\s+(.+)$/);
    if (match) {
      bullets.push(match[1].trim());
    }
    if (bullets.length === 3) break;
  }

  return bullets;
}

function extractHeadings(markdown: string): string[] {
  return Array.from(markdown.matchAll(/^#{1,3}\s+(.+)$/gm)).map((match) => match[1].trim());
}

function loadInsightArticles(locale: string): InsightArticle[] {
  const englishArticles = splitInsightDocuments(readInsightLibrary()).map(parseInsightDocument);

  if (locale !== 'fr-CA') {
    return englishArticles;
  }

  const localizedBySlug = new Map<string, InsightArticle>();

  for (const article of englishArticles) {
    const localizedMarkdown = readLocalizedInsightMarkdown(locale, article.slug);
    if (!localizedMarkdown) continue;

    localizedBySlug.set(article.slug, parseInsightDocument(localizedMarkdown));
  }

  return englishArticles.map((article) => localizedBySlug.get(article.slug) ?? article);
}

export const insightArticles = loadInsightArticles('en-CA');

function getCategoryNames(articles: InsightArticle[]): string[] {
  return Array.from(new Set(articles.map((article) => article.categoryName)));
}

export function getInsightArticles(locale = 'en-CA'): InsightArticle[] {
  return loadInsightArticles(locale);
}

export function getInsightCategories(locale = 'en-CA'): InsightCategory[] {
  const categoryNames = getCategoryNames(loadInsightArticles(locale));

  return categoryNames.map((name) => ({
    slug: categorySlugByName[name],
    name,
    description: categoryDescriptions[name],
  }));
}

export const insightCategories: InsightCategory[] = getInsightCategories('en-CA');

export const upcomingInsightTopics: UpcomingInsightTopic[] = [
  {
    slug: 'board-succession-risk-scoring',
    title: 'Board succession risk scoring without surveillance tradeoffs',
  },
  {
    slug: 'designing-continuity-protocols',
    title: 'Designing continuity protocols that survive leadership turnover',
  },
  {
    slug: 'explainable-intelligence-policy-workflows',
    title: 'How to operationalize explainable intelligence in policy workflows',
  },
  {
    slug: 'explainable-intelligence-procurement-standard',
    title: 'Procurement standards for labour-safe AI vendors and contracts',
  },
];

export function getFeaturedInsights(locale = 'en-CA'): InsightArticle[] {
  return loadInsightArticles(locale).filter((article) => article.featured);
}

export function getInsightBySlug(slug: string, locale = 'en-CA'): InsightArticle | undefined {
  return loadInsightArticles(locale).find((article) => article.slug === slug);
}

export function getInsightsByCategory(categorySlug: string, locale = 'en-CA'): InsightArticle[] {
  return loadInsightArticles(locale).filter((article) => article.categorySlug === categorySlug);
}

export function getInsightCategory(slug: string, locale = 'en-CA'): InsightCategory | undefined {
  return getInsightCategories(locale).find((category) => category.slug === slug);
}

export function getInsightCategoryCounts(locale = 'en-CA'): Record<string, number> {
  return loadInsightArticles(locale).reduce<Record<string, number>>((accumulator, article) => {
    accumulator[article.categorySlug] = (accumulator[article.categorySlug] ?? 0) + 1;
    return accumulator;
  }, {});
}

export function getRelatedInsights(slug: string, limit = 3, locale = 'en-CA'): InsightArticle[] {
  const source = getInsightBySlug(slug, locale);
  if (!source) return [];

  const allArticles = loadInsightArticles(locale);

  const sameCategory = allArticles.filter(
    (article) => article.slug !== slug && article.categorySlug === source.categorySlug,
  );

  if (sameCategory.length >= limit) {
    return sameCategory.slice(0, limit);
  }

  const remaining = allArticles.filter(
    (article) => article.slug !== slug && article.categorySlug !== source.categorySlug,
  );

  return [...sameCategory, ...remaining].slice(0, limit);
}

export function getInsightHref(slug: string, locale = 'en-CA'): string {
  return `/${locale}/insights/${slug}`;
}
