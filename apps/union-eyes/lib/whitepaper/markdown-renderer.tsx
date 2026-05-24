import type * as React from 'react';

/**
 * Lightweight markdown renderer used by the shared whitepaper route.
 *
 * The source whitepapers in `docs/oci/whitepapers/` are clean, hand-written
 * markdown (unlike the PDF-extracted continuity-gap source, which requires
 * a much larger bespoke parser). This renderer is intentionally minimal and
 * focused on the doctrinal feature set the whitepaper theme actually uses:
 *
 *   - `# / ## / ### / ####` headings
 *   - Body paragraphs with **bold**, *italic*, `code`, and inline `[n]` citations
 *   - Bullet (`- ` / `* `) and ordered (`1. `) lists
 *   - GFM pipe tables with header separator
 *   - Block-quotes: short `> "..."` becomes a pull-quote callout; multi-line
 *     `>` blocks become a styled blockquote with optional `— attribution`
 *   - Fenced code blocks (rendered as a flow diagram-style box)
 *   - `---` horizontal rules (used as visual breaks between major sections)
 *
 * The output uses the same Tailwind tokens as the continuity-gap page so
 * the visual language stays consistent across whitepapers.
 */

export type RenderedWhitepaper = {
  readonly title: string;
  readonly tocItems: ReadonlyArray<{ readonly heading: string; readonly slug: string }>;
  readonly nodes: ReadonlyArray<React.ReactNode>;
};

type Block =
  | { kind: 'heading'; level: 1 | 2 | 3 | 4; text: string; slug: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'table'; columns: string[]; rows: string[][] }
  | { kind: 'quote'; lines: string[] }
  | { kind: 'code'; language: string; content: string }
  | { kind: 'rule' };

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function stripMetadataPreamble(markdown: string): string {
  // Whitepapers begin with a metadata block of bolded `**Key:** value` lines
  // terminated by the first `---` rule. Drop everything up to and including
  // that rule; the visible page already presents the title via the hero band.
  const ruleIdx = markdown.indexOf('\n---');
  if (ruleIdx === -1) return markdown.trim();
  const head = markdown.slice(0, ruleIdx);
  if (!/^\s*#\s/.test(head)) return markdown.trim();
  // Only strip the preamble when it contains metadata-style key/value lines.
  if (!/\n\*\*[A-Z][^*]+\*\*:/.test(head)) return markdown.trim();
  return markdown.slice(ruleIdx + 4).trim();
}

function parseMarkdown(markdown: string): Block[] {
  const source = stripMetadataPreamble(markdown).replace(/\r\n/g, '\n');
  const lines = source.split('\n');
  const blocks: Block[] = [];

  let i = 0;
  const slugCounts = new Map<string, number>();
  const makeSlug = (text: string) => {
    const base = slugify(text);
    const count = slugCounts.get(base) ?? 0;
    slugCounts.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  };

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) {
      i++;
      continue;
    }

    // Horizontal rule.
    if (/^---+$/.test(line)) {
      blocks.push({ kind: 'rule' });
      i++;
      continue;
    }

    // Heading.
    const headingMatch = line.match(/^(#{1,4})\s+(.+?)\s*#*\s*$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3 | 4;
      const text = headingMatch[2].trim();
      blocks.push({ kind: 'heading', level, text, slug: makeSlug(text) });
      i++;
      continue;
    }

    // Fenced code block.
    const codeMatch = line.match(/^```([a-zA-Z0-9_-]*)\s*$/);
    if (codeMatch) {
      const language = codeMatch[1] || 'text';
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i].trim())) {
        body.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consume closing fence
      blocks.push({ kind: 'code', language, content: body.join('\n') });
      continue;
    }

    // Table (line starts with `|` and the next line is a separator).
    if (line.startsWith('|') && i + 1 < lines.length && /^\s*\|?\s*[:\- ]+\|/.test(lines[i + 1])) {
      const splitRow = (row: string): string[] => {
        const trimmed = row.trim().replace(/^\|/, '').replace(/\|$/, '');
        return trimmed.split('|').map((cell) => cell.trim());
      };
      const columns = splitRow(line);
      i += 2; // header + separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push({ kind: 'table', columns, rows });
      continue;
    }

    // Blockquote (one or more `>` lines).
    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ kind: 'quote', lines: quoteLines });
      continue;
    }

    // Unordered list.
    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      const items: string[] = [];
      while (i < lines.length) {
        const cur = lines[i].trim();
        const m = cur.match(/^[-*]\s+(.+)$/);
        if (m) {
          items.push(m[1].trim());
          i++;
          continue;
        }
        if (cur && !/^[-*]\s/.test(cur) && !/^\d+\.\s/.test(cur) && !cur.startsWith('|') && !cur.startsWith('>') && !cur.startsWith('#') && !/^---+$/.test(cur)) {
          // Continuation of the previous bullet.
          items[items.length - 1] = `${items[items.length - 1]} ${cur}`.replace(/\s+/g, ' ');
          i++;
          continue;
        }
        break;
      }
      blocks.push({ kind: 'list', ordered: false, items });
      continue;
    }

    // Ordered list.
    const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      const items: string[] = [];
      while (i < lines.length) {
        const cur = lines[i].trim();
        const m = cur.match(/^\d+\.\s+(.+)$/);
        if (m) {
          items.push(m[1].trim());
          i++;
          continue;
        }
        if (cur && !/^[-*]\s/.test(cur) && !/^\d+\.\s/.test(cur) && !cur.startsWith('|') && !cur.startsWith('>') && !cur.startsWith('#') && !/^---+$/.test(cur)) {
          items[items.length - 1] = `${items[items.length - 1]} ${cur}`.replace(/\s+/g, ' ');
          i++;
          continue;
        }
        break;
      }
      blocks.push({ kind: 'list', ordered: true, items });
      continue;
    }

    // Paragraph: consume consecutive non-blank, non-block lines.
    const paragraph: string[] = [line];
    i++;
    while (i < lines.length) {
      const cur = lines[i].trim();
      if (
        !cur ||
        cur.startsWith('#') ||
        cur.startsWith('>') ||
        cur.startsWith('|') ||
        /^---+$/.test(cur) ||
        /^[-*]\s/.test(cur) ||
        /^\d+\.\s/.test(cur) ||
        /^```/.test(cur)
      ) {
        break;
      }
      paragraph.push(cur);
      i++;
    }
    blocks.push({ kind: 'paragraph', text: paragraph.join(' ').replace(/\s+/g, ' ').trim() });
  }

  return blocks;
}

