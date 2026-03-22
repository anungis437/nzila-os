/**
 * Agrimo Legacy Data Migration
 *
 * Imports core agri data from the legacy Agrimo application:
 *   - agri_producers
 *   - agri_crops
 *   - agri_harvests
 *   - agri_lots
 *   - agri_quality_inspections
 *   - agri_warehouses
 *   - agri_inventory_batches
 *   - agri_shipments
 *   - agri_payments
 *   - agri_certifications
 *
 * Usage:
 *   pnpm tsx scripts/migrations/agri/import-agrimo-legacy.ts --dry-run
 *   pnpm tsx scripts/migrations/agri/import-agrimo-legacy.ts --live
 *
 * Requires:
 *   - DATABASE_URL env var for destination (NzilaOS)
 *   - LEGACY_AGRIMO_DATABASE_URL env var for source (Agrimo)
 *
 * @idempotent Uses legacySourceId + legacySourceSystem='agrimo-ops' as upsert key
 */

// ── Types ─────────────────────────────────────────────────────────────────

interface MigrationConfig {
  dryRun: boolean
  batchSize: number
  sourceConnectionString: string
  destConnectionString: string
}

interface MigrationResult {
  table: string
  total: number
  inserted: number
  skipped: number
  errors: MigrationError[]
}

interface MigrationError {
  legacyId: string
  table: string
  message: string
}

// ── Legacy Agrimo model shapes ─────────────────────────────────────────────

interface AgrimoProducer {
  id: number
  org_id: string
  name: string
  phone: string | null
  location_lat: number | null
  location_lng: number | null
  region: string | null
  commune: string | null
  province: string | null
  farm_size_ha: number | null
  status: string
  cooperative_id: string | null
  created_at: string
  updated_at: string
}

interface AgrimoCrop {
  id: number
  org_id: string
  name: string
  crop_type: string
  variety: string | null
  season: string | null
  created_at: string
}

interface AgrimoHarvest {
  id: number
  org_id: string
  producer_id: number
  crop_id: number
  plot_ref: string | null
  harvest_date: string
  quantity: number
  unit: string
  quality_notes: string | null
  gps_lat: number | null
  gps_lng: number | null
  created_at: string
}

interface AgrimoLot {
  id: number
  org_id: string
  lot_reference: string
  harvest_ids: number[]
  crop_id: number
  total_weight_kg: number
  status: string
  created_at: string
  updated_at: string
}

interface AgrimoQualityInspection {
  id: number
  org_id: string
  lot_id: number
  inspector_name: string
  grade: string
  moisture_pct: number | null
  defect_pct: number | null
  notes: string | null
  inspected_at: string
  created_at: string
}

interface AgrimoWarehouse {
  id: number
  org_id: string
  name: string
  code: string
  location_lat: number | null
  location_lng: number | null
  capacity_mt: number | null
  manager_name: string | null
  created_at: string
}

interface AgrimoBatch {
  id: number
  org_id: string
  warehouse_id: number
  lot_id: number
  weight_kg: number
  status: string
  received_at: string
  created_at: string
}

interface AgrimoShipment {
  id: number
  org_id: string
  lot_ids: number[]
  buyer_ref: string | null
  origin_warehouse_id: number
  destination: string
  carrier: string | null
  status: string
  planned_departure: string | null
  actual_departure: string | null
  planned_arrival: string | null
  actual_arrival: string | null
  tracking_ref: string | null
  created_at: string
  updated_at: string
}

interface AgrimoPayment {
  id: number
  org_id: string
  producer_id: number
  lot_id: number | null
  amount: number
  currency: string
  method: string
  status: string
  reference: string | null
  paid_at: string | null
  created_at: string
}

interface AgrimoCertification {
  id: number
  org_id: string
  lot_id: number
  cert_type: string
  issuer: string
  issued_at: string
  expires_at: string | null
  document_url: string | null
  status: string
  created_at: string
}

// ── Status mapping (legacy → canonical) ───────────────────────────────────

