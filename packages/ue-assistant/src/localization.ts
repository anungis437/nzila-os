/**
 * @nzila/ue-assistant — Language & Localization (Phase 10)
 *
 * Responds in the user's language, prioritizes same-language sources,
 * and allows fallback translation with clear marking.
 */

// ── Supported Languages ─────────────────────────────────────────────────────

export const SupportedLanguages = {
  EN: 'en',
  FR: 'fr',
  ES: 'es',
} as const

export type SupportedLanguage =
  (typeof SupportedLanguages)[keyof typeof SupportedLanguages]

// ── Localized Message Templates ─────────────────────────────────────────────

const MESSAGES: Record<string, Record<SupportedLanguage, string>> = {
  clarification_needed: {
    en: 'I need more information to help you. Could you please clarify your question?',
    fr: 'J\'ai besoin de plus d\'informations pour vous aider. Pourriez-vous préciser votre question?',
    es: 'Necesito más información para ayudarte. ¿Podrías aclarar tu pregunta?',
  },
  escalation_notice: {
    en: 'This matter requires attention from a qualified representative. Escalating now.',
    fr: 'Cette question nécessite l\'attention d\'un représentant qualifié. Escalade en cours.',
    es: 'Este asunto requiere la atención de un representante calificado. Escalando ahora.',
  },
  no_legal_advice: {
    en: 'This information is provided as guidance only and does not constitute legal advice.',
    fr: 'Ces informations sont fournies à titre indicatif uniquement et ne constituent pas un avis juridique.',
    es: 'Esta información se proporciona solo como orientación y no constituye asesoramiento legal.',
  },
  draft_disclaimer: {
    en: 'This is an AI-generated draft. It must be reviewed before submission.',
    fr: 'Ceci est un brouillon généré par l\'IA. Il doit être révisé avant soumission.',
    es: 'Este es un borrador generado por IA. Debe ser revisado antes de su envío.',
  },
  safety_emergency: {
    en: 'If you are in immediate danger, call emergency services immediately.',
    fr: 'Si vous êtes en danger immédiat, appelez les services d\'urgence immédiatement.',
    es: 'Si está en peligro inmediato, llame a los servicios de emergencia de inmediato.',
  },
  fallback_translation_marker: {
    en: '[Translated from source language]',
    fr: '[Traduit de la langue source]',
    es: '[Traducido del idioma original]',
  },
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Check if a language code is supported.
 */
export function isLanguageSupported(language: string): boolean {
  return Object.values(SupportedLanguages).includes(
    language as SupportedLanguage,
  )
}

/**
 * Get the effective language, falling back to English if not supported.
 */
export function resolveLanguage(language: string): SupportedLanguage {
  const normalized = language.toLowerCase().slice(0, 2)
  if (isLanguageSupported(normalized)) return normalized as SupportedLanguage
  return SupportedLanguages.EN
}

/**
 * Get a localized message by key and language.
 */
export function getLocalizedMessage(
  key: string,
  language: string,
): string {
  const resolved = resolveLanguage(language)
  const messages = MESSAGES[key]
  if (!messages) return key
  return messages[resolved] ?? messages[SupportedLanguages.EN] ?? key
}

/**
 * Mark content as a fallback translation.
 */
export function markAsFallbackTranslation(
  content: string,
  language: string,
): string {
  const marker = getLocalizedMessage('fallback_translation_marker', language)
  return `${marker} ${content}`
}

/**
 * Get all supported language codes.
 */
export function getSupportedLanguages(): readonly string[] {
  return Object.values(SupportedLanguages)
}
