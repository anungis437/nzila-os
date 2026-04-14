/**
 * @nzila/platform-jurisdiction-compliance — Test Dataset Generators
 *
 * Generates realistic test data for each jurisdiction, useful for load tests
 * and development environments.
 *
 * @module @nzila/platform-jurisdiction-compliance/test-datasets
 */

import { randomUUID } from 'node:crypto'

export interface TestCooperative {
  id: string
  name: string
  jurisdiction: string
  memberCount: number
  registrationNumber: string
  taxId: string
  createdAt: string
}

export interface TestFarmer {
  id: string
  memberId: string
  coopId: string
  name: string
  phone: string
  jurisdiction: string
  preferredCrops: readonly string[]
  joinedAt: string
}

export interface TestExaminee {
  id: string
  jurisdiction: string
  name: string
  examType: string
  attempts: number
  lastAttempt?: string
  grade?: number
  certificateExpiry?: string
}

// ── Kenya Test Datasets ─────────────────────────────────────────────────────

export function generateKenyaCooperative(): TestCooperative {
  const id = randomUUID()
  return {
    id,
    name: `Kenya Coffee Coop ${id.slice(0, 8)}`,
    jurisdiction: 'KE',
    memberCount: Math.floor(Math.random() * 2000) + 50,
    registrationNumber: `KE-COOP-${Math.floor(Math.random() * 100000)}`,
    taxId: `KE-TAX-${Math.floor(Math.random() * 1000000)}`,
    createdAt: new Date(Date.now() - Math.random() * 365 * 86400000).toISOString(),
  }
}

export function generateKenyaFarmers(coopId: string, count: number): TestFarmer[] {
  const farmers: TestFarmer[] = []
  const crops = ['maize', 'beans', 'tea', 'coffee', 'avocado', 'macadamia']
  for (let i = 0; i < count; i++) {
    farmers.push({
      id: randomUUID(),
      memberId: `KE-M-${i + 1}`,
      coopId,
      name: `Farmer ${i + 1}`,
      phone: `+254${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`,
      jurisdiction: 'KE',
      preferredCrops: crops
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.floor(Math.random() * 3) + 1),
      joinedAt: new Date(Date.now() - Math.random() * 365 * 86400000).toISOString(),
    })
  }
  return farmers
}

export function generateKenyaExaminee(): TestExaminee {
  const id = randomUUID()
  const examTypes = ['apprenticeship', 'competency', 'advanced_craft']
  const examType = examTypes[Math.floor(Math.random() * examTypes.length)] ?? 'apprenticeship'
  const attempts = Math.floor(Math.random() * 3) + 1
  return {
    id,
    jurisdiction: 'KE',
    name: `Examinee ${id.slice(0, 8)}`,
    examType,
    attempts,
    lastAttempt:
      attempts > 0
        ? new Date(Date.now() - Math.random() * 365 * 86400000).toISOString()
        : undefined,
    grade: attempts > 0 ? Math.floor(Math.random() * 40) + 55 : undefined, // 55-95
    certificateExpiry:
      attempts > 0 && Math.random() > 0.5
        ? new Date(Date.now() + 3 * 365 * 86400000).toISOString()
        : undefined,
  }
}

// ── Uganda Test Datasets ────────────────────────────────────────────────────

export function generateUgandaCooperative(): TestCooperative {
  const id = randomUUID()
  return {
    id,
    name: `Uganda Coffee Coop ${id.slice(0, 8)}`,
    jurisdiction: 'UG',
    memberCount: Math.floor(Math.random() * 1500) + 50,
    registrationNumber: `UG-COOP-${Math.floor(Math.random() * 100000)}`,
    taxId: `UG-TAX-${Math.floor(Math.random() * 1000000)}`,
    createdAt: new Date(Date.now() - Math.random() * 365 * 86400000).toISOString(),
  }
}

export function generateUgandaFarmers(coopId: string, count: number): TestFarmer[] {
  const farmers: TestFarmer[] = []
  const crops = ['coffee', 'cocoa', 'cassava', 'bananas', 'cotton']
  for (let i = 0; i < count; i++) {
    farmers.push({
      id: randomUUID(),
      memberId: `UG-M-${i + 1}`,
      coopId,
      name: `Farmer ${i + 1}`,
      phone: `+256${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`,
      jurisdiction: 'UG',
      preferredCrops: crops
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.floor(Math.random() * 3) + 1),
      joinedAt: new Date(Date.now() - Math.random() * 365 * 86400000).toISOString(),
    })
  }
  return farmers
}