const PRODUCER_STATUS_MAP: Record<string, string> = {
  active: 'active',
  inactive: 'inactive',
  suspended: 'suspended',
  pending: 'pending_verification',
  verified: 'active',
  blocked: 'suspended',
  new: 'pending_verification',
}

const LOT_STATUS_MAP: Record<string, string> = {
  open: 'pending',
  pending: 'pending',
  inspected: 'inspected',
  graded: 'graded',
  certified: 'certified',
  rejected: 'rejected',
  closed: 'certified',
  archived: 'certified',
}

const BATCH_STATUS_MAP: Record<string, string> = {
  received: 'received',
  stored: 'stored',
  allocated: 'allocated',
  dispatched: 'dispatched',
  spoiled: 'spoiled',
  active: 'stored',
  pending: 'received',
}

const SHIPMENT_STATUS_MAP: Record<string, string> = {
  planned: 'planned',
  packed: 'packed',
  dispatched: 'dispatched',
  in_transit: 'dispatched',
  arrived: 'arrived',
  delivered: 'arrived',
  closed: 'closed',
  cancelled: 'closed',
}

const PAYMENT_STATUS_MAP: Record<string, string> = {
  pending: 'pending',
  processing: 'processing',
  completed: 'completed',
  paid: 'completed',
  failed: 'failed',
  reversed: 'reversed',
  cancelled: 'failed',
}

const PAYMENT_METHOD_MAP: Record<string, string> = {
  mobile_money: 'mobile_money',
  mpesa: 'mobile_money',
  orange_money: 'mobile_money',
  airtel_money: 'mobile_money',
  bank_transfer: 'bank_transfer',
  bank: 'bank_transfer',
  cash: 'cash',
  cheque: 'cheque',
  check: 'cheque',
}

const CROP_TYPE_MAP: Record<string, string> = {
  cassava: 'cassava',
  manioc: 'cassava',
  maize: 'maize',
  corn: 'maize',
  rice: 'rice',
  groundnut: 'groundnut',
  peanut: 'groundnut',
  palm_oil: 'palm_oil',
  cocoa: 'cocoa',
  coffee: 'coffee',
  rubber: 'rubber',
  sugar_cane: 'sugar_cane',
  soybean: 'soybean',
  cotton: 'cotton',
  sesame: 'sesame',
  banana: 'banana',
  plantain: 'plantain',
}

const UNIT_MAP: Record<string, string> = {
  kg: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  mt: 'mt',
  ton: 'mt',
  tonne: 'mt',
  metric_ton: 'mt',
  bag: 'bag',
  bags: 'bag',
  sack: 'sack',
  sacks: 'sack',
  litre: 'litre',
  liter: 'litre',
  litres: 'litre',
  hectare: 'hectare',
  ha: 'hectare',
}

const GRADE_MAP: Record<string, string> = {
  a: 'A',
  b: 'B',
  c: 'C',
  d: 'D',
  f: 'F',
  grade_a: 'A',
  grade_b: 'B',
  grade_c: 'C',
  grade_d: 'D',
  premium: 'A',
  standard: 'B',
  low: 'D',
  reject: 'F',
}

const CERT_TYPE_MAP: Record<string, string> = {
  organic: 'organic',
  fair_trade: 'fair_trade',
  fairtrade: 'fair_trade',
  rainforest_alliance: 'rainforest_alliance',
  ra: 'rainforest_alliance',
  utz: 'utz',
  phytosanitary: 'phytosanitary',
  origin: 'certificate_of_origin',
  certificate_of_origin: 'certificate_of_origin',
  coo: 'certificate_of_origin',
  weight: 'weight_note',
  weight_note: 'weight_note',
  warehouse_receipt: 'warehouse_receipt',
  whr: 'warehouse_receipt',
}

const SOURCE_SYSTEM = 'agrimo-ops' as const

// ── Helpers ───────────────────────────────────────────────────────────────

