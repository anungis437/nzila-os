#!/usr/bin/env python3
"""
tooling/ml/infer_ue_case_priority.py

Scores UE cases using the active ue.case_priority_v1 model.
Writes per-case priority predictions to ml_scores_ue_cases_priority and
uploads a scored CSV to Blob.

Steps:
  1. Resolve active model (or use --model-id)
  2. Download model.joblib artifact from Blob
  3. Query ue_cases for the period (same columns as dataset builder)
  4. Apply feature engineering + encoding
  5. Predict probabilities → argmax → score
  6. Optionally snapshot actualPriority from live label
  7. Upsert into ml_scores_ue_cases_priority
  8. Upload scored.csv to Blob
  9. Finish mlInferenceRuns row + audit_event

Usage:
  python tooling/ml/infer_ue_case_priority.py \\
    --entity-id <uuid> \\
    --model-id <uuid>        # OR omit to use the active model \\
    --period-start 2026-01-01 \\
    --period-end 2026-01-31 \\
    [--created-by system]

Requires: DATABASE_URL, AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCOUNT_KEY
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import traceback
from pathlib import Path
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
import psycopg2

sys.path.insert(0, str(Path(__file__).parent))
from lib.io_blob import download_blob, upload_bytes
from lib import db_write

MODEL_KEY = "ue.case_priority_v1"
CONTAINER = "exports"


def log(msg: str) -> None:
    print(f"[{datetime.now(timezone.utc).isoformat()}] {msg}", file=sys.stderr)


def resolve_model_id(entity_id: str, model_key: str) -> str:
    """Look up the active model ID for a given entity + model key."""
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id FROM ml_models
            WHERE entity_id = %s AND model_key = %s AND status = 'active'
            ORDER BY version DESC
            LIMIT 1
            """,
            (entity_id, model_key),
        )
        row = cur.fetchone()
    conn.close()
    if not row:
        raise ValueError(
            f"No active model found for key '{model_key}' on entity {entity_id}. "
            "Train and activate a model first."
        )
    return str(row[0])


def load_model_artifact(entity_id: str, model_id: str, tmp_path: Path) -> dict:
    """Resolve artifact blob path from documents table, download + load."""
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT d.blob_path FROM ml_models m
            JOIN documents d ON d.id = m.artifact_document_id
            WHERE m.id = %s AND m.entity_id = %s
            """,
            (model_id, entity_id),
        )
        row = cur.fetchone()
    conn.close()
    if not row:
        raise ValueError(f"No artifact document found for model {model_id}")
    download_blob(CONTAINER, row[0], tmp_path)
    return joblib.load(tmp_path)


def fetch_ue_cases(entity_id: str, period_start: str, period_end: str) -> pd.DataFrame:
    """Query ue_cases table directly via psycopg2 (mirrors dataset builder query)."""
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              id                              AS case_id,
              created_at,
              COALESCE(updated_at, created_at) AS updated_at,
              COALESCE(category, 'unknown')   AS category,
              COALESCE(channel, 'unknown')    AS channel,
              COALESCE(status, 'unknown')     AS status,
              COALESCE(assigned_queue, 'unknown') AS assigned_queue,
              priority                        AS actual_priority,
              COALESCE(reopen_count, 0)       AS reopen_count,
              COALESCE(message_count, 0)      AS message_count,
              COALESCE(attachment_count, 0)   AS attachment_count
            FROM ue_cases
            WHERE entity_id = %s
              AND created_at >= %s::timestamptz
              AND created_at <= %s::timestamptz
            ORDER BY created_at ASC
            """,
            (entity_id, period_start + "T00:00:00Z", period_end + "T23:59:59Z"),
        )
        cols = [desc[0] for desc in cur.description]
        rows = cur.fetchall()
    conn.close()
    return pd.DataFrame(rows, columns=cols)


def build_X(df: pd.DataFrame, model_obj: dict) -> np.ndarray:
    """Reconstruct feature matrix using the stored encoders."""
    feature_spec = model_obj["feature_spec"]
    enc = model_obj["ordinal_encoder"]
    numeric_features = feature_spec["numeric_features"]
    categorical_features = feature_spec["categorical_features"]

    df = df.copy()
    for col in numeric_features:
        df[col] = pd.to_numeric(df.get(col, 0), errors="coerce").fillna(0)
    for col in categorical_features:
        if col not in df.columns:
            df[col] = "unknown"
        df[col] = df[col].fillna("unknown").str.lower().str.strip()

    # Derive temporal features from created_at
    if "created_at" in df.columns:
        dt = pd.to_datetime(df["created_at"], utc=True)
        df["dayOfWeek"] = dt.dt.dayofweek
        df["hourOfDay"] = dt.dt.hour
        if "updated_at" in df.columns:
            dt2 = pd.to_datetime(df["updated_at"], utc=True)
            df["ageHoursAtSnapshot"] = (dt2 - dt).dt.total_seconds().clip(lower=0) / 3600
        else:
            df["ageHoursAtSnapshot"] = 0.0

    cat_enc = enc.transform(df[categorical_features])
    num = df[numeric_features].values.astype(float)
    return np.hstack([num, cat_enc])


