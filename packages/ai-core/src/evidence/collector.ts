/**
 * @nzila/ai-core — Evidence Collector
 *
 * High-level API for collecting AI action evidence for evidence packs.
 * Delegates to the evidencePack module and adds convenience methods.
 *
 * This module is the entry point for:
 * - tooling/scripts/generate-evidence-index.ts (--include-ai-actions)
 * - Console evidence pack UI
 * - Programmatic evidence collection
 */
export {
  collectAiActionEvidence,
  type AiActionEvidence,
  type AiActionsEvidenceAppendix,
} from '../actions/evidencePack'