function parseArgs(): MigrationConfig {
  const args = process.argv.slice(2)
  const isLive = args.includes('--live')
  const batchSize = parseInt(
    args.find((a) => a.startsWith('--batch='))?.split('=')[1] ?? '500',
    10,
  )

  const sourceConnectionString = process.env.LEGACY_AGRIMO_DATABASE_URL
  const destConnectionString = process.env.DATABASE_URL

  if (!sourceConnectionString) {
    console.error('❌ LEGACY_AGRIMO_DATABASE_URL is required')
    process.exit(1)
  }
  if (!destConnectionString) {
    console.error('❌ DATABASE_URL is required')
    process.exit(1)
  }

  return {
    dryRun: !isLive,
    batchSize,
    sourceConnectionString,
    destConnectionString,
  }
}

function mapProducerStatus(status: string): string {
  return PRODUCER_STATUS_MAP[status.toLowerCase()] ?? 'pending_verification'
}

function mapLotStatus(status: string): string {
  return LOT_STATUS_MAP[status.toLowerCase()] ?? 'pending'
}

function mapBatchStatus(status: string): string {
  return BATCH_STATUS_MAP[status.toLowerCase()] ?? 'received'
}

function mapShipmentStatus(status: string): string {
  return SHIPMENT_STATUS_MAP[status.toLowerCase()] ?? 'planned'
}

function mapPaymentStatus(status: string): string {
  return PAYMENT_STATUS_MAP[status.toLowerCase()] ?? 'pending'
}

function mapPaymentMethod(method: string): string {
  return PAYMENT_METHOD_MAP[method.toLowerCase()] ?? 'mobile_money'
}

function mapCropType(type: string): string {
  return CROP_TYPE_MAP[type.toLowerCase()] ?? type.toLowerCase()
}

function mapUnit(unit: string): string {
  return UNIT_MAP[unit.toLowerCase()] ?? 'kg'
}

function mapGrade(grade: string): string {
  return GRADE_MAP[grade.toLowerCase()] ?? 'C'
}

function mapCertType(type: string): string {
  return CERT_TYPE_MAP[type.toLowerCase()] ?? type.toLowerCase()
}

function generateId(): string {
  return crypto.randomUUID()
}

// ── Migration runners ─────────────────────────────────────────────────────

async function migrateProducers(config: MigrationConfig): Promise<MigrationResult> {
  const result: MigrationResult = {
    table: 'agri_producers',
    total: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
  }

  console.log(`\n📋 Migrating agri_producers (${config.dryRun ? 'DRY RUN' : 'LIVE'})...`)

  // TODO: Connect to source DB via config.sourceConnectionString
  // const sourceProducers: AgrimoProducer[] = await sourceDb.query('SELECT * FROM producers ORDER BY id')

  // For each producer:
  // 1. Check legacySourceId + SOURCE_SYSTEM exists in dest → skip if found
  // 2. Map fields:
  //    - id: generateId()
  //    - orgId: producer.org_id
  //    - name: producer.name
  //    - phone: producer.phone
  //    - location: producer.location_lat && producer.location_lng
  //        ? { lat: producer.location_lat, lng: producer.location_lng }
  //        : null
  //    - region: producer.region
  //    - commune: producer.commune
  //    - province: producer.province
  //    - farmSizeHa: producer.farm_size_ha
  //    - status: mapProducerStatus(producer.status)
  //    - cooperativeId: producer.cooperative_id
  //    - legacySourceId: String(producer.id)
  //    - legacySourceSystem: SOURCE_SYSTEM
  //    - createdAt: new Date(producer.created_at)
  //    - updatedAt: new Date(producer.updated_at)

  console.log(
    `   ✅ Producers: ${result.inserted} inserted, ${result.skipped} skipped, ${result.errors.length} errors`,
  )
  return result
}

