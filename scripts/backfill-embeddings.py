#!/usr/bin/env python3
"""Backfill missing embeddings in knowledge_base."""
import json
import os
import sys
import time
import urllib.request

import psycopg2

conn = psycopg2.connect(
    host="localhost",
    port=5433,
    dbname="nzila_automation",
    user="nzila",
    password="nzila_dev",
)
cur = conn.cursor()

org_id = sys.argv[1] if len(sys.argv) > 1 else None
query = "SELECT id, content FROM knowledge_base WHERE embedding IS NULL"
params = ()
if org_id:
    query += " AND organization_id = %s"
    params = (org_id,)

cur.execute(query, params)
rows = cur.fetchall()
print(f"Missing embeddings: {len(rows)}")

if not rows:
    print("Nothing to backfill.")
    sys.exit(0)

endpoint = os.environ["AZURE_OPENAI_ENDPOINT"].rstrip("/")
api_key = os.environ["AZURE_OPENAI_API_KEY"]
deployment = "text-embedding-3-small"

for i, (row_id, content) in enumerate(rows, 1):
    text = content[:32000]
    url = (
        f"{endpoint}/openai/deployments/{deployment}/embeddings?api-version=2024-06-01"
    )
    body = json.dumps({"input": text}).encode()

    for attempt in range(6):
        req = urllib.request.Request(
            url,
            data=body,
            headers={"api-key": api_key, "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req) as resp:
                result = json.loads(resp.read())
            emb = result["data"][0]["embedding"]
            cur.execute(
                "UPDATE knowledge_base SET embedding = %s, embedding_model = %s, "
                "embedding_model_version = %s WHERE id = %s",
                (emb, "text-embedding-3-small", "text-embedding-3-small@1", row_id),
            )
            conn.commit()
            print(f"  [{i}/{len(rows)}] Backfilled {row_id}")
            break
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 5:
                wait = 2 ** (attempt + 1)
                print(f"  Rate limited, waiting {wait}s...")
                time.sleep(wait)
            else:
                print(f"  [{i}/{len(rows)}] FAILED {row_id}: {e}")
                break
    time.sleep(2)

cur.close()
conn.close()
print("Done")
