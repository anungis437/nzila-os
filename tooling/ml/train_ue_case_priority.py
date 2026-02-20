#!/usr/bin/env python3
"""
tooling/ml/train_ue_case_priority.py

Trains a multi-class GradientBoostingClassifier on the ue_case_priority_dataset_v1
dataset to predict case priority (low | medium | high | critical).

Steps:
  1.  Download dataset CSV from Blob (path derived from dataset_id in DB)
  2.  Feature engineering + ordinal / one-hot encoding
  3.  Train/val/test split via deterministic split_key column (0-7/8/9)
  4.  Train GradientBoostingClassifier (fixed random_state=42)
  5.  Evaluate on test split — accuracy, macro_f1, confusion matrix,
      per-class precision/recall, optional calibration summary
  6.  Serialise model + feature_spec to model.joblib
  7.  Upload model.joblib + metrics.json + train.log to Blob
  8.  Register mlModels row (status=draft)
  9.  Finish mlTrainingRuns row
  10. Emit audit_events

Usage:
  python tooling/ml/train_ue_case_priority.py \\
    --entity-id <uuid> \\
    --dataset-id <uuid> \\
    --dataset-blob-path exports/.../dataset.csv \\
    [--n-estimators 200] \\
    [--max-depth 4] \\
    [--learning-rate 0.1] \\
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
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    confusion_matrix,
    precision_score,
    recall_score,
)
from sklearn.preprocessing import LabelEncoder, OrdinalEncoder

sys.path.insert(0, str(Path(__file__).parent))
from lib.io_blob import download_blob, upload_bytes
from lib.metrics import build_supervised_multiclass_metrics, to_json
from lib import db_write

MODEL_KEY = "ue.case_priority_v1"
DATASET_KEY = "ue_case_priority_dataset_v1"
CONTAINER = "exports"
RANDOM_STATE = 42

# Features used at train time (same order as inference)
CATEGORICAL_FEATURES = ["category", "channel", "currentStatus", "assignedQueue"]
NUMERIC_FEATURES = [
    "reopenCount",
    "messageCount",
    "attachmentCount",
    "dayOfWeek",
    "hourOfDay",
    "ageHoursAtSnapshot",
]

log_lines: list[str] = []


def log(msg: str) -> None:
    ts = datetime.now(timezone.utc).isoformat()
    line = f"[{ts}] {msg}"
    print(line, file=sys.stderr)
    log_lines.append(line)


def main() -> None:
    parser = argparse.ArgumentParser(description="Train UE case priority classifier")
    parser.add_argument("--entity-id", required=True)
    parser.add_argument("--dataset-id", required=True)
    parser.add_argument("--dataset-blob-path", required=True)
    parser.add_argument("--n-estimators", type=int, default=200)
    parser.add_argument("--max-depth", type=int, default=4)
    parser.add_argument("--learning-rate", type=float, default=0.1)
    parser.add_argument("--version", type=int, default=1)
    parser.add_argument("--created-by", default="system")
    args = parser.parse_args()

    entity_id = args.entity_id
    dataset_id = args.dataset_id
    blob_path = args.dataset_blob_path
    version = args.version
    created_by = args.created_by

    run_id = db_write.start_training_run(entity_id, MODEL_KEY, dataset_id)
    db_write.insert_audit_event(
        entity_id=entity_id,
        actor=created_by,
        action="ml.training_started",
        target_type="ml_training_run",
        target_id=run_id,
        after_json={"modelKey": MODEL_KEY, "datasetId": dataset_id, "version": version},
    )

    try:
        log(f"Training {MODEL_KEY} v{version} for entity {entity_id}")
        log(f"Dataset blob: {blob_path}")

        # ── 1. Download dataset ───────────────────────────────────────────────
        tmp_csv = Path(f"/tmp/ue_priority_{run_id}.csv")
        dataset_sha256 = download_blob(CONTAINER, blob_path, tmp_csv)
        log(f"Dataset sha256: {dataset_sha256}")

        # ── 2. Load + validate ────────────────────────────────────────────────
        df = pd.read_csv(tmp_csv)
        log(f"Loaded {len(df)} rows, {df.shape[1]} columns")

        required_cols = CATEGORICAL_FEATURES + NUMERIC_FEATURES + ["y_priority", "split_key"]
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            raise ValueError(f"Dataset is missing columns: {missing}")

        df[NUMERIC_FEATURES] = df[NUMERIC_FEATURES].fillna(0)
        for col in CATEGORICAL_FEATURES:
            df[col] = df[col].fillna("unknown").str.lower().str.strip()
        df["y_priority"] = df["y_priority"].str.lower().str.strip()

        # ── 3. Deterministic split ────────────────────────────────────────────
        train_df = df[df["split_key"] <= 7].copy()
        val_df   = df[df["split_key"] == 8].copy()
        test_df  = df[df["split_key"] == 9].copy()
        log(f"Split: train={len(train_df)}, val={len(val_df)}, test={len(test_df)}")

        if len(train_df) == 0:
            raise ValueError("Train split is empty. Dataset too small.")
        if len(test_df) == 0:
            raise ValueError("Test split is empty; cannot evaluate. Dataset too small.")

        # ── 4. Encode categoricals ────────────────────────────────────────────
        # Use OrdinalEncoder fitted only on training split
        enc = OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)
        enc.fit(train_df[CATEGORICAL_FEATURES])

        encoding_maps: dict[str, dict[str, int]] = {}
        for i, col in enumerate(CATEGORICAL_FEATURES):
            encoding_maps[col] = {
                str(cat): int(idx)
                for idx, cat in enumerate(enc.categories_[i])
            }

        def transform_X(frame: pd.DataFrame) -> np.ndarray:
            cat_enc = enc.transform(frame[CATEGORICAL_FEATURES])
            num = frame[NUMERIC_FEATURES].values.astype(float)
            return np.hstack([num, cat_enc])

        X_train = transform_X(train_df)
        X_val   = transform_X(val_df)
        X_test  = transform_X(test_df)

        # ── 5. Encode target label ────────────────────────────────────────────
        label_enc = LabelEncoder()
        label_enc.fit(train_df["y_priority"])
        classes = list(label_enc.classes_)
        log(f"Classes: {classes}")

        # ── Label cardinality + class balance ─────────────────────────────────
        # Log counts and percentages so we can detect majority-class collapse
        # (e.g. model always predicts "medium") before it reaches production.
        class_counts_series = train_df["y_priority"].value_counts()
        total_train_n = len(train_df)
        class_balance_train: dict[str, dict] = {}
        log(f"Label cardinality: {len(classes)} classes (train split)")
        for cls in classes:
            cnt = int(class_counts_series.get(cls, 0))
            pct = round(100.0 * cnt / total_train_n, 1) if total_train_n > 0 else 0.0
            class_balance_train[cls] = {"count": cnt, "pct": pct}
            log(f"  {cls}: {cnt} rows ({pct}%)")
        if class_balance_train:
            minority_pct = min(v["pct"] for v in class_balance_train.values())
            if minority_pct < 5.0:
                log(
                    f"WARNING: minority class at {minority_pct:.1f}% — model may collapse "
                    f"to majority class. Consider oversampling or class_weight balancing."
                )

        y_train = label_enc.transform(train_df["y_priority"])
        y_test  = label_enc.transform(
            test_df["y_priority"].map(
                lambda x: x if x in label_enc.classes_ else label_enc.classes_[0]
            )
        )

        # ── 6. Train ──────────────────────────────────────────────────────────
        hyperparams = {
            "n_estimators": args.n_estimators,
            "max_depth": args.max_depth,
            "learning_rate": args.learning_rate,
            "random_state": RANDOM_STATE,
            "subsample": 0.8,
        }
        log(f"Training GradientBoostingClassifier: {hyperparams}")
        clf = GradientBoostingClassifier(**hyperparams)
        clf.fit(X_train, y_train)
        log("Training complete")

        # Val accuracy (informational)
        if len(val_df) > 0:
            y_val = label_enc.transform(
                val_df["y_priority"].map(
                    lambda x: x if x in label_enc.classes_ else label_enc.classes_[0]
                )
            )
            val_acc = accuracy_score(y_val, clf.predict(X_val))
            log(f"Val accuracy: {val_acc:.4f}")

        # ── 7. Test evaluation ────────────────────────────────────────────────
        y_pred = clf.predict(X_test)
        test_acc   = float(accuracy_score(y_test, y_pred))
        test_mf1   = float(f1_score(y_test, y_pred, average="macro", zero_division=0))
        cm         = confusion_matrix(y_test, y_pred, labels=list(range(len(classes)))).tolist()
        per_prec   = precision_score(y_test, y_pred, average=None, labels=list(range(len(classes))), zero_division=0)
        per_rec    = recall_score(y_test, y_pred, average=None, labels=list(range(len(classes))), zero_division=0)
        per_f1     = f1_score(y_test, y_pred, average=None, labels=list(range(len(classes))), zero_division=0)

        log(f"Test accuracy: {test_acc:.4f}, macro_f1: {test_mf1:.4f}")
        for i, cls in enumerate(classes):
            log(f"  {cls}: precision={per_prec[i]:.3f} recall={per_rec[i]:.3f} f1={per_f1[i]:.3f}")

        # Calibration summary (optional — mean predicted prob for true positive rows)
        proba_test = clf.predict_proba(X_test)
        calibration_summary = {
            "mean_max_prob_correct": float(np.mean(proba_test[np.arange(len(y_test)), y_test])),
            "mean_max_prob_incorrect": float(
                np.mean(proba_test[np.arange(len(y_test))[y_pred != y_test], y_pred[y_pred != y_test]])
            ) if (y_pred != y_test).any() else None,
        }

        # ── 8. Feature spec ───────────────────────────────────────────────────
        all_features = NUMERIC_FEATURES + CATEGORICAL_FEATURES
        feature_spec = {
            "numeric_features": NUMERIC_FEATURES,
            "categorical_features": CATEGORICAL_FEATURES,
            "all_features": all_features,
            "encoding_maps": encoding_maps,
            "label_classes": classes,
            "label_encoder_classes": classes,
        }

        # ── 9. Serialise artifacts ────────────────────────────────────────────
        model_obj = {
            "clf": clf,
            "ordinal_encoder": enc,
            "label_encoder": label_enc,
            "feature_spec": feature_spec,
            "classes": classes,
        }
        model_bytes_io = io.BytesIO()
        joblib.dump(model_obj, model_bytes_io)
        model_bytes = model_bytes_io.getvalue()

        metrics = build_supervised_multiclass_metrics(
            model_key=MODEL_KEY,
            algorithm="gradient_boosting_classifier",
            dataset_sha256=dataset_sha256,
            dataset_key=DATASET_KEY,
            period_start="",
            period_end="",
            n_train=len(train_df),
            n_val=len(val_df),
            n_test=len(test_df),
            feature_names=all_features,
            classes=classes,
            accuracy=test_acc,
            macro_f1=test_mf1,
            confusion_matrix=cm,
            per_class_precision={c: float(per_prec[i]) for i, c in enumerate(classes)},
            per_class_recall={c: float(per_rec[i]) for i, c in enumerate(classes)},
            per_class_f1={c: float(per_f1[i]) for i, c in enumerate(classes)},
            hyperparams=hyperparams,
            feature_spec=feature_spec,
            calibration_summary=calibration_summary,
        )
        metrics_json_bytes = to_json(metrics).encode()
        log_bytes = "\n".join(log_lines).encode()

        # ── 10. Upload to Blob ────────────────────────────────────────────────
        run_blob_prefix = f"exports/{entity_id}/ml/models/{MODEL_KEY}/{run_id}"
        model_sha, model_size = upload_bytes(CONTAINER, f"{run_blob_prefix}/model.joblib", model_bytes)
        metrics_sha, metrics_size = upload_bytes(CONTAINER, f"{run_blob_prefix}/metrics.json", metrics_json_bytes, "application/json")
        log_sha, log_size = upload_bytes(CONTAINER, f"{run_blob_prefix}/train.log", log_bytes, "text/plain")

        # ── 11. Register documents ────────────────────────────────────────────
        artifact_doc_id = db_write.insert_document(
            entity_id=entity_id,
            category="other",
            title=f"UE Priority Model v{version} — model.joblib ({MODEL_KEY})",
            blob_container=CONTAINER,
            blob_path=f"{run_blob_prefix}/model.joblib",
            content_type="application/octet-stream",
            size_bytes=model_size,
            sha256=model_sha,
            uploaded_by=created_by,
            linked_type="ml_model_artifact",
        )
        metrics_doc_id = db_write.insert_document(
            entity_id=entity_id,
            category="other",
            title=f"UE Priority Model v{version} — metrics.json ({MODEL_KEY})",
            blob_container=CONTAINER,
            blob_path=f"{run_blob_prefix}/metrics.json",
            content_type="application/json",
            size_bytes=metrics_size,
            sha256=metrics_sha,
            uploaded_by=created_by,
            linked_type="ml_metrics",
        )
        logs_doc_id = db_write.insert_document(
            entity_id=entity_id,
            category="other",
            title=f"UE Priority Model v{version} — train.log ({MODEL_KEY})",
            blob_container=CONTAINER,
            blob_path=f"{run_blob_prefix}/train.log",
            content_type="text/plain",
            size_bytes=log_size,
            sha256=log_sha,
            uploaded_by=created_by,
            linked_type="ml_training_log",
        )

        # ── 12. Register model (draft) ────────────────────────────────────────
        model_id = db_write.register_model(
            entity_id=entity_id,
            model_key=MODEL_KEY,
            algorithm="gradient_boosting_classifier",
            version=version,
            training_dataset_id=dataset_id,
            artifact_document_id=artifact_doc_id,
            metrics_document_id=metrics_doc_id,
            hyperparams=hyperparams,
            feature_spec=feature_spec,
        )

        # ── 13. Finish training run ───────────────────────────────────────────
        db_write.finish_training_run(
            run_id,
            status="success",
            artifact_document_id=artifact_doc_id,
            metrics_document_id=metrics_doc_id,
            logs_document_id=logs_doc_id,
        )

        db_write.insert_audit_event(
            entity_id=entity_id,
            actor=created_by,
            action="ml.training_completed",
            target_type="ml_training_run",
            target_id=run_id,
            after_json={
                "modelKey": MODEL_KEY,
                "modelId": model_id,
                "status": "success",
                "testAccuracy": test_acc,
                "testMacroF1": test_mf1,
            },
        )
        db_write.insert_audit_event(
            entity_id=entity_id,
            actor=created_by,
            action="ml.model_registered",
            target_type="ml_model",
            target_id=model_id,
            after_json={
                "modelKey": MODEL_KEY,
                "version": version,
                "status": "draft",
                "artifactDocumentId": artifact_doc_id,
                "metricsDocumentId": metrics_doc_id,
            },
        )

        log(f"✔ Model registered: {model_id} (status=draft)")
        log(f"  accuracy={test_acc:.4f}  macro_f1={test_mf1:.4f}")
        log(f"  Promote to active: UPDATE ml_models SET status='active' WHERE id='{model_id}';")

    except Exception as exc:  # noqa: BLE001
        tb = traceback.format_exc()
        log(f"ERROR: {exc}\n{tb}")
        db_write.finish_training_run(run_id, status="failed", error=str(exc))
        db_write.insert_audit_event(
            entity_id=entity_id,
            actor=created_by,
            action="ml.training_failed",
            target_type="ml_training_run",
            target_id=run_id,
            after_json={"modelKey": MODEL_KEY, "error": str(exc)},
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
