"use client";

/**
 * KnowledgeBaseBrowser — browse ingested union documents
 *
 * Displays constitutions, bylaws, forms, and guides from the knowledge_base table.
 * Supports search and filtering by source type.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  BookOpen,
  FileText,
  Search,
  Filter,
  Eye,
  Calendar,
  Tag,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Globe,
  Copy,
  Check,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface KBRecord {
  id: string;
  title: string;
  documentType: string;
  sourceType: string | null;
  sourceUrl: string | null;
  summary: string | null;
  tags: string[] | null;
  language: string | null;
  effectiveDate: string | null;
  version: string | null;
  viewCount: number;
  createdAt: string;
}

interface KBCountEntry {
  sourceType: string | null;
  count: number;
}

const sourceTypeLabels: Record<string, { label: string; icon: React.ReactElement }> = {
  constitution: { label: "Constitutions", icon: <BookOpen className="w-4 h-4" /> },
  bylaws: { label: "Bylaws", icon: <FileText className="w-4 h-4" /> },
  form: { label: "Forms & Guides", icon: <FileText className="w-4 h-4" /> },
};

function formatSourceType(st: string | null): string {
  if (!st) return "Other";
  return sourceTypeLabels[st]?.label ?? st.charAt(0).toUpperCase() + st.slice(1);
}

/** Heading patterns common in union constitutions / bylaws / regulations */
const HEADING_RE =
  /^(SECTION\s+\d+|ARTICLE\s+[IVXLCDM\d]+|REGULATION\s+\d+\w*|SCHEDULE\s+\S+|PART\s+[IVXLCDM\d]+|CHAPTER\s+\d+|APPENDIX\s+\S+|BY-?LAW\s*#?\s*\d+)/i;

/** Sub-heading: numbered clauses like "4.1 Provincial Divisions" or "B 1.1." */
const SUB_HEADING_RE = /^(?:B\s+)?\d+\.\d+[\w.]*\s+[A-Z]/;

/** Lettered or numbered list items: (a), (b), (i), (ii), (1), (2) */
const LIST_ITEM_RE = /^\([a-z]+\)|\(\d+\)|\([ivxlcdm]+\)/i;

/** Page footers / headers to dim: e.g. "2025 CUPE Constitution 11" */
const PAGE_FOOTER_RE = /^\d{4}\s+\w+.*\d+$/;

/** Render a single line, detecting inline list items */
function FormatLine({ line }: { line: string }) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  if (PAGE_FOOTER_RE.test(trimmed)) {
    return (
      <p className="text-[10px] text-gray-300 text-center mt-4 mb-1 select-none">
        {trimmed}
      </p>
    );
  }

  if (LIST_ITEM_RE.test(trimmed)) {
    const match = trimmed.match(/^(\([a-z]+\)|\(\d+\)|\([ivxlcdm]+\))/i);
    const marker = match?.[0] ?? "";
    const rest = trimmed.slice(marker.length);
    return (
      <div className="flex gap-2 pl-6">
        <span className="text-blue-500 font-medium shrink-0 w-8 text-right">
          {marker}
        </span>
        <span>{rest}</span>
      </div>
    );
  }

  return <p className="whitespace-pre-line">{trimmed}</p>;
}

