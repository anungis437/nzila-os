import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

  const frontmatter = yaml.load(match[2]) as MarkdownInsightFrontmatter;
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

export const insightArticles = splitInsightDocuments(readInsightLibrary()).map(parseInsightDocument);
const categoryNames = Array.from(new Set(insightArticles.map((article) => article.categoryName)));

export const insightCategories: InsightCategory[] = categoryNames.map((name) => ({
  slug: categorySlugByName[name],
  name,
  description: categoryDescriptions[name],
}));

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

export function getFeaturedInsights(): InsightArticle[] {
  return insightArticles.filter((article) => article.featured);
}

export function getInsightBySlug(slug: string): InsightArticle | undefined {
  return insightArticles.find((article) => article.slug === slug);
}

export function getInsightsByCategory(categorySlug: string): InsightArticle[] {
  return insightArticles.filter((article) => article.categorySlug === categorySlug);
}

export function getInsightCategory(slug: string): InsightCategory | undefined {
  return insightCategories.find((category) => category.slug === slug);
}

export function getInsightCategoryCounts(): Record<string, number> {
  return insightArticles.reduce<Record<string, number>>((accumulator, article) => {
    accumulator[article.categorySlug] = (accumulator[article.categorySlug] ?? 0) + 1;
    return accumulator;
  }, {});
}

export function getRelatedInsights(slug: string, limit = 3): InsightArticle[] {
  const source = getInsightBySlug(slug);
  if (!source) return [];

  const sameCategory = insightArticles.filter(
    (article) => article.slug !== slug && article.categorySlug === source.categorySlug,
  );

  if (sameCategory.length >= limit) {
    return sameCategory.slice(0, limit);
  }

  const remaining = insightArticles.filter(
    (article) => article.slug !== slug && article.categorySlug !== source.categorySlug,
  );

  return [...sameCategory, ...remaining].slice(0, limit);
}

export function getInsightHref(slug: string, locale = 'en-CA'): string {
  return `/${locale}/insights/${slug}`;
}
