#!/usr/bin/env python3
"""
Document ingestion pipeline for the knowledge_base table.

Reads a PDF, chunks it by section (regex-driven), optionally generates
Azure OpenAI embeddings, and inserts records into PostgreSQL.

Usage:
    .venv/Scripts/python.exe scripts/ingest-document.py <pdf_path> [options]

Examples:
    # Ingest ACEP-CAPE bylaws (auto-detects BY-LAW sections)
    .venv/Scripts/python.exe scripts/ingest-document.py content/internal/acep-cape-bylaws-2026.pdf \
        --org "063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6" \
        --doc-type union_policy \
        --source-type bylaws \
        --source-url "https://www.acep-cape.ca/sites/default/files/2026-03/2026-03-31%20Bylaws_EN_FINAL.pdf" \
        --section-pattern "BY-LAW\\s*#\\s*\\d+" \
        --parent-title "ACEP-CAPE Bylaws (2026)" \
        --effective-date 2026-03-31

    # Ingest a collective agreement (custom section pattern)
    .venv/Scripts/python.exe scripts/ingest-document.py path/to/cba.pdf \
        --org <org-uuid> --doc-type collective_agreement \
        --source-type cba --section-pattern "ARTICLE\\s+\\d+"

    # Skip embeddings (no Azure OpenAI creds needed)
    .venv/Scripts/python.exe scripts/ingest-document.py path/to/doc.pdf \
        --org <org-uuid> --doc-type guide --source-type manual --no-embed
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import Optional

import pdfplumber
import psycopg2  # type: ignore[import-untyped]
from psycopg2.extras import Json  # type: ignore[import-untyped]

# ── Constants ────────────────────────────────────────────────────────────────

DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small"
DEFAULT_EMBEDDING_DIMS = 1536
DEFAULT_API_VERSION = "2024-06-01"
DEFAULT_SECTION_PATTERN = r"BY-LAW\s*#\s*\d+"

# ── PDF Extraction ──────────────────────────────────────────────────────────


def extract_text(pdf_path: str) -> str:
    """Extract full text from a PDF using pdfplumber."""
    pages: list[str] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                pages.append(text)
    return "\n\n".join(pages)


# ── Chunking ────────────────────────────────────────────────────────────────


def chunk_by_section(
    text: str,
    pattern: str,
    parent_title: str = "",
    min_chars: int = 250,
    case_sensitive: bool = False,
) -> list[dict[str, str]]:
    """Split text into sections using a regex pattern.

    Returns list of dicts with 'title' and 'content'.
    Any text before the first match becomes a 'Preamble' chunk.
    """
    flags = 0 if case_sensitive else re.IGNORECASE
    if "^" in pattern or "$" in pattern:
        flags |= re.MULTILINE
    regex = re.compile(pattern, flags)
    matches = list(regex.finditer(text))

    if not matches:
        # No sections found — return whole document as one chunk
        return [{"title": parent_title or "Full Document", "content": text.strip()}]

    chunks: list[dict[str, str]] = []

    # Preamble (text before first match)
    preamble = text[: matches[0].start()].strip()
    if preamble and len(preamble) > 100:
        chunks.append({"title": f"{parent_title} — Preamble", "content": preamble})

    # Each section
    for i, match in enumerate(matches):
        start = match.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        section_text = text[start:end].strip()

        # Extract a readable title from the first line of the section
        first_line = section_text.split("\n")[0].strip()
        # Try to grab the by-law title (e.g., "BY-LAW # 3 - ELECTIONS AND RESOLUTIONS")
        title_match = re.match(
            r"(BY-LAW\s*#\s*\d+)\s*[-–—]\s*(.+)", first_line, re.IGNORECASE
        )
        if title_match:
            section_title = (
                f"{title_match.group(1).strip()} — {title_match.group(2).strip()}"
            )
        else:
            section_title = first_line[:120]

        if parent_title:
            section_title = f"{parent_title}: {section_title}"

        # Skip short chunks (e.g., TOC entries)
        if len(section_text) < min_chars:
            continue

        # Skip TOC entries (contain dot leaders like ".....")
        if re.search(r"\.{4,}", first_line):
            continue

        chunks.append({"title": section_title, "content": section_text})

    return chunks


def split_oversized_chunks(
    chunks: list[dict[str, str]], max_chars: int
) -> list[dict[str, str]]:
    """Sub-divide any chunk exceeding max_chars at paragraph boundaries."""
    result: list[dict[str, str]] = []
    for chunk in chunks:
        if len(chunk["content"]) <= max_chars:
            result.append(chunk)
            continue

        # Split on double-newlines (paragraph boundaries)
        paragraphs = re.split(r"\n\n+", chunk["content"])
        current_content = ""
        part = 1

        for para in paragraphs:
            if current_content and len(current_content) + len(para) + 2 > max_chars:
                result.append(
                    {
                        "title": f"{chunk['title']} (part {part})",
                        "content": current_content.strip(),
                    }
                )
                part += 1
                current_content = para
            else:
                current_content = (
                    (current_content + "\n\n" + para) if current_content else para
                )

        if current_content.strip():
            result.append(
                {
                    "title": (
                        f"{chunk['title']} (part {part})"
                        if part > 1
                        else chunk["title"]
                    ),
                    "content": current_content.strip(),
                }
            )

    return result


# ── Embeddings ──────────────────────────────────────────────────────────────


def generate_embedding(
    text: str,
    endpoint: str,
    api_key: str,
    deployment: str,
    api_version: str = DEFAULT_API_VERSION,
    max_retries: int = 5,
) -> list[float]:
    """Generate embedding via Azure OpenAI REST API with retry on 429."""
    import time
    import urllib.request

    url = f"{endpoint.rstrip('/')}/openai/deployments/{deployment}/embeddings?api-version={api_version}"
    # Truncate to ~8000 tokens (~32000 chars) to stay within model limits
    truncated = text[:32000]

    body = json.dumps({"input": truncated}).encode()

    for attempt in range(max_retries):
        req = urllib.request.Request(
            url,
            data=body,
            headers={
                "api-key": api_key,
                "Content-Type": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req) as resp:
                result = json.loads(resp.read())
            return result["data"][0]["embedding"]
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < max_retries - 1:
                # Exponential backoff: 2, 4, 8, 16, 32 seconds
                wait = 2 ** (attempt + 1)
                print(f"         Rate limited, retrying in {wait}s ...")
                time.sleep(wait)
            else:
                raise


# ── Database ────────────────────────────────────────────────────────────────


def get_connection(
    host: str = "localhost",
    port: int = 5433,
    dbname: str = "nzila_automation",
    user: str = "nzila",
    password: str = "nzila_dev",
) -> "psycopg2.connection":
    return psycopg2.connect(
        host=host, port=port, dbname=dbname, user=user, password=password
    )


def insert_chunk(
    conn: "psycopg2.connection",
    *,
    organization_id: str,
    title: str,
    document_type: str,
    content: str,
    source_type: str,
    source_id: Optional[str] = None,
    source_url: Optional[str] = None,
    embedding: Optional[list[float]] = None,
    tags: Optional[list[str]] = None,
    keywords: Optional[list[str]] = None,
    language: str = "en",
    effective_date: Optional[str] = None,
    created_by: str = "user_3BSzhdQTA7fsGN5kUPfXJpMTK1O",
) -> str:
    """Insert a single knowledge_base record. Returns the new row's UUID."""
    row_id = str(uuid.uuid4())
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO knowledge_base (
                id, organization_id, title, document_type, content,
                source_type, source_id, source_url,
                embedding, embedding_model, embedding_model_version,
                tags, keywords, language,
                effective_date,
                is_active, created_by
            ) VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s,
                true, %s
            )
            """,
            (
                row_id,
                organization_id,
                title,
                document_type,
                content,
                source_type,
                source_id,
                source_url,
                embedding,
                DEFAULT_EMBEDDING_MODEL if embedding else None,
                f"{DEFAULT_EMBEDDING_MODEL}@1" if embedding else None,
                Json(tags) if tags else None,
                Json(keywords) if keywords else None,
                language,
                effective_date,
                created_by,
            ),
        )
    return row_id


# ── Keyword extraction (simple) ─────────────────────────────────────────────


def extract_keywords(text: str, top_n: int = 10) -> list[str]:
    """Extract simple keywords from text (most frequent non-stop words)."""
    stop = {
        "the",
        "a",
        "an",
        "and",
        "or",
        "of",
        "to",
        "in",
        "for",
        "on",
        "by",
        "is",
        "be",
        "are",
        "was",
        "were",
        "with",
        "at",
        "from",
        "as",
        "that",
        "this",
        "it",
        "its",
        "not",
        "but",
        "if",
        "may",
        "shall",
        "will",
        "has",
        "have",
        "had",
        "been",
        "any",
        "all",
        "each",
        "such",
        "than",
        "who",
        "which",
        "their",
        "them",
        "they",
        "he",
        "she",
        "his",
        "her",
        "more",
        "other",
        "into",
        "under",
        "upon",
        "when",
        "where",
        "after",
        "before",
        "between",
        "through",
        "during",
        "without",
        "also",
        "no",
        "only",
        "very",
        "can",
        "does",
        "did",
        "would",
        "could",
        "should",
        "about",
        "up",
        "out",
        "so",
        "what",
        "one",
        "two",
        "three",
        "four",
    }
    words = re.findall(r"\b[a-z]{3,}\b", text.lower())
    freq: dict[str, int] = {}
    for w in words:
        if w not in stop:
            freq[w] = freq.get(w, 0) + 1
    ranked = sorted(freq.items(), key=lambda x: -x[1])
    return [w for w, _ in ranked[:top_n]]


# ── Main ────────────────────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Ingest a PDF document into the knowledge_base table."
    )
    parser.add_argument("pdf_path", help="Path to the PDF file")
    parser.add_argument("--org", required=True, help="Organization UUID")
    parser.add_argument(
        "--doc-type",
        required=True,
        choices=[
            "collective_agreement",
            "union_policy",
            "labor_law",
            "precedent",
            "faq",
            "guide",
            "other",
        ],
        help="knowledge_document_type enum value",
    )
    parser.add_argument(
        "--source-type",
        required=True,
        help="Source category (bylaws, cba, policy, etc.)",
    )
    parser.add_argument("--source-url", help="URL of the original document")
    parser.add_argument("--source-id", help="External reference ID")
    parser.add_argument(
        "--section-pattern",
        default=DEFAULT_SECTION_PATTERN,
        help="Regex to split sections",
    )
    parser.add_argument(
        "--min-chars",
        type=int,
        default=250,
        help="Minimum chunk size (filters out TOC entries)",
    )
    parser.add_argument(
        "--parent-title", default="", help="Parent document title prefix"
    )
    parser.add_argument("--effective-date", help="Effective date (YYYY-MM-DD)")
    parser.add_argument("--tags", nargs="*", help="Tags to apply to all chunks")
    parser.add_argument("--language", default="en", help="Document language")
    parser.add_argument(
        "--created-by",
        default="user_3BSzhdQTA7fsGN5kUPfXJpMTK1O",
        help="Profile user_id",
    )
    parser.add_argument(
        "--no-embed", action="store_true", help="Skip embedding generation"
    )
    parser.add_argument(
        "--case-sensitive",
        action="store_true",
        help="Use case-sensitive regex for section matching",
    )
    parser.add_argument(
        "--max-chars",
        type=int,
        default=0,
        help="Max chunk size in chars; oversized chunks are split at paragraph boundaries (0=no limit)",
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Print chunks without inserting"
    )

    # DB connection
    parser.add_argument("--db-host", default="localhost")
    parser.add_argument("--db-port", type=int, default=5433)
    parser.add_argument("--db-name", default="nzila_automation")
    parser.add_argument("--db-user", default="nzila")
    parser.add_argument("--db-password", default="nzila_dev")

    args = parser.parse_args()

    # ── 1. Extract text ──────────────────────────────────────────────────
    pdf_path = Path(args.pdf_path)
    if not pdf_path.exists():
        print(f"ERROR: PDF not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)

    print(f"[1/4] Extracting text from {pdf_path} ...")
    text = extract_text(str(pdf_path))
    print(f"       Extracted {len(text):,} characters")

    # ── 2. Chunk ─────────────────────────────────────────────────────────
    print(f"[2/4] Chunking by pattern: {args.section_pattern}")
    chunks = chunk_by_section(
        text,
        args.section_pattern,
        args.parent_title,
        args.min_chars,
        case_sensitive=args.case_sensitive,
    )

    if args.max_chars > 0:
        chunks = split_oversized_chunks(chunks, args.max_chars)

    print(f"       Created {len(chunks)} chunks")

    if args.dry_run:
        for i, c in enumerate(chunks, 1):
            print(f"\n  [{i}] {c['title']}")
            print(
                f"      {len(c['content']):,} chars | keywords: {extract_keywords(c['content'], 5)}"
            )
        print("\n[dry-run] No records inserted.")
        return

    # ── 3. Embeddings ────────────────────────────────────────────────────
    embed = not args.no_embed
    if embed:
        endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT", "")
        api_key = os.environ.get("AZURE_OPENAI_API_KEY", "")
        deployment = os.environ.get(
            "AZURE_OPENAI_DEPLOYMENT_EMBEDDINGS", "text-embedding-3-small"
        )
        if not endpoint or not api_key:
            print(
                "WARNING: AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_API_KEY not set — skipping embeddings"
            )
            embed = False

    if embed:
        print(f"[3/4] Generating embeddings via {deployment} ...")
    else:
        print("[3/4] Skipping embeddings")

    # ── 4. Insert into DB ────────────────────────────────────────────────
    print("[4/4] Inserting into knowledge_base ...")
    conn = get_connection(
        host=args.db_host,
        port=args.db_port,
        dbname=args.db_name,
        user=args.db_user,
        password=args.db_password,
    )

    inserted = 0
    try:
        for i, chunk in enumerate(chunks, 1):
            embedding = None
            if embed:
                try:
                    embedding = generate_embedding(
                        chunk["content"], endpoint, api_key, deployment  # type: ignore[possibly-undefined]
                    )
                    print(f"       [{i}/{len(chunks)}] embedded: {chunk['title'][:60]}")
                except Exception as e:
                    print(f"       [{i}/{len(chunks)}] embed FAILED: {e}")

            keywords = extract_keywords(chunk["content"])

            row_id = insert_chunk(
                conn,
                organization_id=args.org,
                title=chunk["title"],
                document_type=args.doc_type,
                content=chunk["content"],
                source_type=args.source_type,
                source_id=args.source_id,
                source_url=args.source_url,
                embedding=embedding,
                tags=args.tags,
                keywords=keywords,
                language=args.language,
                effective_date=args.effective_date,
                created_by=args.created_by,
            )
            inserted += 1
            if not embed:
                print(f"       [{i}/{len(chunks)}] inserted: {chunk['title'][:60]}")

        conn.commit()
        print(f"\nDone! Inserted {inserted} records into knowledge_base.")
    except Exception as e:
        conn.rollback()
        print(f"\nERROR: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
