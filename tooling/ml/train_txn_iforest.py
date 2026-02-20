#!/usr/bin/env python3
"""
tooling/ml/train_txn_iforest.py

Trains an IsolationForest on the stripe_txn_features_v1 dataset (Option B).

Same structure as train_daily_iforest.py but uses transaction-level features
including rolling robust z-scores.

Usage:
  python tooling/ml/train_txn_iforest.py \\
    --entity-id <uuid> \\
    --dataset-id <uuid> \\
    --dataset-blob-path exports/.../dataset.csv \\
    [--contamination 0.02] \\
    [--n-estimators 200] \\
    [--version 1] \\
    [--created-by system]

Requires: DATABASE_URL, AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCOUNT_KEY
"""
from __future__ import annotations

import argparse
import io
import json
import sys
import traceback
from pathlib import Path
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import LabelEncoder, StandardScaler

sys.path.insert(0, str(Path(__file__).parent))
from lib.io_blob import download_blob, upload_bytes
from lib.metrics import build_training_metrics, to_json
from lib.thresholds import percentile_threshold
from lib import db_write

MODEL_KEY = "stripe_anomaly_txn_iforest_v1"
CONTAINER = "exports"

NUMERIC_FEATURES = [
    "amount_abs",
    "amount_log1p",
    "hour_of_day",
    "day_of_week",
    "median_amount_30d",
    "mad_amount_30d",
    "z_robust_amount_30d",
    "is_refund",
    "is_dispute",
]
CATEGORICAL_FEATURES = ["currency", "payment_method_type"]

log_lines: list[str] = []


def log(msg: str) -> None:
    ts = datetime.now(timezone.utc).isoformat()
    line = f"[{ts}] {msg}"
    print(line, file=sys.stderr)
    log_lines.append(line)