/**
 * Inline transform: **bold**, *italic*, `code`, [text](href), and superscript
 * `[1]` / `[1,2]` citation markers. Returns a stable array of React nodes.
 */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Tokenize on inline markers; we use a regex that captures the marker types.
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]\]]+\]\([^)]+\)|\[\d+(?:\s*,\s*\d+)*\])/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  const pushPlain = (chunk: string) => {
    if (!chunk) return;
    // Apply OCI / OCRA / GES trademark superscript on standalone matches.
    const re = /\b(OCI|OCRA|GES)\b/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let i = 0;
    while ((m = re.exec(chunk)) !== null) {
      if (m.index > last) nodes.push(chunk.slice(last, m.index));
      nodes.push(
        <span key={`${keyPrefix}-tm-${key}-${i++}`} className="whitespace-nowrap">
          {m[1]}
          <sup className="ml-px align-super text-[0.6em] font-medium text-slate-500">™</sup>
        </span>,
      );
      last = m.index + m[0].length;
    }
    if (last < chunk.length) nodes.push(chunk.slice(last));
  };

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      pushPlain(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push(
        <strong key={`${keyPrefix}-b-${key++}`} className="font-semibold text-slate-900">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith('`')) {
      nodes.push(
        <code
          key={`${keyPrefix}-c-${key++}`}
          className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.92em] text-slate-800"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('*')) {
      nodes.push(
        <em key={`${keyPrefix}-i-${key++}`} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    } else if (token.startsWith('[') && token.includes('](')) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const [, label, href] = linkMatch;
        nodes.push(
          <a
            key={`${keyPrefix}-l-${key++}`}
            href={href}
            className="text-[#1f5b84] underline-offset-4 hover:underline"
            target={href.startsWith('http') ? '_blank' : undefined}
            rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
          >
            {label}
          </a>,
        );
      } else {
        pushPlain(token);
      }
    } else if (/^\[\d+(?:\s*,\s*\d+)*\]$/.test(token)) {
      const markers = token.slice(1, -1).split(/\s*,\s*/);
      nodes.push(
        <sup
          key={`${keyPrefix}-cite-${key++}`}
          className="ml-0.5 inline-flex gap-0.5 align-super text-[0.7em] font-medium text-[#1f5b84]"
        >
          {markers.map((marker, idx) => (
            <span key={`${keyPrefix}-cite-${key}-${idx}`}>
              {marker}
              {idx < markers.length - 1 ? ',' : ''}
            </span>
          ))}
        </sup>,
      );
    } else {
      pushPlain(token);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) {
    pushPlain(text.slice(lastIndex));
  }
  return nodes;
}

const PULL_QUOTE_HEADING = new Set(['central thesis']);