export function generateUgandaExaminee(): TestExaminee {
  const id = randomUUID()
  const examTypes = ['apprenticeship', 'competency', 'skills_certification']
  const examType = examTypes[Math.floor(Math.random() * examTypes.length)] ?? 'apprenticeship'
  const attempts = Math.floor(Math.random() * 3) + 1
  return {
    id,
    jurisdiction: 'UG',
    name: `Examinee ${id.slice(0, 8)}`,
    examType,
    attempts,
    lastAttempt:
      attempts > 0
        ? new Date(Date.now() - Math.random() * 365 * 86400000).toISOString()
        : undefined,
    grade: attempts > 0 ? Math.floor(Math.random() * 40) + 50 : undefined, // 50-90
    certificateExpiry:
      attempts > 0 && Math.random() > 0.3
        ? new Date(Date.now() + 5 * 365 * 86400000).toISOString()
        : undefined,
  }
}

// ── Nigeria Test Datasets ───────────────────────────────────────────────────

export function generateNigeriaCooperative(): TestCooperative {
  const id = randomUUID()
  return {
    id,
    name: `Nigeria Cocoa Coop ${id.slice(0, 8)}`,
    jurisdiction: 'NG',
    memberCount: Math.floor(Math.random() * 3000) + 100,
    registrationNumber: `NG-COOP-${Math.floor(Math.random() * 100000)}`,
    taxId: `NG-TAX-${Math.floor(Math.random() * 1000000)}`,
    createdAt: new Date(Date.now() - Math.random() * 365 * 86400000).toISOString(),
  }
}

export function generateNigeriaFarmers(coopId: string, count: number): TestFarmer[] {
  const farmers: TestFarmer[] = []
  const crops = ['cocoa', 'cashew', 'groundnut', 'rice', 'millet']
  for (let i = 0; i < count; i++) {
    farmers.push({
      id: randomUUID(),
      memberId: `NG-M-${i + 1}`,
      coopId,
      name: `Farmer ${i + 1}`,
      phone: `+234${Math.floor(Math.random() * 10000000000).toString().padStart(10, '0')}`,
      jurisdiction: 'NG',
      preferredCrops: crops
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.floor(Math.random() * 3) + 1),
      joinedAt: new Date(Date.now() - Math.random() * 365 * 86400000).toISOString(),
    })
  }
  return farmers
}

export function generateNigeriaExaminee(): TestExaminee {
  const id = randomUUID()
  const examTypes = ['apprenticeship', 'national_diploma', 'advanced_diploma']
  const examType = examTypes[Math.floor(Math.random() * examTypes.length)] ?? 'apprenticeship'
  const attempts = Math.floor(Math.random() * 2) + 1
  return {
    id,
    jurisdiction: 'NG',
    name: `Examinee ${id.slice(0, 8)}`,
    examType,
    attempts,
    lastAttempt:
      attempts > 0
        ? new Date(Date.now() - Math.random() * 365 * 86400000).toISOString()
        : undefined,
    grade: attempts > 0 ? Math.floor(Math.random() * 40) + 60 : undefined, // 60-100
    certificateExpiry:
      attempts > 0 && Math.random() > 0.5
        ? new Date(Date.now() + 2 * 365 * 86400000).toISOString()
        : undefined,
  }
}

// ── Bulk Generation ─────────────────────────────────────────────────────────

export function generateTestDataset(jurisdiction: string, scale: 'small' | 'medium' | 'large') {
  const scaleConfig = {
    small: { coops: 5, farmersPerCoop: 100, examineeCount: 50 },
    medium: { coops: 20, farmersPerCoop: 500, examineeCount: 200 },
    large: { coops: 100, farmersPerCoop: 1000, examineeCount: 1000 },
  }

  const config = scaleConfig[scale]
  const generator =
    jurisdiction === 'KE'
      ? { coop: generateKenyaCooperative, farmers: generateKenyaFarmers, examinee: generateKenyaExaminee }
      : jurisdiction === 'UG'
        ? { coop: generateUgandaCooperative, farmers: generateUgandaFarmers, examinee: generateUgandaExaminee }
        : { coop: generateNigeriaCooperative, farmers: generateNigeriaFarmers, examinee: generateNigeriaExaminee }

  const coops: TestCooperative[] = []
  const farmers: TestFarmer[] = []
  const examinees: TestExaminee[] = []

  for (let i = 0; i < config.coops; i++) {
    const coop = generator.coop()
    coops.push(coop)
    farmers.push(...generator.farmers(coop.id, config.farmersPerCoop))
  }

  for (let i = 0; i < config.examineeCount; i++) {
    examinees.push(generator.examinee())
  }

  return { coops, farmers, examinees, count: { coops: coops.length, farmers: farmers.length, examinees: examinees.length } }
}
