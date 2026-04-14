/**
 * NACP Exam Board Compliance Module
 *
 * Provides jurisdiction-specific exam board requirements, certificate validity,
 * and examinee record validation for the NACP (National Apprenticeship Competency Platform).
 *
 * Used for:
 * - Validating exam attempt counts and certificate validity
 * - Enforcing exam board-specific passing grades and appeal deadlines
 * - Checking certificate expiry and renewal requirements
 *
 * @module lib/compliance/exam-board-validator
 */

import {
  getPolicy as getJurisdictionPolicy,
  isSupportedJurisdiction,
} from '../../../../packages/platform-jurisdiction-compliance/src/policies'

interface ExamBoard {
  name: string
  examTypes: string[]
  certificateValidityYears: number
  appealDeadlineDays: number
  minimumPassingGrade?: number
  maxAttempts?: number
}

interface ExamPolicy {
  name: string
  examBoards: ExamBoard[]
  currency: string
}

const fallbackExamPolicies: Record<string, ExamPolicy> = {
  KE: {
    name: 'Kenya',
    examBoards: [
      {
        name: 'NITA',
        examTypes: ['apprenticeship', 'competency', 'advanced_craft'],
        certificateValidityYears: 3,
        appealDeadlineDays: 30,
        minimumPassingGrade: 65,
        maxAttempts: 3,
      },
    ],
    currency: 'KES',
  },
  UG: {
    name: 'Uganda',
    examBoards: [
      {
        name: 'UNEB',
        examTypes: ['apprenticeship', 'competency', 'skills_certification'],
        certificateValidityYears: 5,
        appealDeadlineDays: 45,
        minimumPassingGrade: 50,
        maxAttempts: 3,
      },
      {
        name: 'NBTVE',
        examTypes: ['competency', 'advanced_craft'],
        certificateValidityYears: 5,
        appealDeadlineDays: 45,
        minimumPassingGrade: 50,
        maxAttempts: 3,
      },
    ],
    currency: 'UGX',
  },
  NG: {
    name: 'Nigeria',
    examBoards: [
      {
        name: 'NABTEB',
        examTypes: ['apprenticeship', 'national_diploma', 'advanced_diploma'],
        certificateValidityYears: 3,
        appealDeadlineDays: 14,
        minimumPassingGrade: 60,
        maxAttempts: 2,
      },
      {
        name: 'NBTE',
        examTypes: ['national_diploma', 'advanced_diploma'],
        certificateValidityYears: 5,
        appealDeadlineDays: 21,
        minimumPassingGrade: 60,
        maxAttempts: 3,
      },
    ],
    currency: 'NGN',
  },
}

function buildPolicyFromShared(jurisdiction: string): ExamPolicy {
  const shared = getJurisdictionPolicy(jurisdiction)
  const fallback = fallbackExamPolicies[jurisdiction]

  const examBoards: ExamBoard[] = shared.examBoards.map((board) => {
    const fallbackBoard = fallback?.examBoards.find(
      (b) => b.name === board.name || b.examTypes.some((t) => board.examTypes.includes(t))
    )

    return {
      name: board.name,
      examTypes: [...board.examTypes],
      certificateValidityYears: board.certificateValidityYears,
      appealDeadlineDays: board.appealDeadlineDays,
      minimumPassingGrade: fallbackBoard?.minimumPassingGrade ?? 60,
      maxAttempts: fallbackBoard?.maxAttempts ?? 3,
    }
  })

  return {
    name: shared.name,
    examBoards,
    currency: shared.currency,
  }
}

/**
 * Get exam policy for a jurisdiction.
 * @param jurisdiction - Code like 'KE', 'UG', 'NG'
 * @returns Policy object with exam boards
 * @throws Error if jurisdiction not found
 */
export function getExamPolicy(jurisdiction: string): ExamPolicy {
  if (isSupportedJurisdiction(jurisdiction)) {
    return buildPolicyFromShared(jurisdiction)
  }

  if (!(jurisdiction in fallbackExamPolicies)) {
    throw new Error(
      `Policy not found for jurisdiction: ${jurisdiction}. Supported: ${Object.keys(fallbackExamPolicies).join(', ')}`
    )
  }
  return fallbackExamPolicies[jurisdiction]
}

/**
 * Get exam board by name and jurisdiction.
 * @param jurisdiction - Code like 'KE', 'UG', 'NG'
 * @param boardName - Board name like 'NITA', 'UNEB', 'NABTEB'
 * @returns ExamBoard object
 * @throws Error if board not found
 */
export function getExamBoard(jurisdiction: string, boardName: string): ExamBoard {
  const policy = getExamPolicy(jurisdiction)
  const board = policy.examBoards.find((b) => b.name === boardName)
  if (!board) {
    throw new Error(
      `Exam board '${boardName}' not found in ${jurisdiction}. Available: ${policy.examBoards.map((b) => b.name).join(', ')}`
    )
  }
  return board
}

/**
 * Validate exam grade against jurisdiction and exam type requirements.
 * @param grade - Numeric grade (0-100)
 * @param examType - Type like 'apprenticeship', 'national_diploma'
 * @param jurisdiction - Code like 'KE', 'UG', 'NG'
 * @returns { valid: boolean, error?: string }
 */
export function validateExamGrade(
  grade: number,
  examType: string,
  jurisdiction: string
): { valid: boolean; error?: string } {
  if (grade < 0 || grade > 100) {
    return { valid: false, error: 'Grade must be between 0 and 100' }
  }

  try {
    const policy = getExamPolicy(jurisdiction)

    // Find minimum passing grade from applicable boards
    let minPassingGrade = 60
    for (const board of policy.examBoards) {
      if (board.examTypes.includes(examType)) {
        minPassingGrade = Math.max(minPassingGrade, board.minimumPassingGrade ?? 60)
      }
    }

    if (grade < minPassingGrade) {
      return {
        valid: false,
        error: `Minimum passing grade for ${examType} in ${jurisdiction}: ${minPassingGrade}`,
      }
    }

    return { valid: true }
  } catch (error) {
    return { valid: false, error: (error as Error).message }
  }
}