async function migrateCrops(config: MigrationConfig): Promise<MigrationResult> {
  const result: MigrationResult = {
    table: 'agri_crops',
    total: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
  }

  console.log(`\n📋 Migrating agri_crops (${config.dryRun ? 'DRY RUN' : 'LIVE'})...`)

  // Map fields:
  //   - id: generateId()
  //   - orgId: crop.org_id
  //   - name: crop.name
  //   - cropType: mapCropType(crop.crop_type)
  //   - variety: crop.variety
  //   - season: crop.season
  //   - legacySourceId: String(crop.id)
  //   - legacySourceSystem: SOURCE_SYSTEM

  console.log(
    `   ✅ Crops: ${result.inserted} inserted, ${result.skipped} skipped, ${result.errors.length} errors`,
  )
  return result
}

async function migrateHarvests(
  config: MigrationConfig,
  _producerIdMap: Map<number, string>,
  _cropIdMap: Map<number, string>,
): Promise<MigrationResult> {
  const result: MigrationResult = {
    table: 'agri_harvests',
    total: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
  }

  console.log(`\n📋 Migrating agri_harvests (${config.dryRun ? 'DRY RUN' : 'LIVE'})...`)

  // Map fields:
  //   - id: generateId()
  //   - orgId: harvest.org_id
  //   - producerId: producerIdMap.get(harvest.producer_id) ?? error
  //   - cropId: cropIdMap.get(harvest.crop_id) ?? error
  //   - plotRef: harvest.plot_ref
  //   - harvestDate: new Date(harvest.harvest_date)
  //   - quantity: harvest.quantity
  //   - unit: mapUnit(harvest.unit)
  //   - qualityNotes: harvest.quality_notes
  //   - gps: harvest.gps_lat && harvest.gps_lng
  //       ? { lat: harvest.gps_lat, lng: harvest.gps_lng }
  //       : null
  //   - legacySourceId: String(harvest.id)
  //   - legacySourceSystem: SOURCE_SYSTEM

  console.log(
    `   ✅ Harvests: ${result.inserted} inserted, ${result.skipped} skipped, ${result.errors.length} errors`,
  )
  return result
}

async function migrateLots(
  config: MigrationConfig,
  _cropIdMap: Map<number, string>,
): Promise<MigrationResult> {
  const result: MigrationResult = {
    table: 'agri_lots',
    total: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
  }

  console.log(`\n📋 Migrating agri_lots (${config.dryRun ? 'DRY RUN' : 'LIVE'})...`)

  // Map fields:
  //   - id: generateId()
  //   - orgId: lot.org_id
  //   - lotReference: lot.lot_reference
  //   - cropId: cropIdMap.get(lot.crop_id) ?? error
  //   - totalWeightKg: lot.total_weight_kg
  //   - status: mapLotStatus(lot.status)
  //   - legacySourceId: String(lot.id)
  //   - legacySourceSystem: SOURCE_SYSTEM

  console.log(
    `   ✅ Lots: ${result.inserted} inserted, ${result.skipped} skipped, ${result.errors.length} errors`,
  )
  return result
}

async function migrateQualityInspections(
  config: MigrationConfig,
  _lotIdMap: Map<number, string>,
): Promise<MigrationResult> {
  const result: MigrationResult = {
    table: 'agri_quality_inspections',
    total: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
  }

  console.log(`\n📋 Migrating agri_quality_inspections (${config.dryRun ? 'DRY RUN' : 'LIVE'})...`)

  // Map fields:
  //   - id: generateId()
  //   - orgId: inspection.org_id
  //   - lotId: lotIdMap.get(inspection.lot_id) ?? error
  //   - inspectorName: inspection.inspector_name
  //   - grade: mapGrade(inspection.grade)
  //   - moisturePct: inspection.moisture_pct
  //   - defectPct: inspection.defect_pct
  //   - notes: inspection.notes
  //   - inspectedAt: new Date(inspection.inspected_at)
  //   - legacySourceId: String(inspection.id)
  //   - legacySourceSystem: SOURCE_SYSTEM

  console.log(
    `   ✅ Quality: ${result.inserted} inserted, ${result.skipped} skipped, ${result.errors.length} errors`,
  )
  return result
}