def main() -> None:
    parser = argparse.ArgumentParser(description="Infer UE case priority scores")
    parser.add_argument("--entity-id", required=True)
    parser.add_argument("--model-id", default=None,
                        help="Specific model UUID; omit to use the active model")
    parser.add_argument("--period-start", required=True)
    parser.add_argument("--period-end", required=True)
    parser.add_argument("--created-by", default="system")
    args = parser.parse_args()

    entity_id = args.entity_id
    period_start = args.period_start
    period_end = args.period_end
    created_by = args.created_by

    # ── Resolve model ────────────────────────────────────────────────────────
    model_id = args.model_id or resolve_model_id(entity_id, MODEL_KEY)
    log(f"Using model_id: {model_id}")

    run_id = db_write.start_inference_run(entity_id, model_id, period_start, period_end)
    db_write.insert_audit_event(
        entity_id=entity_id, actor=created_by,
        action="ml.inference_started",
        target_type="ml_inference_run", target_id=run_id,
        after_json={"modelKey": MODEL_KEY, "modelId": model_id, "period": f"{period_start}/{period_end}"},
    )

    try:
        log(f"Inference: {MODEL_KEY} for {entity_id} ({period_start} → {period_end})")

        # ── Load model ───────────────────────────────────────────────────────
        tmp_model = Path(f"/tmp/ue_priority_model_{run_id}.joblib")
        model_obj = load_model_artifact(entity_id, model_id, tmp_model)
        clf = model_obj["clf"]
        label_enc = model_obj["label_encoder"]
        classes = model_obj["classes"]
        log(f"Loaded model. Classes: {classes}")

        # ── Load cases ───────────────────────────────────────────────────────
        df = fetch_ue_cases(entity_id, period_start, period_end)
        log(f"Fetched {len(df)} UE case rows")

        if len(df) == 0:
            log("No cases found for period. Finishing run with 0 rows.")
            db_write.finish_inference_run(run_id, status="success",
                                           summary={"total_rows": 0, "period": f"{period_start}/{period_end}"})
            return

        # ── Build features + predict ─────────────────────────────────────────
        X = build_X(df, model_obj)
        probas = clf.predict_proba(X)                      # shape (N, n_classes)
        pred_class_idx = np.argmax(probas, axis=1)
        pred_class_labels = label_enc.inverse_transform(pred_class_idx)
        scores = probas[np.arange(len(probas)), pred_class_idx]  # confidence for predicted class

        df["predicted_priority"] = pred_class_labels
        df["score"] = scores

        log(f"Scored {len(df)} rows")
        for cls in classes:
            cnt = int((df["predicted_priority"] == cls).sum())
            log(f"  {cls}: {cnt} ({100*cnt/len(df):.1f}%)")

        # ── Build scored CSV ─────────────────────────────────────────────────
        output_cols = ["case_id", "predicted_priority", "score", "actual_priority", "created_at"]
        available = [c for c in output_cols if c in df.columns]
        scored_csv_bytes = df[available].to_csv(index=False).encode()

        # ── Upload scored CSV ────────────────────────────────────────────────
        run_prefix = f"exports/{entity_id}/ml/inference/{MODEL_KEY}/{run_id}"
        scored_sha, scored_size = upload_bytes(CONTAINER, f"{run_prefix}/scored.csv", scored_csv_bytes, "text/csv")
        output_doc_id = db_write.insert_document(
            entity_id=entity_id, category="other",
            title=f"{MODEL_KEY} — scored.csv ({period_start} → {period_end})",
            blob_container=CONTAINER, blob_path=f"{run_prefix}/scored.csv",
            content_type="text/csv", size_bytes=scored_size, sha256=scored_sha,
            uploaded_by=created_by, linked_type="ml_inference_run",
        )

        # ── Upsert score rows ────────────────────────────────────────────────
        now_ts = datetime.now(timezone.utc).isoformat()
        numeric_features = model_obj["feature_spec"]["numeric_features"]
        categorical_features = model_obj["feature_spec"]["categorical_features"]

        upsert_count = 0
        for _, row in df.iterrows():
            features_safe = {
                **{k: float(row[k]) if k in df.columns else 0.0 for k in numeric_features},
                **{k: str(row.get(k, "unknown")) for k in categorical_features},
            }
            db_write.upsert_ue_priority_score(
                entity_id=entity_id,
                case_id=str(row["case_id"]),
                occurred_at=now_ts,
                score=float(row["score"]),
                predicted_priority=str(row["predicted_priority"]),
                actual_priority=str(row["actual_priority"]) if pd.notna(row.get("actual_priority")) else None,
                features=features_safe,
                model_id=model_id,
                inference_run_id=run_id,
            )
            upsert_count += 1

        log(f"Upserted {upsert_count} priority score rows")

        # ── Priority distribution summary ────────────────────────────────────
        priority_dist = df["predicted_priority"].value_counts().to_dict()

        summary = {
            "total_rows": len(df),
            "priority_distribution": {k: int(v) for k, v in priority_dist.items()},
            "period": f"{period_start}/{period_end}",
        }

        db_write.finish_inference_run(run_id, status="success",
                                       output_document_id=output_doc_id,
                                       summary=summary)
        db_write.insert_audit_event(
            entity_id=entity_id, actor=created_by,
            action="ml.inference_completed",
            target_type="ml_inference_run", target_id=run_id,
            after_json={"modelKey": MODEL_KEY, "modelId": model_id, **summary},
        )

        log(f"\n✔ Inference complete. {upsert_count} priority scores written.")
        print(json.dumps({"run_id": run_id, "status": "success", **summary}))

    except Exception as exc:
        log(f"ERROR: {exc}\n{traceback.format_exc()}")
        db_write.finish_inference_run(run_id, status="failed", error=str(exc))
        db_write.insert_audit_event(
            entity_id=entity_id, actor=created_by,
            action="ml.inference_failed",
            target_type="ml_inference_run", target_id=run_id,
            after_json={"modelKey": MODEL_KEY, "error": str(exc)},
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
