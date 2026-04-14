/**
 * NACP useExamBoardCompliance Hook
 *
 * React hook for using exam board compliance validators in NACP forms and components.
 * Provides real-time validation and compliance checking.
 *
 * @module hooks/useExamBoardCompliance
 */

'use client'

import { useMemo } from 'react'
import {
  getExamPolicy,
  validateExamGrade,
  isSupportedExamType,
  checkCertificateExpiry,
  getAppealDeadline,
  canAttemptExam,
  validateExamineeRecord,
} from '@/lib/compliance/exam-board-validator'

interface UseExamBoardComplianceOptions {
  jurisdiction: string
  examType: string
}

interface ComplianceState {
  jurisdiction: string
  examType: string
  examBoard: { name: string } | null
  isSupported: boolean
  minimumGrade: number
  maxAttempts: number
  certificateValidityYears: number
  appealDeadlineDays: number
}

/**
 * Hook for exam board compliance checking in NACP frontend.
 *
 * @param options - jurisdiction and examType
 * @returns compliance state and validation functions
 *
 * @example
 * const {
 *   isSupported,
 *   minimumGrade,
 *   maxAttempts,
 *   validateGrade,
 *   canTakeExam,
 * } = useExamBoardCompliance({
 *   jurisdiction: 'KE',
 *   examType: 'apprenticeship',
 * })
 */
export function useExamBoardCompliance(options: UseExamBoardComplianceOptions) {
  const { jurisdiction, examType } = options

  const state: ComplianceState = useMemo(() => {
    try {
      const policy = getExamPolicy(jurisdiction)
      const isSupported = isSupportedExamType(examType, jurisdiction)

      if (!isSupported) {
        return {
          jurisdiction,
          examType,
          examBoard: null,
          isSupported: false,
          minimumGrade: 0,
          maxAttempts: 0,
          certificateValidityYears: 0,
          appealDeadlineDays: 0,
        }
      }

      // Find applicable board
      const board = policy.examBoards.find((b) => b.examTypes.includes(examType))

      return {
        jurisdiction,
        examType,
        examBoard: board ? { name: board.name } : null,
        isSupported: true,
        minimumGrade: board?.minimumPassingGrade ?? 60,
        maxAttempts: board?.maxAttempts ?? 3,
        certificateValidityYears: board?.certificateValidityYears ?? 3,
        appealDeadlineDays: board?.appealDeadlineDays ?? 30,
      }
    } catch {
      return {
        jurisdiction,
        examType,
        examBoard: null,
        isSupported: false,
        minimumGrade: 0,
        maxAttempts: 0,
        certificateValidityYears: 0,
        appealDeadlineDays: 0,
      }
    }
  }, [jurisdiction, examType])

  const validateGrade = (grade: number): { valid: boolean; error?: string } => {
    return validateExamGrade(grade, examType, jurisdiction)
  }

  const checkCertValidity = (
    issuedDate: Date
  ): { expired: boolean; expiryDate: Date; daysRemaining: number } => {
    return checkCertificateExpiry(issuedDate, jurisdiction, examType)
  }

  const getAppealDue = (resultDate: Date): { appealDeadline: Date; daysRemaining: number } => {
    return getAppealDeadline(resultDate, jurisdiction, examType)
  }

  const canTakeExam = (attemptCount: number): { canAttempt: boolean; attemptLimit: number } => {
    return canAttemptExam(attemptCount, examType, jurisdiction)
  }

  const validateFullRecord = (examineeData: {
    grade: number
    attemptCount: number
    certificateIssuedDate?: Date
  }): { compliant: boolean; errors: string[] } => {
    return validateExamineeRecord(
      {
        ...examineeData,
        examType,
      },
      jurisdiction
    )
  }

  return {
    // State
    state,
    isSupported: state.isSupported,
    minimumGrade: state.minimumGrade,
    maxAttempts: state.maxAttempts,
    certificateValidityYears: state.certificateValidityYears,
    appealDeadlineDays: state.appealDeadlineDays,
    examBoard: state.examBoard,

    // Validators
    validateGrade,
    checkCertValidity,
    getAppealDue,
    canTakeExam,
    validateFullRecord,
  }
}