export function renderWhitepaperMarkdown(markdown: string): RenderedWhitepaper {
  const blocks = parseMarkdown(markdown);
  const tocItems: Array<{ heading: string; slug: string }> = [];
  let title = '';

  const nodes: React.ReactNode[] = [];
  let centralThesisActive = false;

  blocks.forEach((block, index) => {
    const key = `wp-${index}`;

    if (block.kind === 'heading') {
      if (block.level === 1) {
        title = block.text;
        return;
      }
      centralThesisActive = block.level === 2 && PULL_QUOTE_HEADING.has(block.text.toLowerCase());
      if (block.level === 2) {
        tocItems.push({ heading: block.text, slug: block.slug });
        nodes.push(
          <h2
            key={key}
            id={block.slug}
            className="scroll-mt-28 border-b border-slate-200 pb-3 text-3xl font-semibold tracking-tight text-navy sm:text-4xl"
          >
            {renderInline(block.text, key)}
          </h2>,
        );
      } else if (block.level === 3) {
        nodes.push(
          <h3
            key={key}
            id={block.slug}
            className="scroll-mt-28 text-lg font-semibold tracking-tight text-slate-800"
          >
            {renderInline(block.text, key)}
          </h3>,
        );
      } else {
        nodes.push(
          <h4
            key={key}
            id={block.slug}
            className="scroll-mt-28 flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#1f5b84]"
          >
            <span className="inline-block h-px w-8 bg-[#1f5b84]/40" aria-hidden="true" />
            {renderInline(block.text, key)}
          </h4>,
        );
      }
      return;
    }

    if (block.kind === 'rule') {
      nodes.push(<hr key={key} className="border-slate-200" />);
      return;
    }

    if (block.kind === 'paragraph') {
      nodes.push(
        <p key={key} className="text-[1.05rem] leading-8 text-slate-700">
          {renderInline(block.text, key)}
        </p>,
      );
      return;
    }

    if (block.kind === 'list') {
      if (block.ordered) {
        nodes.push(
          <ol
            key={key}
            className="list-decimal space-y-2 pl-6 text-[1.05rem] leading-8 text-slate-700 marker:font-semibold marker:text-[#1f5b84]"
          >
            {block.items.map((item, idx) => (
              <li key={`${key}-${idx}`}>{renderInline(item, `${key}-${idx}`)}</li>
            ))}
          </ol>,
        );
      } else {
        nodes.push(
          <ul key={key} className="list-disc space-y-2 pl-6 text-[1.05rem] leading-8 text-slate-700">
            {block.items.map((item, idx) => (
              <li key={`${key}-${idx}`}>{renderInline(item, `${key}-${idx}`)}</li>
            ))}
          </ul>,
        );
      }
      return;
    }

    if (block.kind === 'table') {
      nodes.push(
        <figure
          key={key}
          className="my-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[0.95rem] leading-6 text-slate-700">
              <thead>
                <tr className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  {block.columns.map((col, idx) => (
                    <th
                      key={`${key}-th-${idx}`}
                      scope="col"
                      className="border-b border-slate-200 px-4 py-3 align-bottom"
                    >
                      {renderInline(col, `${key}-th-${idx}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIdx) => (
                  <tr key={`${key}-tr-${rowIdx}`} className="odd:bg-white even:bg-slate-50/40">
                    {row.map((cell, cellIdx) => (
                      <td
                        key={`${key}-td-${rowIdx}-${cellIdx}`}
                        className={`border-t border-slate-100 px-4 py-3 align-top ${
                          cellIdx === 0 ? 'font-semibold text-slate-900' : ''
                        }`}
                      >
                        {renderInline(cell, `${key}-td-${rowIdx}-${cellIdx}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </figure>,
      );
      return;
    }

    if (block.kind === 'quote') {
      // Heuristics:
      //  - A single `> "..."` line is a pull-quote (hero callout under Central Thesis).
      //  - A `> "..."` followed by `> — Attribution` becomes a styled blockquote.
      //  - Anything else is a small blockquote.
      const joined = block.lines.join(' ').replace(/\s+/g, ' ').trim();
      const attributionMatch = block.lines.find((line) => /^[\u2014\u2013-]\s/.test(line.trim()));
      const body = block.lines
        .filter((line) => !/^[\u2014\u2013-]\s/.test(line.trim()))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^["\u201C]|["\u201D]$/g, '');
      const attribution = attributionMatch?.trim().replace(/^[\u2014\u2013-]\s*/, '— ');

      if (centralThesisActive && !attribution) {
        nodes.push(
          <aside
            key={key}
            className="my-2 rounded-2xl border border-[#1f5b84]/30 bg-gradient-to-br from-[#1f5b84] to-[#163f5e] px-8 py-12 text-center shadow-md sm:px-12 sm:py-14"
          >
            <p className="mx-auto max-w-3xl text-[1.35rem] font-semibold leading-10 text-white sm:text-[1.5rem] sm:leading-[2.6rem]">
              {renderInline(body || joined, key)}
            </p>
          </aside>,
        );
        centralThesisActive = false;
        return;
      }

      nodes.push(
        <blockquote
          key={key}
          className="my-2 rounded-r-lg border-l-4 border-[#1f5b84] bg-slate-50 px-5 py-4 text-[0.95rem] italic leading-7 text-slate-700"
        >
          <p>{renderInline(`“${body}”`, `${key}-body`)}</p>
          {attribution ? (
            <footer className="mt-2 text-xs not-italic text-slate-500">
              {renderInline(attribution, `${key}-attr`)}
            </footer>
          ) : null}
        </blockquote>,
      );
      return;
    }

    if (block.kind === 'code') {
      nodes.push(
        <pre
          key={key}
          className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-900 px-5 py-4 text-[0.85rem] leading-6 text-slate-100"
        >
          <code>{block.content}</code>
        </pre>,
      );
    }
  });

  return { title, tocItems, nodes };
}