/**
 * Check if exam type is supported in jurisdiction.
 * @param examType - Type like 'apprenticeship', 'competency'
 * @param jurisdiction - Code like 'KE', 'UG', 'NG'
 * @returns true if supported
 */
export function isSupportedExamType(examType: string, jurisdiction: string): boolean {
  try {
    const policy = getExamPolicy(jurisdiction)
    return policy.examBoards.some((board) => board.examTypes.includes(examType))
  } catch {
    return false
  }
}

/**
 * Check if certificate is expired based on issue date and jurisdiction.
 * @param certificateIssuedDate - Date certificate was issued
 * @param jurisdiction - Code like 'KE', 'UG', 'NG'
 * @param examType - Type for which certificate was issued
 * @returns { expired: boolean, expiryDate: Date, daysRemaining: number }
 */
export function checkCertificateExpiry(
  certificateIssuedDate: Date,
  jurisdiction: string,
  examType: string
): { expired: boolean; expiryDate: Date; daysRemaining: number } {
  try {
    const policy = getExamPolicy(jurisdiction)

    // Find applicable exam board and get validity period
    let validityYears = 3
    for (const board of policy.examBoards) {
      if (board.examTypes.includes(examType)) {
        validityYears = board.certificateValidityYears
        break
      }
    }

    const expiryDate = new Date(certificateIssuedDate)
    expiryDate.setFullYear(expiryDate.getFullYear() + validityYears)

    const now = new Date()
    const daysRemaining = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    return {
      expired: daysRemaining < 0,
      expiryDate,
      daysRemaining: Math.max(daysRemaining, 0),
    }
  } catch (error) {
    return {
      expired: true,
      expiryDate: new Date(),
      daysRemaining: 0,
    }
  }
}

/**
 * Get appeal deadline for exam result.
 * @param resultIssuedDate - Date exam result was issued
 * @param jurisdiction - Code like 'KE', 'UG', 'NG'
 * @param examType - Type of exam taken
 * @returns { appealDeadline: Date, daysRemaining: number }
 */
export function getAppealDeadline(
  resultIssuedDate: Date,
  jurisdiction: string,
  examType: string
): { appealDeadline: Date; daysRemaining: number } {
  try {
    const policy = getExamPolicy(jurisdiction)

    // Find appeal deadline from applicable board
    let appealDeadlineDays = 30
    for (const board of policy.examBoards) {
      if (board.examTypes.includes(examType)) {
        appealDeadlineDays = board.appealDeadlineDays
        break
      }
    }

    const appealDeadline = new Date(resultIssuedDate)
    appealDeadline.setDate(appealDeadline.getDate() + appealDeadlineDays)

    const now = new Date()
    const daysRemaining = Math.floor((appealDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    return {
      appealDeadline,
      daysRemaining: Math.max(daysRemaining, 0),
    }
  } catch {
    return {
      appealDeadline: new Date(),
      daysRemaining: 0,
    }
  }
}

/**
 * Check if examinee can attempt exam based on jurisdiction limits.
 * @param currentAttemptCount - Number of times exam has been attempted
 * @param examType - Type of exam
 * @param jurisdiction - Code like 'KE', 'UG', 'NG'
 * @returns { canAttempt: boolean, attemptLimit: number }
 */
export function canAttemptExam(
  currentAttemptCount: number,
  examType: string,
  jurisdiction: string
): { canAttempt: boolean; attemptLimit: number } {
  try {
    const policy = getExamPolicy(jurisdiction)

    let attemptLimit = 3
    for (const board of policy.examBoards) {
      if (board.examTypes.includes(examType)) {
        attemptLimit = board.maxAttempts ?? 3
        break
      }
    }

    return {
      canAttempt: currentAttemptCount < attemptLimit,
      attemptLimit,
    }
  } catch {
    return {
      canAttempt: false,
      attemptLimit: 0,
    }
  }
}

/**
 * Comprehensive validation of examinee record.
 * @param examineeData - Object with grade, attemptCount, certificateIssuedDate, etc.
 * @param jurisdiction - Code like 'KE', 'UG', 'NG'
 * @returns { compliant: boolean, errors: string[] }
 */
export function validateExamineeRecord(
  examineeData: {
    grade: number
    examType: string
    attemptCount: number
    certificateIssuedDate?: Date
    certificateExpiryDate?: Date
  },
  jurisdiction: string
): { compliant: boolean; errors: string[] } {
  const errors: string[] = []

  // Validate grade
  const gradeValidation = validateExamGrade(examineeData.grade, examineeData.examType, jurisdiction)
  if (!gradeValidation.valid) {
    errors.push(gradeValidation.error!)
  }

  // Check attempt limit
  const attemptCheck = canAttemptExam(examineeData.attemptCount, examineeData.examType, jurisdiction)
  if (!attemptCheck.canAttempt) {
    errors.push(`Maximum ${attemptCheck.attemptLimit} exam attempts exceeded`)
  }

  // Check certificate expiry if applicable
  if (examineeData.certificateIssuedDate) {
    const expiryCheck = checkCertificateExpiry(
      examineeData.certificateIssuedDate,
      jurisdiction,
      examineeData.examType
    )
    if (expiryCheck.expired) {
      errors.push(`Certificate expired on ${expiryCheck.expiryDate.toISOString().split('T')[0]}`)
    }
  }

  return {
    compliant: errors.length === 0,
    errors,
  }
}
