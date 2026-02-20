#!/usr/bin/env python3
"""
tooling/ml/infer_daily_iforest.py

Scores Stripe daily metrics using the active IsolationForest model.
Writes scores to ml_scores_stripe_daily + uploads scored CSV to Blob.

Usage:
  python tooling/ml/infer_daily_iforest.py \\
    --entity-id <uuid> \\
    --model-id <uuid> \\
    --dataset-blob-path exports/.../dataset.csv \\
    --period-start 2026-01-01 \\
    --period-end 2026-01-31 \\
    [--created-by system]

Requires: DATABASE_URL, AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCOUNT_KEY
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import sys
import traceback
from pathlib import Path
from datetime import datetime, timezone
from uuid import uuid4

import joblib
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from lib.io_blob import download_blob, upload_bytes
from lib import db_write

MODEL_KEY = "stripe_anomaly_daily_iforest_v1"
CONTAINER = "exports"


def log(msg: str) -> None:
    print(f"[{datetime.now(timezone.utc).isoformat()}] {msg}", file=sys.stderr)


def main() -> None:
    parser = argparse.ArgumentParser(description="Infer Stripe daily anomalies")
    parser.add_argument("--entity-id", required=True)
    parser.add_argument("--model-id", required=True)
    parser.add_argument("--dataset-blob-path", required=True)
    parser.add_argument("--period-start", required=True)
    parser.add_argument("--period-end", required=True)
    parser.add_argument("--created-by", default="system")
    args = parser.parse_args()

    entity_id = args.entity_id
    model_id = args.model_id
    blob_path = args.dataset_blob_path
    period_start = args.period_start
    period_end = args.period_end
    created_by = args.created_by

    run_id = db_write.start_inference_run(entity_id, model_id, period_start, period_end)

    try:
        log(f"Inference: {MODEL_KEY} for {entity_id} ({period_start} → {period_end})")

        # 1. Download dataset
        tmp_csv = Path(f"/tmp/ml_daily_infer_{run_id}.csv")
        download_blob(CONTAINER, blob_path, tmp_csv)
        df = pd.read_csv(tmp_csv)
        log(f"Loaded {len(df)} rows")

        # 2. Download model
        tmp_model = Path(f"/tmp/ml_daily_model_{run_id}.joblib")
        # Derive model blob path from documents table (caller should pass it)
        # For scripts, we accept the artifact path or discover it via DB
        # Here we load from /tmp assuming caller pre-downloads or passes artifact path
        # In practice, query documents for the model artifact and download
        model_obj = _load_model_artifact(entity_id, model_id, tmp_model)
        clf = model_obj["clf"]
        scaler = model_obj["scaler"]
        feature_spec = model_obj["feature_spec"]
        threshold = float(model_obj["threshold"])

        # 3. Feature prep
        df_clean = _prepare_daily_features(df, feature_spec)
        all_features = feature_spec["all_features"]
        X_raw = df_clean[all_features].values.astype(float)
        X_scaled = scaler.transform(X_raw)

        # 4. Score
        scores = clf.decision_function(X_scaled)
        df["score"] = scores
        df["is_anomaly"] = scores < threshold
        df["threshold"] = threshold

        anomaly_count = int(df["is_anomaly"].sum())
        log(f"Scored {len(df)} rows, {anomaly_count} anomalies (threshold={threshold:.4f})")

        # 5. Build scored CSV
        scored_csv_bytes = df.to_csv(index=False).encode()

        # 6. Upload scored CSV
        run_prefix = f"exports/{entity_id}/ml/inference/{MODEL_KEY}/{run_id}"
        scored_sha, scored_size = upload_bytes(CONTAINER, f"{run_prefix}/scored.csv", scored_csv_bytes, "text/csv")

        output_doc_id = db_write.insert_document(
            entity_id=entity_id, category="other",
            title=f"{MODEL_KEY} — scored.csv ({period_start} → {period_end})",
            blob_container=CONTAINER, blob_path=f"{run_prefix}/scored.csv",
            content_type="text/csv",
            size_bytes=scored_size, sha256=scored_sha,
            uploaded_by=created_by, linked_type="ml_inference_run",
        )

        # 7. Upsert score rows
        for _, row in df.iterrows():
            features_dict = {k: float(row[k]) if k in df.columns else 0.0
                             for k in feature_spec.get("numeric_features", [])}
            db_write.upsert_daily_score(
                entity_id=entity_id,
                date=str(row["date"]),
                features=features_dict,
                score=float(row["score"]),
                is_anomaly=bool(row["is_anomaly"]),
                threshold=threshold,
                model_id=model_id,
                inference_run_id=run_id,
            )

        summary = {
            "total_rows": len(df),
            "anomaly_count": anomaly_count,
            "threshold": threshold,
            "score_min": float(scores.min()),
            "score_max": float(scores.max()),
            "anomaly_rate": round(anomaly_count / max(len(df), 1), 4),
        }

        db_write.finish_inference_run(
            run_id,
            status="success",
            output_document_id=output_doc_id,
            summary=summary,
        )
        db_write.insert_audit_event(
            entity_id=entity_id, actor=created_by,
            action="ml.inference_completed",
            target_type="ml_inference_run", target_id=run_id,
            after_json={"model_key": MODEL_KEY, "model_id": model_id, **summary},
        )

        log(f"\n✔ Inference complete. {anomaly_count} anomalies in {len(df)} daily rows.")
        print(json.dumps({"run_id": run_id, "anomaly_count": anomaly_count, "status": "success"}))

    except Exception as exc:
        log(f"ERROR: {exc}\n{traceback.format_exc()}")
        db_write.finish_inference_run(run_id, status="failed", error=str(exc))
        db_write.insert_audit_event(
            entity_id=entity_id, actor=created_by,
            action="ml.inference_failed",
            target_type="ml_inference_run", target_id=run_id,
            after_json={"model_key": MODEL_KEY, "error": str(exc)},
        )
        sys.exit(1)


def _load_model_artifact(entity_id: str, model_id: str, local_path: Path):
    """Load model from DB → documents → Blob. Downloads if not cached."""
    import psycopg2, os
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
    blob_path = row[0]
    download_blob("exports", blob_path, local_path)
    return joblib.load(local_path)


def _prepare_daily_features(df: pd.DataFrame, feature_spec: dict) -> pd.DataFrame:
    df = df.copy()
    numeric_features = feature_spec["numeric_features"]
    categorical_features = feature_spec["categorical_features"]
    encoding_maps = feature_spec["encoding_maps"]

    df[numeric_features] = df[numeric_features].fillna(0)
    for col in categorical_features:
        mapping = encoding_maps.get(col, {})
        df[col + "_enc"] = df[col].fillna("unknown").astype(str).map(
            lambda v, m=mapping: m.get(v, 0)  # default to 0 for unseen
        )
    return df


if __name__ == "__main__":
    main()