/** Render document content with structural formatting for union docs. */
function FormattedContent({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-2 text-sm text-gray-800 leading-relaxed">
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // Major heading: SECTION / ARTICLE / BY-LAW / REGULATION etc.
        if (HEADING_RE.test(trimmed)) {
          const lines = trimmed.split("\n");
          // Heading can span multiple lines (e.g. "ARTICLE IV\nPROVINCIAL DIVISIONS...")
          // Find where the heading title ends (all-caps continuation lines)
          let headingEnd = 1;
          while (
            headingEnd < lines.length &&
            lines[headingEnd].trim() === lines[headingEnd].trim().toUpperCase() &&
            lines[headingEnd].trim().length > 0
          ) {
            headingEnd++;
          }
          const headingText = lines.slice(0, headingEnd).join(" ");
          const bodyLines = lines.slice(headingEnd);

          return (
            <div key={i} className="mt-6 first:mt-0">
              <h3 className="font-bold text-gray-900 text-[15px] border-b border-gray-200 pb-1.5 mb-2">
                {headingText}
              </h3>
              {bodyLines.length > 0 && (
                <div className="space-y-1">
                  {bodyLines.map((line, j) => (
                    <FormatLine key={j} line={line} />
                  ))}
                </div>
              )}
            </div>
          );
        }

        // Sub-heading: "4.1 Provincial Divisions"
        if (SUB_HEADING_RE.test(trimmed)) {
          const [first, ...rest] = trimmed.split("\n");
          return (
            <div key={i} className="mt-4 first:mt-0">
              <h4 className="font-semibold text-gray-800 text-sm mb-1">
                {first}
              </h4>
              {rest.length > 0 && (
                <div className="space-y-1">
                  {rest.map((line, j) => (
                    <FormatLine key={j} line={line} />
                  ))}
                </div>
              )}
            </div>
          );
        }

        // Block that contains mixed lines (some list items, some prose)
        const lines = trimmed.split("\n");
        if (lines.length > 1 && lines.some((l) => LIST_ITEM_RE.test(l.trim()))) {
          return (
            <div key={i} className="space-y-1">
              {lines.map((line, j) => (
                <FormatLine key={j} line={line} />
              ))}
            </div>
          );
        }

        // Regular paragraph
        return (
          <p key={i} className="whitespace-pre-line">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

export default function KnowledgeBaseBrowser() {
  const t = useTranslations();
  const [records, setRecords] = useState<KBRecord[]>([]);
  const [counts, setCounts] = useState<KBCountEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [docContent, setDocContent] = useState<Record<string, string>>({});
  const [contentLoading, setContentLoading] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const expandedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/knowledge-base")
      .then((r) => r.json())
      .then((json) => {
        setRecords(json.data ?? []);
        setCounts(json.counts ?? []);
      })
      .catch(() => {
        setRecords([]);
        setCounts([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // Escape key collapses expanded doc
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && expandedId) {
        setExpandedId(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [expandedId]);

  // Scroll expanded card into view
  useEffect(() => {
    if (expandedId && expandedRef.current) {
      expandedRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [expandedId]);

  // Fetch full content when expanding a doc
  const handleExpand = async (docId: string) => {
    if (expandedId === docId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(docId);
    setCopied(false);
    if (!docContent[docId]) {
      setContentLoading(docId);
      try {
        const res = await fetch(`/api/knowledge-base/${docId}`);
        const json = await res.json();
        const content = json?.data?.content ?? json?.content;
        if (content) {
          setDocContent((prev) => ({ ...prev, [docId]: content }));
        }
      } catch {
        // Content fetch failed — expanded section will show without content
      } finally {
        setContentLoading(null);
      }
    }
  };

  const handleCopy = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const toggleGroup = useCallback((group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }, []);

  // Client-side filtering (search + sourceType)
  const filtered = useMemo(() => {
    let list = records;
    if (sourceFilter !== "all") {
      list = list.filter((r) => r.sourceType === sourceFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          (r.summary && r.summary.toLowerCase().includes(q)) ||
          (r.tags && r.tags.some((tag) => tag.toLowerCase().includes(q))),
      );
    }
    return list;
  }, [records, sourceFilter, search]);

  // Group filtered records by parent document title (text before ":")
  const grouped = useMemo(() => {
    const groups: { key: string; label: string; sourceType: string | null; docs: KBRecord[] }[] = [];
    const map = new Map<string, typeof groups[number]>();
    for (const doc of filtered) {
      const colonIdx = doc.title.indexOf(":");
      const key = colonIdx > 0 ? doc.title.slice(0, colonIdx).trim() : doc.title;
      let group = map.get(key);
      if (!group) {
        group = { key, label: key, sourceType: doc.sourceType, docs: [] };
        map.set(key, group);
        groups.push(group);
      }
      group.docs.push(doc);
    }
    return groups;
  }, [filtered]);

  const totalBySource = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of counts) {
      map[c.sourceType ?? "other"] = c.count;
    }
    return map;
  }, [counts]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {t("sidebar.unionDocuments")}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Browse your union&apos;s constitutions, bylaws, forms, and policy guides.
        </p>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSourceFilter("all")}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            sourceFilter === "all"
              ? "bg-blue-100 text-blue-800 border-blue-300"
              : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
          }`}
        >
          All ({records.length})
        </button>
        {Object.entries(totalBySource).map(([st, count]) => (
          <button
            key={st}
            onClick={() => setSourceFilter(st)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              sourceFilter === st
                ? "bg-blue-100 text-blue-800 border-blue-300"
                : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
            }`}
          >
            {sourceTypeLabels[st]?.icon}
            {formatSourceType(st)} ({count})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 px-4 py-3 rounded-lg border bg-gray-50/50 focus-within:border-blue-300 focus-within:ring-1 focus-within:ring-blue-200 transition-all">
        <Search size={16} className="text-gray-400 shrink-0" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search documents by title, summary, or tags\u2026"
          className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Clear
          </button>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
          <div className="w-6 h-6 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading documents…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
          <BookOpen size={32} className="text-gray-300" />
          <span className="text-sm">
            {records.length === 0
              ? "No documents available for your organization."
              : "No documents match your search or filter."}
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-400">
            {filtered.length} document{filtered.length !== 1 ? "s" : ""}
          </p>
          {filtered.map((doc) => {
            const isExpanded = expandedId === doc.id;
            return (
              <Card
                key={doc.id}
                className={`transition-all ${
                  isExpanded
                    ? "shadow-md border-blue-300 ring-1 ring-blue-100"
                    : "hover:shadow-sm hover:border-blue-200"
                }`}
              >
                <CardContent className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => handleExpand(doc.id)}
                    className="w-full text-left flex items-start gap-3"
                  >
                    <div className="mt-0.5 shrink-0 text-blue-600">
                      {sourceTypeLabels[doc.sourceType ?? ""]?.icon ?? (
                        <FileText className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm text-gray-900 truncate">
                          {doc.title}
                        </span>
                        {isExpanded ? (
                          <ChevronUp size={14} className="text-gray-400 shrink-0" />
                        ) : (
                          <ChevronDown size={14} className="text-gray-400 shrink-0" />
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                          <Filter size={10} />
                          {formatSourceType(doc.sourceType)}
                        </span>
                        {doc.language && (
                          <span className="inline-flex items-center gap-1">
                            <Globe size={10} />
                            {doc.language.toUpperCase()}
                          </span>
                        )}
                        {doc.effectiveDate && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar size={10} />
                            {new Date(doc.effectiveDate).toLocaleDateString()}
                          </span>
                        )}
                        {doc.viewCount > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Eye size={10} />
                            {doc.viewCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t text-sm space-y-3">
                      {/* Metadata row */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        {doc.version && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                            v{doc.version}
                          </span>
                        )}
                        {doc.tags && doc.tags.length > 0 &&
                          doc.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700"
                            >
                              <Tag size={10} />
                              {tag}
                            </span>
                          ))}
                        {doc.sourceUrl && (
                          <a
                            href={doc.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline ml-auto"
                          >
                            <Globe size={10} />
                            View original source
                          </a>
                        )}
                      </div>

                      {doc.summary && (
                        <p className="text-gray-600 italic border-l-2 border-blue-200 pl-3">
                          {doc.summary}
                        </p>
                      )}

                      {/* Document content */}
                      {contentLoading === doc.id ? (
                        <div className="flex items-center gap-2 py-6 justify-center text-xs text-gray-400">
                          <div className="w-4 h-4 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
                          Loading document content…
                        </div>
                      ) : docContent[doc.id] ? (
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">
                              Document Content
                            </span>
                            <span className="text-[11px] text-gray-400">
                              {docContent[doc.id].split(/\s+/).length.toLocaleString()} words
                            </span>
                          </div>
                          <div className="bg-white rounded-lg p-5 max-h-[60vh] overflow-y-auto border border-gray-200 shadow-inner">
                            <FormattedContent text={docContent[doc.id]} />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
