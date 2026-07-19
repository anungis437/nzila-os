# UE AI Monitoring Plan

Owner: UE Lead
Last updated: 2026-06-08
Scope: union-eyes-triage

## SLOs

1. Availability: >= 99.9% monthly for UE AI routes.
2. Latency: P95 <= 2000ms, P99 <= 3000ms.
3. Error rate: <= 1% 5-minute rolling window.
4. Refusal correctness: >= 98% on eval suite.
5. Cost: <= configured daily and monthly budget thresholds.

## Alert Policy

1. Page oncall for P95 latency or error breach beyond 10 minutes.
2. Ticket-only alert for cost trend > 80% of daily budget.
3. Security page for prompt-injection and exfiltration signals.

## Review Cadence

1. Daily 7-day trend review for first 30 days post-release.
2. Weekly reliability and quality review thereafter.
3. Monthly AIGC governance checkpoint with evidence pack.
