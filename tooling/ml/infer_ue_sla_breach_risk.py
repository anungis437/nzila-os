#!/usr/bin/env python3
"""
tooling/ml/infer_ue_sla_breach_risk.py

Scores UE cases using the active ue.sla_breach_risk_v1 model.
Writes per-case SLA breach probability to ml_scores_ue_sla_risk and
uploads a scored CSV to Blob.

Steps:
  1. Resolve active model (or use --model-id)
  2. Download model.joblib artifact from Blob
  3. Query ue_cases for the period
  4. Apply feature engineering + encoding
  5. Predict P(breach) via predict_proba
  6. Apply stored threshold → predictedBreach boolean
  7. Optionally snapshot actualBreach from sla_breached field
  8. Upsert into ml_scores_ue_sla_risk
  9. Upload scored.csv to Blob
  10. Finish mlInferenceRuns row + audit_event

Usage:
  python tooling/ml/infer_ue_sla_breach_risk.py \\
    --entity-id <uuid> \\
    --model-id <uuid>        # OR omit to use the active model \\
    --period-start 2026-01-01 \\
    --period-end 2026-01-31 \\
    [--threshold-override 0.45]  # override stored threshold if needed \\
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

MODEL_KEY = "ue.sla_breach_risk_v1"
CONTAINER = "exports"


def log(msg: str) -> None:
    print(f"[{datetime.now(timezone.utc).isoformat()}] {msg}", file=sys.stderr)


def resolve_model_id(entity_id: str, model_key: str) -> str:
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
              sla_breached                    AS actual_breach,
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
    parser = argparse.ArgumentParser(description="Infer UE SLA breach risk scores")
    parser.add_argument("--entity-id", required=True)
    parser.add_argument("--model-id", default=None)
    parser.add_argument("--period-start", required=True)
    parser.add_argument("--period-end", required=True)
    parser.add_argument("--threshold-override", type=float, default=None,
                        help="Override the stored decision threshold (optional)")
    parser.add_argument("--created-by", default="system")
    args = parser.parse_args()

    entity_id = args.entity_id
    period_start = args.period_start
    period_end = args.period_end
    created_by = args.created_by

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
        tmp_model = Path(f"/tmp/ue_sla_model_{run_id}.joblib")
        model_obj = load_model_artifact(entity_id, model_id, tmp_model)
        clf = model_obj["clf"]
        stored_threshold = float(model_obj["threshold"])
        threshold = args.threshold_override if args.threshold_override is not None else stored_threshold

        if args.threshold_override is not None:
            log(f"Threshold override applied: {stored_threshold:.4f} → {threshold:.4f}")
        else:
            log(f"Using stored threshold: {threshold:.4f}")

        # ── Load cases ───────────────────────────────────────────────────────
        df = fetch_ue_cases(entity_id, period_start, period_end)
        log(f"Fetched {len(df)} UE case rows")

        if len(df) == 0:
            log("No cases found for period.")
            db_write.finish_inference_run(run_id, status="success",
                                           summary={"total_rows": 0, "period": f"{period_start}/{period_end}"})
            return

        # ── Build features + predict ─────────────────────────────────────────
        X = build_X(df, model_obj)
        probas = clf.predict_proba(X)[:, 1]           # P(breach)
        predicted_breach = (probas >= threshold).astype(bool)

        df["probability"] = probas
        df["predicted_breach"] = predicted_breach

        breach_count = int(predicted_breach.sum())
        log(f"Scored {len(df)} rows, {breach_count} predicted breaches at threshold {threshold:.4f}")

        # ── Build scored CSV ─────────────────────────────────────────────────
        output_cols = ["case_id", "probability", "predicted_breach", "actual_breach", "created_at"]
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
            actual_breach_val = None
            if "actual_breach" in df.columns and pd.notna(row.get("actual_breach")):
                actual_breach_val = bool(row["actual_breach"])

            db_write.upsert_ue_sla_risk_score(
                entity_id=entity_id,
                case_id=str(row["case_id"]),
                occurred_at=now_ts,
                probability=float(row["probability"]),
                predicted_breach=bool(row["predicted_breach"]),
                actual_breach=actual_breach_val,
                features=features_safe,
                model_id=model_id,
                inference_run_id=run_id,
            )
            upsert_count += 1

        log(f"Upserted {upsert_count} SLA risk score rows")

        # ── Summary ──────────────────────────────────────────────────────────
        summary = {
            "total_rows": len(df),
            "predicted_breach_count": breach_count,
            "breach_rate": round(breach_count / max(len(df), 1), 4),
            "threshold_used": float(threshold),
            "prob_mean": float(probas.mean()),
            "prob_p90": float(np.percentile(probas, 90)),
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

        log(f"\n✔ Inference complete. {breach_count} SLA risk scores written.")
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