def main() -> None:
    parser = argparse.ArgumentParser(description="Train Stripe transaction IsolationForest")
    parser.add_argument("--entity-id", required=True)
    parser.add_argument("--dataset-id", required=True)
    parser.add_argument("--dataset-blob-path", required=True)
    parser.add_argument("--contamination", type=float, default=0.02)
    parser.add_argument("--n-estimators", type=int, default=200)
    parser.add_argument("--version", type=int, default=1)
    parser.add_argument("--created-by", default="system")
    args = parser.parse_args()

    entity_id = args.entity_id
    dataset_id = args.dataset_id
    blob_path = args.dataset_blob_path
    contamination = args.contamination
    n_estimators = args.n_estimators
    version = args.version
    created_by = args.created_by

    run_id = db_write.start_training_run(entity_id, MODEL_KEY, dataset_id)

    try:
        log(f"Training {MODEL_KEY} v{version} for entity {entity_id}")
        log(f"Dataset: {blob_path}")

        # 1. Download
        tmp_csv = Path(f"/tmp/ml_txn_{run_id}.csv")
        dataset_sha256 = download_blob(CONTAINER, blob_path, tmp_csv)

        # 2. Load + clean
        df = pd.read_csv(tmp_csv)
        log(f"Loaded {len(df)} rows, {df.shape[1]} columns")

        df[NUMERIC_FEATURES] = df[NUMERIC_FEATURES].fillna(0)
        df["currency"] = df["currency"].fillna("cad").str.lower()
        df["payment_method_type"] = df["payment_method_type"].fillna("unknown").str.lower()

        # 3. Encode categoricals (label encoding; low cardinality expected)
        encoding_maps: dict[str, dict[str, int]] = {}
        enc_features = []
        for col in CATEGORICAL_FEATURES:
            le = LabelEncoder()
            df[col + "_enc"] = le.fit_transform(df[col].astype(str))
            encoding_maps[col] = {cls: int(i) for i, cls in enumerate(le.classes_)}
            enc_features.append(col + "_enc")

        all_features = NUMERIC_FEATURES + enc_features
        X_raw = df[all_features].values.astype(float)

        # 4. Scale
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X_raw)
        scaler_params = {
            f: {"mean": float(scaler.mean_[i]), "std": float(scaler.scale_[i])}
            for i, f in enumerate(all_features)
        }

        # 5. Train
        hyperparams = {
            "n_estimators": n_estimators,
            "contamination": "auto",
            "random_state": 42,
            "max_samples": min(256, len(df)),
        }
        log(f"Training IsolationForest: {hyperparams}")
        clf = IsolationForest(
            n_estimators=n_estimators,
            contamination="auto",
            random_state=42,
            max_samples=hyperparams["max_samples"],
        )
        clf.fit(X_scaled)

        # 6. Scores + threshold
        scores = clf.decision_function(X_scaled)
        threshold = percentile_threshold(scores, contamination)
        anomaly_count = int((scores < threshold).sum())
        log(f"Score range: [{scores.min():.4f}, {scores.max():.4f}], threshold: {threshold:.4f}")
        log(f"Train anomalies: {anomaly_count}/{len(scores)} ({100*anomaly_count/len(scores):.1f}%)")

        # 7. Feature spec
        feature_spec = {
            "numeric_features": NUMERIC_FEATURES,
            "categorical_features": CATEGORICAL_FEATURES,
            "encoded_features": enc_features,
            "all_features": all_features,
            "encoding_maps": encoding_maps,
            "scaler_params": scaler_params,
        }

        # 8. Serialise
        model_obj = {"clf": clf, "scaler": scaler, "feature_spec": feature_spec, "threshold": threshold}
        buf = io.BytesIO()
        joblib.dump(model_obj, buf)
        model_bytes = buf.getvalue()

        metrics = build_training_metrics(
            model_key=MODEL_KEY,
            dataset_sha256=dataset_sha256,
            dataset_key="stripe_txn_features_v1",
            period_start="",
            period_end="",
            n_train=len(df),
            feature_names=all_features,
            scores=scores,
            threshold=threshold,
            hyperparams=hyperparams,
            feature_spec=feature_spec,
        )
        metrics_json_bytes = to_json(metrics).encode()
        log_bytes = "\n".join(log_lines).encode()

        # 9. Upload
        run_blob_prefix = f"exports/{entity_id}/ml/models/{MODEL_KEY}/{run_id}"
        model_sha, model_size = upload_bytes(CONTAINER, f"{run_blob_prefix}/model.joblib", model_bytes, "application/octet-stream")
        metrics_sha, metrics_size = upload_bytes(CONTAINER, f"{run_blob_prefix}/metrics.json", metrics_json_bytes, "application/json")
        log_sha, log_size = upload_bytes(CONTAINER, f"{run_blob_prefix}/train.log", log_bytes, "text/plain")

        artifact_doc_id = db_write.insert_document(
            entity_id=entity_id, category="other",
            title=f"{MODEL_KEY} v{version} — model.joblib",
            blob_container=CONTAINER, blob_path=f"{run_blob_prefix}/model.joblib",
            content_type="application/octet-stream",
            size_bytes=model_size, sha256=model_sha,
            uploaded_by=created_by, linked_type="ml_model",
        )
        metrics_doc_id = db_write.insert_document(
            entity_id=entity_id, category="other",
            title=f"{MODEL_KEY} v{version} — metrics.json",
            blob_container=CONTAINER, blob_path=f"{run_blob_prefix}/metrics.json",
            content_type="application/json",
            size_bytes=metrics_size, sha256=metrics_sha,
            uploaded_by=created_by, linked_type="ml_model",
        )
        logs_doc_id = db_write.insert_document(
            entity_id=entity_id, category="other",
            title=f"{MODEL_KEY} v{version} — train.log",
            blob_container=CONTAINER, blob_path=f"{run_blob_prefix}/train.log",
            content_type="text/plain",
            size_bytes=log_size, sha256=log_sha,
            uploaded_by=created_by, linked_type="ml_training_run",
        )

        model_id = db_write.register_model(
            entity_id=entity_id,
            model_key=MODEL_KEY,
            algorithm="isolation_forest",
            version=version,
            training_dataset_id=dataset_id,
            artifact_document_id=artifact_doc_id,
            metrics_document_id=metrics_doc_id,
            hyperparams=hyperparams,
            feature_spec=feature_spec,
        )

        db_write.finish_training_run(
            run_id, status="success",
            artifact_document_id=artifact_doc_id,
            metrics_document_id=metrics_doc_id,
            logs_document_id=logs_doc_id,
        )
        db_write.insert_audit_event(
            entity_id=entity_id, actor=created_by,
            action="ml.training_completed",
            target_type="ml_model", target_id=model_id,
            after_json={
                "model_key": MODEL_KEY, "version": version,
                "run_id": run_id, "artifact_sha256": model_sha,
                "n_train": len(df), "threshold": threshold,
            },
        )

        log(f"\n✔ Training complete. Model ID: {model_id} (status=draft)")
        print(json.dumps({"model_id": model_id, "run_id": run_id, "status": "success"}))

    except Exception as exc:
        tb = traceback.format_exc()
        log(f"ERROR: {exc}\n{tb}")
        db_write.finish_training_run(run_id, status="failed", error=str(exc))
        sys.exit(1)


if __name__ == "__main__":
    main()