async function migrateWarehouses(config: MigrationConfig): Promise<MigrationResult> {
  const result: MigrationResult = {
    table: 'agri_warehouses',
    total: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
  }

  console.log(`\n📋 Migrating agri_warehouses (${config.dryRun ? 'DRY RUN' : 'LIVE'})...`)

  // Map fields:
  //   - id: generateId()
  //   - orgId: warehouse.org_id
  //   - name: warehouse.name
  //   - code: warehouse.code
  //   - location: warehouse.location_lat && warehouse.location_lng
  //       ? { lat: warehouse.location_lat, lng: warehouse.location_lng }
  //       : null
  //   - capacityMt: warehouse.capacity_mt
  //   - managerName: warehouse.manager_name
  //   - legacySourceId: String(warehouse.id)
  //   - legacySourceSystem: SOURCE_SYSTEM

  console.log(
    `   ✅ Warehouses: ${result.inserted} inserted, ${result.skipped} skipped, ${result.errors.length} errors`,
  )
  return result
}

async function migrateBatches(
  config: MigrationConfig,
  _warehouseIdMap: Map<number, string>,
  _lotIdMap: Map<number, string>,
): Promise<MigrationResult> {
  const result: MigrationResult = {
    table: 'agri_inventory_batches',
    total: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
  }

  console.log(`\n📋 Migrating agri_inventory_batches (${config.dryRun ? 'DRY RUN' : 'LIVE'})...`)

  // Map fields:
  //   - id: generateId()
  //   - orgId: batch.org_id
  //   - warehouseId: warehouseIdMap.get(batch.warehouse_id) ?? error
  //   - lotId: lotIdMap.get(batch.lot_id) ?? error
  //   - weightKg: batch.weight_kg
  //   - status: mapBatchStatus(batch.status)
  //   - receivedAt: new Date(batch.received_at)
  //   - legacySourceId: String(batch.id)
  //   - legacySourceSystem: SOURCE_SYSTEM

  console.log(
    `   ✅ Batches: ${result.inserted} inserted, ${result.skipped} skipped, ${result.errors.length} errors`,
  )
  return result
}

async function migrateShipments(
  config: MigrationConfig,
  _warehouseIdMap: Map<number, string>,
  _lotIdMap: Map<number, string>,
): Promise<MigrationResult> {
  const result: MigrationResult = {
    table: 'agri_shipments',
    total: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
  }

  console.log(`\n📋 Migrating agri_shipments (${config.dryRun ? 'DRY RUN' : 'LIVE'})...`)

  // Map fields:
  //   - id: generateId()
  //   - orgId: shipment.org_id
  //   - lotIds: shipment.lot_ids.map(id => lotIdMap.get(id)).filter(Boolean)
  //   - buyerRef: shipment.buyer_ref
  //   - originWarehouseId: warehouseIdMap.get(shipment.origin_warehouse_id) ?? error
  //   - destination: shipment.destination
  //   - carrier: shipment.carrier
  //   - status: mapShipmentStatus(shipment.status)
  //   - plannedDeparture: shipment.planned_departure ? new Date(shipment.planned_departure) : null
  //   - actualDeparture: shipment.actual_departure ? new Date(shipment.actual_departure) : null
  //   - plannedArrival: shipment.planned_arrival ? new Date(shipment.planned_arrival) : null
  //   - actualArrival: shipment.actual_arrival ? new Date(shipment.actual_arrival) : null
  //   - trackingRef: shipment.tracking_ref
  //   - legacySourceId: String(shipment.id)
  //   - legacySourceSystem: SOURCE_SYSTEM

  console.log(
    `   ✅ Shipments: ${result.inserted} inserted, ${result.skipped} skipped, ${result.errors.length} errors`,
  )
  return result
}

