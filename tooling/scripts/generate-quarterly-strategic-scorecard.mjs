#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const appsRegistryPath = path.join(ROOT, 'platform', 'registry', 'apps.json')
const coveragePath = path.join(ROOT, 'reports', 'coverage', 'dashboard.json')
const costPath = path.join(ROOT, 'ops', 'outputs', 'cost-allocation.json')
const doraPath = path.join(ROOT, 'ops', 'outputs', 'dora-metrics.json')
const outDir = path.join(ROOT, 'reports', 'strategy')
const outJson = path.join(outDir, 'quarterly-scorecard.json')
const outMd = path.join(outDir, 'quarterly-scorecard.md')

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function parseApps() {
  const registry = readJsonIfExists(appsRegistryPath)
  if (!registry || !Array.isArray(registry.apps)) {
    return { total: 0, pilot: 0, production: 0 }
  }

  let pilot = 0
  let production = 0
  for (const app of registry.apps) {
    const tier = String(app.tier || '').toUpperCase()
    if (tier === 'PILOT') pilot += 1
    if (tier === 'PRODUCTION') production += 1
  }

  const total = registry.apps.length
  return { total, pilot, production }
}

function getCoverage() {
  const cov = readJsonIfExists(coveragePath)
  if (!cov?.summary?.lineRatePct) return null
  return Number(cov.summary.lineRatePct)
}

function getCostAttribution() {
  const cost = readJsonIfExists(costPath)
  if (!cost) return { mappedPct: null, source: 'missing' }
  return {
    mappedPct: typeof cost.mappedPct === 'number' ? cost.mappedPct : null,
    source: 'ops/outputs/cost-allocation.json',
  }
}

function getDora() {
  const dora = readJsonIfExists(doraPath)
  if (!dora) {
    return {
      leadTimeP50Hours: null,
      leadTimeP95Hours: null,
      changeFailureRatePct: null,
      source: 'missing',
    }
  }
  return {
    leadTimeP50Hours: dora.leadTimeP50Hours ?? null,
    leadTimeP95Hours: dora.leadTimeP95Hours ?? null,
    changeFailureRatePct: dora.changeFailureRatePct ?? null,
    source: 'ops/outputs/dora-metrics.json',
  }
}

function toMd(payload) {
  const conv = payload.adoption.pilotToProductionConversionPct
  const cov = payload.quality.coverageLinePct
  const cost = payload.cost.costAttributionMappedPct
  const dora = payload.delivery

  return `# Quarterly Strategic Scorecard\n\nGenerated: ${payload.generatedAt}\n\n## Adoption\n\n| Metric | Value |\n|---|---:|\n| Total Apps | ${payload.adoption.totalApps} |\n| Pilot Apps | ${payload.adoption.pilotApps} |\n| Production Apps | ${payload.adoption.productionApps} |\n| Pilot -> Production Conversion | ${conv === null ? 'n/a' : `${conv.toFixed(2)}%`} |\n\n## Cost Attribution\n\n| Metric | Value |\n|---|---:|\n| Cost Attribution Coverage | ${cost === null ? 'n/a' : `${cost.toFixed(2)}%`} |\n| Source | ${payload.cost.source} |\n\n## Delivery (DORA Inputs)\n\n| Metric | Value |\n|---|---:|\n| Lead Time p50 (hours) | ${dora.leadTimeP50Hours ?? 'n/a'} |\n| Lead Time p95 (hours) | ${dora.leadTimeP95Hours ?? 'n/a'} |\n| Change Failure Rate | ${dora.changeFailureRatePct === null ? 'n/a' : `${dora.changeFailureRatePct.toFixed(2)}%`} |\n| Source | ${dora.source} |\n\n## Quality Context\n\n| Metric | Value |\n|---|---:|\n| Global Line Coverage | ${cov === null ? 'n/a' : `${cov.toFixed(2)}%`} |\n\n## Gaps\n\n${payload.gaps.map((g) => `- ${g}`).join('\n') || '- None'}\n`
}

function main() {
  const apps = parseApps()
  const coverage = getCoverage()
  const cost = getCostAttribution()
  const dora = getDora()

  const conversion = apps.pilot > 0 ? (apps.production / apps.pilot) * 100 : null

  const gaps = []
  if (cost.mappedPct === null) gaps.push('Missing cost allocation input: ops/outputs/cost-allocation.json')
  if (dora.leadTimeP50Hours === null || dora.changeFailureRatePct === null) {
    gaps.push('Missing DORA input: ops/outputs/dora-metrics.json')
  }
  if (coverage === null) gaps.push('Coverage dashboard not found: run pnpm coverage:dashboard')

  const payload = {
    generatedAt: new Date().toISOString(),
    adoption: {
      totalApps: apps.total,
      pilotApps: apps.pilot,
      productionApps: apps.production,
      pilotToProductionConversionPct: conversion,
    },
    cost: {
      costAttributionMappedPct: cost.mappedPct,
      source: cost.source,
    },
    delivery: dora,
    quality: {
      coverageLinePct: coverage,
    },
    gaps,
  }

  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  fs.writeFileSync(outMd, toMd(payload), 'utf8')

  console.log(`Strategic scorecard written: ${path.relative(ROOT, outMd)}`)
  console.log(`Strategic scorecard data: ${path.relative(ROOT, outJson)}`)
}

main()
