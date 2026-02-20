"""
tooling/ml/lib/db_write.py

Database write helpers for ML training and inference runs.
Uses psycopg2 so the Python scripts don't need Drizzle.
"""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any

import psycopg2


def _conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Training runs ─────────────────────────────────────────────────────────────

def start_training_run(entity_id: str, model_key: str, dataset_id: str | None) -> str:
    """Insert a training run row with status=started. Returns run_id (uuid)."""
    run_id = str(uuid.uuid4())
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO ml_training_runs
              (id, entity_id, model_key, dataset_id, status, started_at, created_at, updated_at)
            VALUES (%s, %s, %s, %s, 'started', %s, %s, %s)
            """,
            (run_id, entity_id, model_key, dataset_id, _now(), _now(), _now()),
        )
    print(f"  ▶ Training run started: {run_id}")
    return run_id


def finish_training_run(
    run_id: str,
    *,
    status: str,
    artifact_document_id: str | None = None,
    metrics_document_id: str | None = None,
    logs_document_id: str | None = None,
    error: str | None = None,
) -> None:
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ml_training_runs
            SET status=%s, finished_at=%s,
                artifact_document_id=%s, metrics_document_id=%s,
                logs_document_id=%s, error=%s, updated_at=%s
            WHERE id=%s
            """,
            (
                status, _now(),
                artifact_document_id, metrics_document_id,
                logs_document_id, error, _now(),
                run_id,
            ),
        )
    print(f"  ✔ Training run finished: {run_id} → {status}")


def register_model(
    *,
    entity_id: str,
    model_key: str,
    algorithm: str,
    version: int,
    training_dataset_id: str | None,
    artifact_document_id: str | None,
    metrics_document_id: str | None,
    hyperparams: dict[str, Any],
    feature_spec: dict[str, Any],
) -> str:
    """Insert an mlModels row with status=draft. Returns model_id."""
    model_id = str(uuid.uuid4())
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO ml_models
              (id, entity_id, model_key, algorithm, version, status,
               training_dataset_id, artifact_document_id, metrics_document_id,
               hyperparams_json, feature_spec_json, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, 'draft', %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (entity_id, model_key, version) DO NOTHING
            """,
            (
                model_id, entity_id, model_key, algorithm, version,
                training_dataset_id, artifact_document_id, metrics_document_id,
                json.dumps(hyperparams), json.dumps(feature_spec),
                _now(), _now(),
            ),
        )
    print(f"  ✔ Model registered: {model_id} ({model_key} v{version}, status=draft)")
    return model_id


# ── Inference runs ────────────────────────────────────────────────────────────

def start_inference_run(
    entity_id: str,
    model_id: str,
    period_start: str,
    period_end: str,
) -> str:
    run_id = str(uuid.uuid4())
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO ml_inference_runs
              (id, entity_id, model_id, status, started_at,
               input_period_start, input_period_end,
               summary_json, created_at, updated_at)
            VALUES (%s, %s, %s, 'started', %s, %s, %s, '{}', %s, %s)
            """,
            (run_id, entity_id, model_id, _now(), period_start, period_end, _now(), _now()),
        )
    print(f"  ▶ Inference run started: {run_id}")
    return run_id


def finish_inference_run(
    run_id: str,
    *,
    status: str,
    output_document_id: str | None = None,
    summary: dict[str, Any] | None = None,
    error: str | None = None,
) -> None:
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ml_inference_runs
            SET status=%s, finished_at=%s,
                output_document_id=%s, summary_json=%s, error=%s, updated_at=%s
            WHERE id=%s
            """,
            (
                status, _now(),
                output_document_id, json.dumps(summary or {}), error, _now(),
                run_id,
            ),
        )
    print(f"  ✔ Inference run finished: {run_id} → {status}")


# ── Score upserts ─────────────────────────────────────────────────────────────

def upsert_daily_score(
    *,
    entity_id: str,
    date: str,
    features: dict[str, Any],
    score: float,
    is_anomaly: bool,
    threshold: float,
    model_id: str,
    inference_run_id: str,
) -> None:
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO ml_scores_stripe_daily
              (id, entity_id, date, features_json, score, is_anomaly,
               threshold, model_id, inference_run_id, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (entity_id, date, model_id)
            DO UPDATE SET
              features_json=EXCLUDED.features_json,
              score=EXCLUDED.score,
              is_anomaly=EXCLUDED.is_anomaly,
              threshold=EXCLUDED.threshold,
              inference_run_id=EXCLUDED.inference_run_id
            """,
            (
                str(uuid.uuid4()), entity_id, date,
                json.dumps(features), score, is_anomaly,
                threshold, model_id, inference_run_id, _now(),
            ),
        )


def upsert_txn_score(
    *,
    entity_id: str,
    stripe_event_id: str | None,
    stripe_charge_id: str | None,
    stripe_payment_intent_id: str | None,
    stripe_balance_txn_id: str | None,
    occurred_at: str,
    currency: str,
    amount: float,
    features: dict[str, Any],
    score: float,
    is_anomaly: bool,
    threshold: float,
    model_id: str,
    inference_run_id: str,
) -> None:
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO ml_scores_stripe_txn
              (id, entity_id, stripe_event_id, stripe_charge_id,
               stripe_payment_intent_id, stripe_balance_txn_id,
               occurred_at, currency, amount, features_json,
               score, is_anomaly, threshold, model_id, inference_run_id, created_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            (
                str(uuid.uuid4()), entity_id,
                stripe_event_id, stripe_charge_id,
                stripe_payment_intent_id, stripe_balance_txn_id,
                occurred_at, currency, amount,
                json.dumps(features),
                score, is_anomaly, threshold,
                model_id, inference_run_id, _now(),
            ),
        )


# ── Documents ─────────────────────────────────────────────────────────────────

def insert_document(
    *,
    entity_id: str,
    category: str,
    title: str,
    blob_container: str,
    blob_path: str,
    content_type: str,
    size_bytes: int,
    sha256: str,
    uploaded_by: str,
    linked_type: str,
) -> str:
    doc_id = str(uuid.uuid4())
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO documents
              (id, entity_id, category, title, blob_container, blob_path,
               content_type, size_bytes, sha256, uploaded_by, classification,
               linked_type, created_at, updated_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'internal',%s,%s,%s)
            """,
            (
                doc_id, entity_id, category, title,
                blob_container, blob_path, content_type,
                size_bytes, sha256, uploaded_by, linked_type,
                _now(), _now(),
            ),
        )
    return doc_id


# ── Audit events ──────────────────────────────────────────────────────────────

def insert_audit_event(
    *,
    entity_id: str,
    actor: str,
    action: str,
    target_type: str,
    target_id: str | None,
    after_json: dict[str, Any],
) -> None:
    import hashlib
    payload_str = json.dumps(after_json, sort_keys=True)
    h = hashlib.sha256(payload_str.encode()).hexdigest()
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO audit_events
              (id, entity_id, actor_clerk_user_id, action,
               target_type, target_id, after_json, hash, created_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            (
                str(uuid.uuid4()), entity_id, actor, action,
                target_type, target_id,
                json.dumps(after_json), h, _now(),
            ),
        )
