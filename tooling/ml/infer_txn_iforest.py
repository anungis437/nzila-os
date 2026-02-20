#!/usr/bin/env python3
"""
tooling/ml/infer_txn_iforest.py

Scores Stripe transaction features using the active transaction IsolationForest (Option B).
Writes scores to ml_scores_stripe_txn (upsert) + uploads scored CSV to Blob.

Usage:
  python tooling/ml/infer_txn_iforest.py \\
    --entity-id <uuid> \\
    --model-id <uuid> \\
    --dataset-blob-path exports/.../dataset.csv \\
    --period-start 2026-01-01 \\
    --period-end 2026-01-31 \\
    [--top-n-anomalies 500] \\
    [--created-by system]

Anomaly volume control:
  Full scored.csv is always written to Blob as the evidence artifact.
  Only --top-n-anomalies highest-score anomalies are upserted to ml_scores_stripe_txn
  (set to 0 for unlimited).

Requires: DATABASE_URL, AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCOUNT_KEY
"""
from __future__ import annotations

import argparse
import json
import sys
import traceback
from pathlib import Path
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from lib.io_blob import download_blob, upload_bytes
from lib import db_write

MODEL_KEY = "stripe_anomaly_txn_iforest_v1"
CONTAINER = "exports"


def log(msg: str) -> None:
    print(f"[{datetime.now(timezone.utc).isoformat()}] {msg}", file=sys.stderr)


def main() -> None:
    parser = argparse.ArgumentParser(description="Infer Stripe transaction anomalies")
    parser.add_argument("--entity-id", required=True)
    parser.add_argument("--model-id", required=True)
    parser.add_argument("--dataset-blob-path", required=True)
    parser.add_argument("--period-start", required=True)
    parser.add_argument("--period-end", required=True)
    parser.add_argument("--top-n-anomalies", type=int, default=500,
                        help="Max anomaly rows to write to DB (0=unlimited). Full CSV always saved.")
    parser.add_argument("--created-by", default="system")
    args = parser.parse_args()

    entity_id = args.entity_id
    model_id = args.model_id
    blob_path = args.dataset_blob_path
    period_start = args.period_start
    period_end = args.period_end
    top_n = args.top_n_anomalies
    created_by = args.created_by

    run_id = db_write.start_inference_run(entity_id, model_id, period_start, period_end)

    try:
        log(f"Inference: {MODEL_KEY} for {entity_id} ({period_start} → {period_end})")

        # 1. Download dataset
        tmp_csv = Path(f"/tmp/ml_txn_infer_{run_id}.csv")
        download_blob(CONTAINER, blob_path, tmp_csv)
        df = pd.read_csv(tmp_csv)
        log(f"Loaded {len(df)} rows")

        # 2. Download model
        tmp_model = Path(f"/tmp/ml_txn_model_{run_id}.joblib")
        model_obj = _load_model_artifact(entity_id, model_id, tmp_model)
        clf = model_obj["clf"]
        scaler = model_obj["scaler"]
        feature_spec = model_obj["feature_spec"]
        threshold = float(model_obj["threshold"])

        # 3. Feature prep
        df_clean = _prepare_txn_features(df, feature_spec)
        all_features = feature_spec["all_features"]
        X_raw = df_clean[all_features].values.astype(float)
        X_scaled = scaler.transform(X_raw)

        # 4. Score
        scores = clf.decision_function(X_scaled)
        df["score"] = scores
        df["is_anomaly"] = scores < threshold
        df["threshold"] = threshold

        anomaly_mask = df["is_anomaly"]
        anomaly_count = int(anomaly_mask.sum())
        log(f"Scored {len(df)} txns, {anomaly_count} anomalies (threshold={threshold:.4f})")

        # 5. Always write full scored CSV to Blob (evidence artifact)
        scored_csv_bytes = df.to_csv(index=False).encode()
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

        # 6. Upsert anomaly rows (top-N or all)
        anomaly_rows = df[anomaly_mask].sort_values("score", ascending=True)  # lowest score = most anomalous
        if top_n > 0:
            anomaly_rows = anomaly_rows.head(top_n)

        log(f"Writing {len(anomaly_rows)} anomaly rows to DB...")
        numeric_features = feature_spec.get("numeric_features", [])
        for _, row in anomaly_rows.iterrows():
            features_dict = {k: float(row[k]) if k in df.columns else 0.0 for k in numeric_features}
            db_write.upsert_txn_score(
                entity_id=entity_id,
                stripe_event_id=row.get("stripe_event_id") or None,
                stripe_charge_id=row.get("stripe_charge_id") or None,
                stripe_payment_intent_id=row.get("stripe_payment_intent_id") or None,
                stripe_balance_txn_id=None,
                occurred_at=str(row["occurred_at"]),
                currency=str(row.get("currency", "cad")),
                amount=float(row.get("amount", 0)),
                features=features_dict,
                score=float(row["score"]),
                is_anomaly=True,
                threshold=threshold,
                model_id=model_id,
                inference_run_id=run_id,
            )

        summary = {
            "total_rows": len(df),
            "anomaly_count": anomaly_count,
            "db_rows_written": len(anomaly_rows),
            "threshold": threshold,
            "score_min": float(scores.min()),
            "score_max": float(scores.max()),
            "anomaly_rate": round(anomaly_count / max(len(df), 1), 4),
            "top_n_limit": top_n,
        }

        db_write.finish_inference_run(
            run_id, status="success",
            output_document_id=output_doc_id,
            summary=summary,
        )
        db_write.insert_audit_event(
            entity_id=entity_id, actor=created_by,
            action="ml.inference_completed",
            target_type="ml_inference_run", target_id=run_id,
            after_json={"model_key": MODEL_KEY, "model_id": model_id, **summary},
        )

        log(f"\n✔ Inference complete. {anomaly_count} anomalies ({len(anomaly_rows)} written to DB).")
        print(json.dumps({
            "run_id": run_id,
            "anomaly_count": anomaly_count,
            "db_rows_written": len(anomaly_rows),
            "status": "success",
        }))

    except Exception as exc:
        log(f"ERROR: {exc}\n{traceback.format_exc()}")
        db_write.finish_inference_run(run_id, status="failed", error=str(exc))
        sys.exit(1)


def _load_model_artifact(entity_id: str, model_id: str, local_path: Path):
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
    download_blob("exports", row[0], local_path)
    return joblib.load(local_path)


def _prepare_txn_features(df: pd.DataFrame, feature_spec: dict) -> pd.DataFrame:
    df = df.copy()
    numeric_features = feature_spec["numeric_features"]
    categorical_features = feature_spec["categorical_features"]
    encoding_maps = feature_spec["encoding_maps"]
    df[numeric_features] = df[numeric_features].fillna(0)
    for col in categorical_features:
        mapping = encoding_maps.get(col, {})
        df[col + "_enc"] = df[col].fillna("unknown").astype(str).map(
            lambda v, m=mapping: m.get(v, 0)
        )
    return df


if __name__ == "__main__":
    main()