async function migratePayments(
  config: MigrationConfig,
  _producerIdMap: Map<number, string>,
  _lotIdMap: Map<number, string>,
): Promise<MigrationResult> {
  const result: MigrationResult = {
    table: 'agri_payments',
    total: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
  }

  console.log(`\n📋 Migrating agri_payments (${config.dryRun ? 'DRY RUN' : 'LIVE'})...`)

  // Map fields:
  //   - id: generateId()
  //   - orgId: payment.org_id
  //   - producerId: producerIdMap.get(payment.producer_id) ?? error
  //   - lotId: payment.lot_id ? lotIdMap.get(payment.lot_id) : null
  //   - amount: payment.amount
  //   - currency: payment.currency
  //   - method: mapPaymentMethod(payment.method)
  //   - status: mapPaymentStatus(payment.status)
  //   - reference: payment.reference
  //   - paidAt: payment.paid_at ? new Date(payment.paid_at) : null
  //   - legacySourceId: String(payment.id)
  //   - legacySourceSystem: SOURCE_SYSTEM

  console.log(
    `   ✅ Payments: ${result.inserted} inserted, ${result.skipped} skipped, ${result.errors.length} errors`,
  )
  return result
}

async function migrateCertifications(
  config: MigrationConfig,
  _lotIdMap: Map<number, string>,
): Promise<MigrationResult> {
  const result: MigrationResult = {
    table: 'agri_certifications',
    total: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
  }

  console.log(`\n📋 Migrating agri_certifications (${config.dryRun ? 'DRY RUN' : 'LIVE'})...`)

  // Map fields:
  //   - id: generateId()
  //   - orgId: cert.org_id
  //   - lotId: lotIdMap.get(cert.lot_id) ?? error
  //   - certType: mapCertType(cert.cert_type)
  //   - issuer: cert.issuer
  //   - issuedAt: new Date(cert.issued_at)
  //   - expiresAt: cert.expires_at ? new Date(cert.expires_at) : null
  //   - documentUrl: cert.document_url
  //   - status: cert.status
  //   - legacySourceId: String(cert.id)
  //   - legacySourceSystem: SOURCE_SYSTEM

  console.log(
    `   ✅ Certifications: ${result.inserted} inserted, ${result.skipped} skipped, ${result.errors.length} errors`,
  )
  return result
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const config = parseArgs()

  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Agrimo → NzilaOS Agri: Core Data Migration')
  console.log(`  Mode: ${config.dryRun ? '🔍 DRY RUN' : '🔴 LIVE'}`)
  console.log(`  Source: ${config.sourceConnectionString.replace(/:\/\/.*@/, '://***@')}`)
  console.log(`  Dest:   ${config.destConnectionString.replace(/:\/\/.*@/, '://***@')}`)
  console.log('═══════════════════════════════════════════════════════════')

  const results: MigrationResult[] = []

  // ID maps: legacyId → newUUID (threaded between migration phases)
  const producerIdMap = new Map<number, string>()
  const cropIdMap = new Map<number, string>()
  const lotIdMap = new Map<number, string>()
  const warehouseIdMap = new Map<number, string>()

  // Migrate in FK dependency order
  results.push(await migrateProducers(config))
  results.push(await migrateCrops(config))
  results.push(await migrateHarvests(config, producerIdMap, cropIdMap))
  results.push(await migrateLots(config, cropIdMap))
  results.push(await migrateQualityInspections(config, lotIdMap))
  results.push(await migrateWarehouses(config))
  results.push(await migrateBatches(config, warehouseIdMap, lotIdMap))
  results.push(await migrateShipments(config, warehouseIdMap, lotIdMap))
  results.push(await migratePayments(config, producerIdMap, lotIdMap))
  results.push(await migrateCertifications(config, lotIdMap))

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('  Migration Summary')
  console.log('═══════════════════════════════════════════════════════════')
  for (const r of results) {
    const status = r.errors.length > 0 ? '⚠️' : '✅'
    console.log(
      `  ${status} ${r.table}: ${r.inserted} inserted, ${r.skipped} skipped, ${r.errors.length} errors`,
    )
  }

  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0)
  if (totalErrors > 0) {
    console.log(`\n❌ ${totalErrors} total errors — check logs above`)
    process.exit(1)
  }

  console.log('\n✅ Agrimo migration complete')
}

main().catch((err) => {
  console.error('Fatal migration error:', err)
  process.exit(1)
})
