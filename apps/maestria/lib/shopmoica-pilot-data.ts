import { getPaymentGateState, listFlowEngineModules, type DepositRequirement, type FlowPaymentGateOrder } from '@nzila/flow-engine'

export type QuoteStage = 'new' | 'reviewing' | 'pricing' | 'sent' | 'approved' | 'won' | 'lost'
export type ProductionStage =
  | 'queued'
  | 'assembling'
  | 'quality check'
  | 'packed'
  | 'shipped'
  | 'completed'
export type OrderTrackingStage = 'confirmed' | 'in production' | 'packaging' | 'shipped' | 'delivered'
export type CatalogItemType = 'standalone' | 'bundle' | 'component' | 'packaging' | 'gift-card' | 'add-on' | 'personalization'

export interface BilingualLabel {
  en: string
  fr: string
}

export interface QuoteWorkspace {
  id: string
  customerId: string
  customerName: string
  title: string
  stage: QuoteStage
  value: number
  marginPercent: number
  depositPercent: number
  depositAmount: number
  deadlineLabel: string
  owner: string
  templateName: string
  followUpAt: string
  requiresApproval: boolean
  corporate: boolean
  occasion: string
  bilingualStatus: BilingualLabel
  approvalCheckpoint: string
}

export interface CatalogSku {
  sku: string
  type: CatalogItemType
  name: BilingualLabel
  vendorId?: string
  vendorName?: string
  seasonalCollection?: string
  componentSkus: string[]
  substituteSkus: string[]
  topSeller: boolean
  deadStock: boolean
  onHand: number
  committed: number
  available: number
  bufferStock: number
  leadTimeDays: number
  bundleMarginPercent: number
  notes: string[]
}

export interface BundleAssemblyRequirement {
  parentSku: string
  componentSku: string
  quantity: number
  optional: boolean
  substituteSkus: string[]
}

export interface SeasonalCollectionRecord {
  id: string
  name: string
  launchWindow: string
  focus: string
  featuredSkus: string[]
  readiness: 'On track' | 'Watch' | 'At risk'
}

export interface InventoryReservation {
  id: string
  orderId: string
  sku: string
  qty: number
  reason: string
  rush: boolean
}

export interface InventorySku {
  sku: string
  productName: string
  onHand: number
  reserved: number
  available: number
  reorderAt: number
  bufferStock: number
  supplierEta: string
  seasonalTag: string
  bundleShortage: boolean
  urgentReplenishment: boolean
  substituteSkus: string[]
}

export interface VendorCostHistoryEntry {
  id: string
  vendorId: string
  sku: string
  effectiveDate: string
  unitCost: number
}

export interface SupplierProfile {
  id: string
  name: string
  category: string
  localArtisan: boolean
  preferred: boolean
  leadTimeDays: number
  moq: number
  onTimeRate: number
  delayedShipments: number
  seasonalReadiness: 'Ready' | 'Watch' | 'Escalate'
  lastOrderLabel: string
  qualityNotes: string[]
  note: string
}

export interface VendorRiskAlert {
  id: string
  vendorId: string
  title: string
  risk: 'late' | 'price increase' | 'quality' | 'stock'
  affectedOrders: string[]
  note: string
}

export interface PurchaseOrderRecord {
  id: string
  vendorId: string
  vendorName: string
  status: 'Draft' | 'Awaiting approval' | 'Sent' | 'Confirmed' | 'Received' | 'Delayed'
  total: number
  variancePercent: number
  eta: string
  buyer: string
  skuCount: number
  seasonalNeed: string
  delayRisk: boolean
}

export interface ShippingOperation {
  id: string
  orderId: string
  customerName: string
  mode: 'Local delivery' | 'Carrier shipment' | 'Pickup' | 'Corporate multi-drop'
  trackingState: 'Label created' | 'Queued' | 'Out for delivery' | 'In transit' | 'Delayed' | 'Delivered'
  rush: boolean
  addressCount: number
  promiseWindow: string
  courier: string
  calendarSlot: string
  delayedAlert?: string
}

export interface DeliveryCalendarEntry {
  id: string
  dateLabel: string
  slot: string
  routeName: string
  stops: number
  rushOrders: number
}

export interface CustomOrderRecord {
  id: string
  quoteId: string
  customerId: string
  customerName: string
  projectName: string
  packagingSpec: string
  personalizationNotes: string[]
  deadlineLabel: string
  dependencyAlerts: string[]
  productionStage: ProductionStage
  shipWindow: string
  accountManager: string
  orderValue: number
  paymentStatus: string
  amountPaid: number
  skuMix: string[]
  rush: boolean
  atRisk: boolean
  slaHoursRemaining: number
  invoiceTerms: string
}

export interface ProductionJob {
  id: string
  orderId: string
  projectName: string
  stage: ProductionStage
  proofStatus: 'approved' | 'changes requested' | 'pending'
  qcOwner: string
  shipDate: string
  blocker?: string
  slaHoursRemaining: number
  atRisk: boolean
}

export interface OrderProfitabilityRecord {
  orderId: string
  customerName: string
  revenue: number
  collected: number
  productCost: number
  packagingCost: number
  laborCost: number
  shippingCost: number
  discountAmount: number
  cogs: number
  grossMarginDollars: number
  grossMarginPercent: number
  invoiceStatus: 'deposit due' | 'partial' | 'paid' | 'overdue'
  dueDate: string
  marginFlag: 'Healthy' | 'Watch' | 'Blocked'
}

export interface CustomerProfile {
  id: string
  name: string
  segment: 'Corporate' | 'VIP' | 'Growing' | 'Seasonal'
  lifetimeValue: number
  lastOrderLabel: string
  vipStatus: boolean
  nextOpportunity: string
  notes: string[]
  preferredLanguage: 'EN' | 'FR' | 'Bilingual'
}

export interface QuoteRequestBrief {
  id: string
  occasion: string
  quantity: number
  budgetRange: string
  timeline: string
  brandingNeeds: string
  deliveryNeeds: string
  conciergeTone: string
  languageMode: 'Bilingual' | 'English-first' | 'French-first'
}

export interface CorporateCampaignRecord {
  id: string
  accountName: string
  theme: string
  status: 'Planning' | 'Awaiting approval' | 'Deposit pending' | 'In production' | 'Delivered'
  recipientCount: number
  addressCount: number
  brandedInsert: boolean
  deadline: string
  invoiceTerms: string
  depositOutstanding: number
  nextAction: string
  approvalCheckpoint: string
  reorderReady: boolean
}

export interface SeasonalCampaign {
  id: string
  season: string
  launchWindow: string
  audience: string
  pipelineValue: number
  heroConcept: string
  operationalNeed: string
  status: 'Building' | 'Ready to launch' | 'Live' | 'Follow-up'
}

export interface CrmReminder {
  id: string
  customerId: string
  customerName: string
  type: 'Repeat order' | 'VIP follow-up' | 'Seasonal reactivation'
  note: string
  when: string
}

export interface ShellNotification {
  id: string
  title: string
  note: string
}

export interface NotificationCenterItem {
  id: string
  title: string
  note: string
  owner: string
  channel: string
  priority: 'critical' | 'watch' | 'normal'
  mention?: string
}

export interface OwnerHandoff {
  id: string
  from: string
  to: string
  subject: string
  dueBy: string
  status: 'new' | 'accepted' | 'ready'
}

export interface LiveConnector {
  id: string
  name: string
  system: 'Shopify' | 'Google Ads' | 'Zoho'
  status: 'healthy' | 'watch' | 'syncing'
  lastSync: string
  latencyMs: number
  note: string
  modules: string[]
}

export interface AiInsightCard {
  id: string
  title: string
  insight: string
  confidence: 'High' | 'Medium'
  actionOwner: string
  module: string
}

export interface AssignmentRecord {
  id: string
  title: string
  owner: string
  dueBy: string
  status: 'new' | 'in-progress' | 'blocked' | 'done'
  module: string
}

export interface ActivityTimelineEvent {
  id: string
  at: string
  actor: string
  action: string
  detail: string
  module: string
}

export interface CommentThreadItem {
  id: string
  author: string
  audience: 'internal' | 'owner' | 'client'
  message: string
  at: string
  module: string
}

export interface ProposalPackage {
  id: string
  tier: 'Essential' | 'Premium' | 'Signature'
  pricePerRecipient: number
  depositPercent: number
  leadTime: string
  marginPercent: number
  promise: string
  inclusions: string[]
}

export interface ExecutiveMetricSnapshot {
  revenueToday: number
  revenueWeek: number
  revenueMonth: number
  quotesPending: number
  ordersAtRiskToday: number
  vendorDelaysAffectingOrders: number
  depositsOutstanding: number
  marginAlerts: number
  shippingQueueVolume: number
  inventoryShortageWarnings: number
  topCustomers: CustomerProfile[]
  seasonalOpportunities: SeasonalCampaign[]
  topCorporateClients: Array<{ name: string; value: number; note: string }>
  teamWorkload: Array<{ owner: string; active: number; blocked: number; note: string }>
}

export interface BilingualStatusTemplate {
  key: string
  status: BilingualLabel
  note: BilingualLabel
}

export interface DemoScenario {
  id: string
  title: string
  summary: string
  impact: string
  route: string
}

export interface ShopifyMetric {
  label: string
  value: string
  note: string
}

export interface ShopifyBundlePerformance {
  bundleSku: string
  conversionRate: number
  aov: number
  repeatRate: number
}

export interface AdsCampaignPerformance {
  campaign: string
  channel: 'Search' | 'Shopping' | 'Performance Max'
  language: 'EN' | 'FR'
  spend: number
  conversions: number
  cpa: number
  roas: number
  branded: boolean
  geo: string
}

export interface CampaignExecutionRecord {
  id: string
  campaign: string
  owner: string
  channel: string
  status: 'Planning' | 'Asset build' | 'Launch ready' | 'Live' | 'Post-mortem'
  launchWindow: string
  roiNote: string
}

export interface SocialPlanItem {
  id: string
  platform: 'Instagram' | 'Facebook'
  theme: string
  postDate: string
  assetStatus: 'Requested' | 'In production' | 'Approved' | 'Scheduled'
  collaborator?: string
}

export interface WebsiteFunnelMetric {
  page: string
  sessions: number
  ctaClicks: number
  quoteRequests: number
  builderStarts: number
  bounceRate: number
  dropOff: string
}

export interface GuidedBuilderPreset {
  id: string
  budget: string
  recipient: string
  occasion: string
  luxuryLevel: 'Essential' | 'Premium' | 'Signature'
  corporate: boolean
  localFavorites: boolean
  timeline: string
  recommendedSkus: string[]
  estimatedTotal: number
  marginPercent: number
}

export interface LoyaltyProfile {
  customerId: string
  tier: 'Gold' | 'Platinum' | 'Founder Circle'
  rewardsBalance: number
  repeatOrders: number
  savedPreferences: string[]
  earlySeasonalAccess: boolean
  conciergeEligible: boolean
}

export interface ExportReportDefinition {
  id: string
  name: string
  format: 'CSV' | 'PDF'
  source: string
  updatedAt: string
  audience: string
  polishNote: string
  filename: string
}

export const smcDepositRule: DepositRequirement = {
  required: true,
  percent: 30,
  amount: null,
  due_before_production: true,
}

export const bilingualStatusTemplates: BilingualStatusTemplate[] = [
  {
    key: 'quote-sent',
    status: { en: 'Quote sent', fr: 'Soumission envoyee' },
    note: { en: 'Waiting on client feedback and approval.', fr: 'En attente des commentaires et de l approbation du client.' },
  },
  {
    key: 'awaiting-approval',
    status: { en: 'Awaiting approval', fr: 'En attente d approbation' },
    note: { en: 'Founder or client approval is still required.', fr: 'L approbation du fondateur ou du client est toujours requise.' },
  },
  {
    key: 'shipped',
    status: { en: 'Shipped', fr: 'Expedie' },
    note: { en: 'Tracking is live and client communications can be sent.', fr: 'Le suivi est actif et les communications client peuvent etre envoyees.' },
  },
]

export const catalogSkus: CatalogSku[] = [
  {
    sku: 'BND-EXEC-001',
    type: 'bundle',
    name: { en: 'Executive Quiet Luxury Basket', fr: 'Panier luxe discret executif' },
    vendorName: 'Mixed artisan program',
    seasonalCollection: 'Holiday Reserve 2026',
    componentSkus: ['PRD-CHO-001', 'PRD-MPL-001', 'PKG-BOX-001', 'ADD-CARD-001'],
    substituteSkus: ['BND-EXEC-002'],
    topSeller: true,
    deadStock: false,
    onHand: 48,
    committed: 31,
    available: 17,
    bufferStock: 12,
    leadTimeDays: 10,
    bundleMarginPercent: 34.2,
    notes: ['Top seller for law firms and executive teams', 'Requires premium chocolate availability'],
  },
  {
    sku: 'PRD-CHO-001',
    type: 'component',
    name: { en: 'Premium artisan chocolate box', fr: 'Boite de chocolats artisanaux premium' },
    vendorId: 'sup-cho',
    vendorName: 'Chocolaterie Mont-Royal',
    seasonalCollection: 'Holiday Reserve 2026',
    componentSkus: [],
    substituteSkus: ['PRD-CHO-002'],
    topSeller: true,
    deadStock: false,
    onHand: 64,
    committed: 58,
    available: 6,
    bufferStock: 18,
    leadTimeDays: 9,
    bundleMarginPercent: 28.4,
    notes: ['Delay risk during holiday rush', 'Key flavor profile for executive baskets'],
  },
  {
    sku: 'PRD-CHO-002',
    type: 'component',
    name: { en: 'Dark chocolate reserve box', fr: 'Boite reserve chocolat noir' },
    vendorId: 'sup-cho',
    vendorName: 'Chocolaterie Mont-Royal',
    seasonalCollection: 'Holiday Reserve 2026',
    componentSkus: [],
    substituteSkus: [],
    topSeller: false,
    deadStock: false,
    onHand: 23,
    committed: 8,
    available: 15,
    bufferStock: 8,
    leadTimeDays: 9,
    bundleMarginPercent: 31.1,
    notes: ['Approved substitution for premium basket delay'],
  },
  {
    sku: 'PKG-BOX-001',
    type: 'packaging',
    name: { en: 'Obsidian rigid gift box', fr: 'Boite cadeau rigide obsidienne' },
    vendorId: 'sup-pack',
    vendorName: 'Maison Atelier Pack',
    seasonalCollection: 'Holiday Reserve 2026',
    componentSkus: [],
    substituteSkus: ['PKG-BOX-002'],
    topSeller: true,
    deadStock: false,
    onHand: 142,
    committed: 88,
    available: 54,
    bufferStock: 40,
    leadTimeDays: 12,
    bundleMarginPercent: 36.8,
    notes: ['High finish quality', 'MOQ pressure ahead of Christmas'],
  },
  {
    sku: 'ADD-CARD-001',
    type: 'personalization',
    name: { en: 'Bilingual handwritten note insert', fr: 'Carte manuscrite bilingue' },
    vendorId: 'sup-print',
    vendorName: 'Papeterie Nordique',
    seasonalCollection: 'All year',
    componentSkus: [],
    substituteSkus: ['ADD-CARD-002'],
    topSeller: true,
    deadStock: false,
    onHand: 320,
    committed: 140,
    available: 180,
    bufferStock: 90,
    leadTimeDays: 5,
    bundleMarginPercent: 61.4,
    notes: ['Critical for bilingual executive programs'],
  },
  {
    sku: 'ADD-GC-001',
    type: 'gift-card',
    name: { en: 'Maison cafe gift card', fr: 'Carte-cadeau Maison cafe' },
    vendorName: 'Digital issuance',
    seasonalCollection: 'Corporate all year',
    componentSkus: [],
    substituteSkus: [],
    topSeller: false,
    deadStock: false,
    onHand: 999,
    committed: 24,
    available: 975,
    bufferStock: 0,
    leadTimeDays: 0,
    bundleMarginPercent: 18.5,
    notes: ['Used as a save when physical inventory is constrained'],
  },
  {
    sku: 'PRD-MUG-001',
    type: 'standalone',
    name: { en: 'Stoneware espresso set', fr: 'Ensemble espresso en gres' },
    vendorId: 'sup-ceramic',
    vendorName: 'Atelier Trois Rivieres',
    seasonalCollection: 'Spring Hosting',
    componentSkus: [],
    substituteSkus: [],
    topSeller: false,
    deadStock: true,
    onHand: 28,
    committed: 1,
    available: 27,
    bufferStock: 5,
    leadTimeDays: 16,
    bundleMarginPercent: 12.8,
    notes: ['Dead stock candidate for re-bundling', 'Needs markdown before summer'],
  },
]

export const bundleAssemblyRequirements: BundleAssemblyRequirement[] = [
  { parentSku: 'BND-EXEC-001', componentSku: 'PRD-CHO-001', quantity: 1, optional: false, substituteSkus: ['PRD-CHO-002'] },
  { parentSku: 'BND-EXEC-001', componentSku: 'PKG-BOX-001', quantity: 1, optional: false, substituteSkus: ['PKG-BOX-002'] },
  { parentSku: 'BND-EXEC-001', componentSku: 'ADD-CARD-001', quantity: 1, optional: false, substituteSkus: ['ADD-CARD-002'] },
]

export const seasonalCollections: SeasonalCollectionRecord[] = [
  { id: 'season-col-1', name: 'Holiday Reserve 2026', launchWindow: 'September launch', focus: 'Executive and law firm gifting', featuredSkus: ['BND-EXEC-001', 'PRD-CHO-001', 'PKG-BOX-001'], readiness: 'Watch' },
  { id: 'season-col-2', name: 'Mothers Day Maison', launchWindow: 'March launch', focus: 'Hotels, spa partners, and VIP appreciation', featuredSkus: ['SLV-BLSH-02', 'ADD-CARD-001'], readiness: 'On track' },
]

export const quoteWorkspaces: QuoteWorkspace[] = [
  {
    id: 'QT-SMC-401',
    customerId: 'cust-aurora',
    customerName: 'Aurora Capital',
    title: 'Executive holiday gifting program',
    stage: 'reviewing',
    value: 18400,
    marginPercent: 31,
    depositPercent: 30,
    depositAmount: 5520,
    deadlineLabel: 'Need quote by Thu 2 PM',
    owner: 'Nadia',
    templateName: 'Corporate Winter Luxe',
    followUpAt: 'Today 4:00 PM',
    requiresApproval: true,
    corporate: true,
    occasion: 'Holiday gifting',
    bilingualStatus: { en: 'Awaiting approval', fr: 'En attente d approbation' },
    approvalCheckpoint: 'CFO and founder sign-off',
  },
  {
    id: 'QT-SMC-402',
    customerId: 'cust-cirrus',
    customerName: 'Cirrus Legal',
    title: 'Client appreciation launch boxes',
    stage: 'pricing',
    value: 9200,
    marginPercent: 22,
    depositPercent: 30,
    depositAmount: 2760,
    deadlineLabel: 'Pricing due tomorrow',
    owner: 'Arielle',
    templateName: 'Client Appreciation',
    followUpAt: 'Tomorrow 10:00 AM',
    requiresApproval: false,
    corporate: true,
    occasion: 'Client appreciation',
    bilingualStatus: { en: 'Pricing in progress', fr: 'Tarification en cours' },
    approvalCheckpoint: 'Margin guardrail review',
  },
  {
    id: 'QT-SMC-403',
    customerId: 'cust-milo',
    customerName: 'Milo & Co',
    title: 'VIP founder welcome baskets',
    stage: 'sent',
    value: 6100,
    marginPercent: 36,
    depositPercent: 30,
    depositAmount: 1830,
    deadlineLabel: 'Awaiting response',
    owner: 'Nadia',
    templateName: 'Founder Welcome',
    followUpAt: 'Friday 9:00 AM',
    requiresApproval: false,
    corporate: false,
    occasion: 'Executive onboarding',
    bilingualStatus: { en: 'Quote sent', fr: 'Soumission envoyee' },
    approvalCheckpoint: 'Client response window',
  },
  {
    id: 'QT-SMC-404',
    customerId: 'cust-verve',
    customerName: 'Verve Hotels',
    title: 'Mothers Day guest gifting suite',
    stage: 'approved',
    value: 13750,
    marginPercent: 29,
    depositPercent: 30,
    depositAmount: 4125,
    deadlineLabel: 'Deposit expected today',
    owner: 'Arielle',
    templateName: 'Seasonal Premium',
    followUpAt: 'Today 1:30 PM',
    requiresApproval: true,
    corporate: true,
    occasion: 'Mothers Day',
    bilingualStatus: { en: 'Awaiting deposit', fr: 'Depot en attente' },
    approvalCheckpoint: 'Regional marketing lead approval',
  },
  {
    id: 'QT-SMC-405',
    customerId: 'cust-boreal',
    customerName: 'Boreal Advisory',
    title: 'Quarterly board retreat gifts',
    stage: 'won',
    value: 7900,
    marginPercent: 34,
    depositPercent: 30,
    depositAmount: 2370,
    deadlineLabel: 'Convert to order now',
    owner: 'Nadia',
    templateName: 'Board Retreat',
    followUpAt: 'Order handoff',
    requiresApproval: false,
    corporate: true,
    occasion: 'Board retreat',
    bilingualStatus: { en: 'Won', fr: 'Gagne' },
    approvalCheckpoint: 'Recipient list upload',
  },
]

export const inventoryReservations: InventoryReservation[] = [
  { id: 'res-1', orderId: 'ORD-SMC-220', sku: 'PRD-CHO-001', qty: 42, reason: 'Board retreat executive baskets', rush: false },
  { id: 'res-2', orderId: 'ORD-SMC-221', sku: 'PKG-BOX-001', qty: 54, reason: 'Hotel amenity gifting suite', rush: false },
  { id: 'res-3', orderId: 'ORD-SMC-224', sku: 'PRD-CHO-001', qty: 12, reason: 'Rush executive concierge order', rush: true },
  { id: 'res-4', orderId: 'ORD-SMC-225', sku: 'ADD-CARD-001', qty: 200, reason: 'Christmas corporate multi-drop insert cards', rush: false },
]

export const inventorySkus: InventorySku[] = [
  { sku: 'PKG-BOX-001', productName: 'Obsidian rigid gift box', onHand: 142, reserved: 88, available: 54, reorderAt: 90, bufferStock: 40, supplierEta: '12 days', seasonalTag: 'Christmas', bundleShortage: false, urgentReplenishment: false, substituteSkus: ['PKG-BOX-002'] },
  { sku: 'PRD-CHO-001', productName: 'Premium artisan chocolate box', onHand: 64, reserved: 58, available: 6, reorderAt: 24, bufferStock: 18, supplierEta: '9 days delayed', seasonalTag: 'Christmas', bundleShortage: true, urgentReplenishment: true, substituteSkus: ['PRD-CHO-002'] },
  { sku: 'ADD-CARD-001', productName: 'Bilingual handwritten note insert', onHand: 320, reserved: 140, available: 180, reorderAt: 120, bufferStock: 90, supplierEta: '5 days', seasonalTag: 'Corporate all year', bundleShortage: false, urgentReplenishment: false, substituteSkus: ['ADD-CARD-002'] },
  { sku: 'PKG-FILL-001', productName: 'Champagne crinkle fill', onHand: 18, reserved: 12, available: 6, reorderAt: 20, bufferStock: 15, supplierEta: '4 days', seasonalTag: 'Packaging core', bundleShortage: false, urgentReplenishment: true, substituteSkus: ['PKG-FILL-002'] },
]

export const vendorCostHistory: VendorCostHistoryEntry[] = [
  { id: 'cost-1', vendorId: 'sup-pack', sku: 'PKG-BOX-001', effectiveDate: '2026-02-14', unitCost: 14.5 },
  { id: 'cost-2', vendorId: 'sup-pack', sku: 'PKG-BOX-001', effectiveDate: '2026-04-06', unitCost: 15.9 },
  { id: 'cost-3', vendorId: 'sup-cho', sku: 'PRD-CHO-001', effectiveDate: '2026-01-10', unitCost: 19.2 },
  { id: 'cost-4', vendorId: 'sup-cho', sku: 'PRD-CHO-001', effectiveDate: '2026-04-21', unitCost: 21.4 },
]

export const supplierProfiles: SupplierProfile[] = [
  {
    id: 'sup-pack',
    name: 'Maison Atelier Pack',
    category: 'Rigid packaging',
    localArtisan: false,
    preferred: true,
    leadTimeDays: 12,
    moq: 150,
    onTimeRate: 96,
    delayedShipments: 1,
    seasonalReadiness: 'Watch',
    lastOrderLabel: '4 days ago',
    qualityNotes: ['Best finish quality for executive programs', 'Holiday MOQ goes up by 20%'],
    note: 'Primary packaging partner for premium box presentations.',
  },
  {
    id: 'sup-print',
    name: 'Papeterie Nordique',
    category: 'Inserts and cards',
    localArtisan: true,
    preferred: true,
    leadTimeDays: 5,
    moq: 75,
    onTimeRate: 98,
    delayedShipments: 0,
    seasonalReadiness: 'Ready',
    lastOrderLabel: 'Yesterday',
    qualityNotes: ['Bilingual print quality is consistently strong'],
    note: 'Local print partner for bilingual inserts and handwritten note cards.',
  },
  {
    id: 'sup-cho',
    name: 'Chocolaterie Mont-Royal',
    category: 'Artisan sweets',
    localArtisan: true,
    preferred: true,
    leadTimeDays: 9,
    moq: 120,
    onTimeRate: 84,
    delayedShipments: 3,
    seasonalReadiness: 'Escalate',
    lastOrderLabel: '2 days ago',
    qualityNotes: ['Premium product quality is excellent', 'Holiday production slots slip when not booked early'],
    note: 'Critical artisan partner for executive and holiday bundles.',
  },
  {
    id: 'sup-ceramic',
    name: 'Atelier Trois Rivieres',
    category: 'Ceramics',
    localArtisan: true,
    preferred: false,
    leadTimeDays: 16,
    moq: 24,
    onTimeRate: 91,
    delayedShipments: 1,
    seasonalReadiness: 'Watch',
    lastOrderLabel: '18 days ago',
    qualityNotes: ['Beautiful finish', 'Low turnover on current SKU mix'],
    note: 'Good artisan partner but current assortment is overstocked.',
  },
]

export const vendorRiskAlerts: VendorRiskAlert[] = [
  {
    id: 'risk-1',
    vendorId: 'sup-cho',
    title: 'Premium chocolate delay risk',
    risk: 'late',
    affectedOrders: ['ORD-SMC-225', 'ORD-SMC-226'],
    note: 'Holiday batch will miss promised ship windows unless substitutions are approved this week.',
  },
  {
    id: 'risk-2',
    vendorId: 'sup-pack',
    title: 'Rigid box price increase risk',
    risk: 'price increase',
    affectedOrders: ['QT-SMC-401', 'QT-SMC-408'],
    note: 'Latest unit cost is up 9.7% versus quoted assumptions on premium programs.',
  },
  {
    id: 'risk-3',
    vendorId: 'sup-ceramic',
    title: 'Dead stock on stoneware set',
    risk: 'stock',
    affectedOrders: [],
    note: 'Needs re-bundling or markdown before summer buying cycle.',
  },
]

export const purchaseOrders: PurchaseOrderRecord[] = [
  { id: 'PO-510', vendorId: 'sup-pack', vendorName: 'Maison Atelier Pack', status: 'Awaiting approval', total: 6200, variancePercent: 4.5, eta: '12 days', buyer: 'Nadia', skuCount: 3, seasonalNeed: 'Holiday reserve packaging build', delayRisk: false },
  { id: 'PO-511', vendorId: 'sup-print', vendorName: 'Papeterie Nordique', status: 'Confirmed', total: 1840, variancePercent: 0.8, eta: '5 days', buyer: 'Arielle', skuCount: 2, seasonalNeed: 'Bilingual insert replenishment', delayRisk: false },
  { id: 'PO-512', vendorId: 'sup-cho', vendorName: 'Chocolaterie Mont-Royal', status: 'Delayed', total: 2950, variancePercent: 11.5, eta: '9 days delayed', buyer: 'Sophie', skuCount: 1, seasonalNeed: 'Holiday luxury basket core item', delayRisk: true },
]

export const customOrders: CustomOrderRecord[] = [
  {
    id: 'ORD-SMC-220',
    quoteId: 'QT-SMC-405',
    customerId: 'cust-boreal',
    customerName: 'Boreal Advisory',
    projectName: 'Quarterly board retreat gifts',
    packagingSpec: 'Matte obsidian box, foil insert card, wax-sealed sleeve',
    personalizationNotes: ['Monogrammed itinerary card', 'Dietary-safe chocolate substitutions', 'Regional maple reserve for Quebec board members'],
    deadlineLabel: 'Ships next Tuesday',
    dependencyAlerts: ['Need final rooming list', 'Waiting on one artisan chocolate substitution sign-off'],
    productionStage: 'assembling',
    shipWindow: 'Tue 11 AM',
    accountManager: 'Nadia',
    orderValue: 7900,
    paymentStatus: 'PARTIALLY_PAID',
    amountPaid: 2370,
    skuMix: ['BND-EXEC-001', 'ADD-CARD-001'],
    rush: false,
    atRisk: false,
    slaHoursRemaining: 38,
    invoiceTerms: 'Balance due at shipment',
  },
  {
    id: 'ORD-SMC-221',
    quoteId: 'QT-SMC-404',
    customerId: 'cust-verve',
    customerName: 'Verve Hotels',
    projectName: 'Mothers Day guest gifting suite',
    packagingSpec: 'Blush rigid box, bilingual enclosure, satin ribbon finishing',
    personalizationNotes: ['French and English message inserts', 'Property-specific thank-you cards'],
    deadlineLabel: 'Proof due Friday',
    dependencyAlerts: ['Deposit still outstanding', 'Need bilingual proof sign-off'],
    productionStage: 'queued',
    shipWindow: 'Fri 4 PM',
    accountManager: 'Arielle',
    orderValue: 13750,
    paymentStatus: 'PENDING_DEPOSIT',
    amountPaid: 0,
    skuMix: ['PKG-BOX-001', 'ADD-CARD-001'],
    rush: false,
    atRisk: true,
    slaHoursRemaining: 21,
    invoiceTerms: '30% deposit before reservation',
  },
  {
    id: 'ORD-SMC-222',
    quoteId: 'QT-SMC-403',
    customerId: 'cust-milo',
    customerName: 'Milo & Co',
    projectName: 'VIP founder welcome baskets',
    packagingSpec: 'Oak crate presentation with handwritten welcome note',
    personalizationNotes: ['Founder handwritten note', 'Office delivery coordination'],
    deadlineLabel: 'Deliver next week',
    dependencyAlerts: [],
    productionStage: 'quality check',
    shipWindow: 'Wed 2 PM',
    accountManager: 'Sophie',
    orderValue: 6100,
    paymentStatus: 'PAID',
    amountPaid: 6100,
    skuMix: ['PRD-CHO-002', 'ADD-CARD-001'],
    rush: false,
    atRisk: false,
    slaHoursRemaining: 50,
    invoiceTerms: 'Paid in full',
  },
  {
    id: 'ORD-SMC-224',
    quoteId: 'QT-SMC-409',
    customerId: 'cust-lyon',
    customerName: 'Lyon Executive Search',
    projectName: 'Rush executive gift order',
    packagingSpec: 'Compact leather-finish box with concierge card',
    personalizationNotes: ['Same-day signature card', 'Driver phone confirmation before handoff'],
    deadlineLabel: 'Deliver today by 5 PM',
    dependencyAlerts: ['Driver assigned but packaging fill is low'],
    productionStage: 'packed',
    shipWindow: 'Today 5 PM',
    accountManager: 'Nadia',
    orderValue: 1850,
    paymentStatus: 'PAID',
    amountPaid: 1850,
    skuMix: ['PKG-BOX-001', 'ADD-CARD-001'],
    rush: true,
    atRisk: true,
    slaHoursRemaining: 5,
    invoiceTerms: 'Paid in full',
  },
  {
    id: 'ORD-SMC-225',
    quoteId: 'QT-SMC-401',
    customerId: 'cust-aurora',
    customerName: 'Aurora Capital',
    projectName: 'Christmas 200-order corporate campaign',
    packagingSpec: 'Obsidian premium basket, bilingual insert, curated local artisan mix',
    personalizationNotes: ['Multiple delivery addresses', 'Branded insert', 'Recipient segmentation by tier'],
    deadlineLabel: 'First batch releases in 9 days',
    dependencyAlerts: ['Premium chocolate vendor delayed', 'Need final recipient CSV for west coast drop'],
    productionStage: 'queued',
    shipWindow: 'Staggered release starting next Thursday',
    accountManager: 'Arielle',
    orderValue: 36800,
    paymentStatus: 'PARTIALLY_PAID',
    amountPaid: 11040,
    skuMix: ['BND-EXEC-001', 'ADD-CARD-001', 'ADD-GC-001'],
    rush: false,
    atRisk: true,
    slaHoursRemaining: 120,
    invoiceTerms: '30% deposit then NET15 balance',
  },
]

export const productionJobs: ProductionJob[] = [
  { id: 'JOB-801', orderId: 'ORD-SMC-220', projectName: 'Quarterly board retreat gifts', stage: 'assembling', proofStatus: 'approved', qcOwner: 'Marc', shipDate: 'Tue 11 AM', slaHoursRemaining: 38, atRisk: false },
  { id: 'JOB-802', orderId: 'ORD-SMC-221', projectName: 'Mothers Day guest gifting suite', stage: 'queued', proofStatus: 'pending', qcOwner: 'Amelie', shipDate: 'Fri 4 PM', blocker: 'Deposit and proof approval required', slaHoursRemaining: 21, atRisk: true },
  { id: 'JOB-803', orderId: 'ORD-SMC-222', projectName: 'VIP founder welcome baskets', stage: 'quality check', proofStatus: 'approved', qcOwner: 'Marc', shipDate: 'Wed 2 PM', slaHoursRemaining: 50, atRisk: false },
  { id: 'JOB-804', orderId: 'ORD-SMC-224', projectName: 'Rush executive gift order', stage: 'packed', proofStatus: 'approved', qcOwner: 'Amelie', shipDate: 'Today 5 PM', blocker: 'Awaiting local delivery handoff', slaHoursRemaining: 5, atRisk: true },
  { id: 'JOB-805', orderId: 'ORD-SMC-225', projectName: 'Christmas 200-order corporate campaign', stage: 'queued', proofStatus: 'approved', qcOwner: 'Marc', shipDate: 'Next Thu', blocker: 'Chocolate component delay may block reservation', slaHoursRemaining: 120, atRisk: true },
]

export const profitabilityRecords: OrderProfitabilityRecord[] = [
  { orderId: 'ORD-SMC-220', customerName: 'Boreal Advisory', revenue: 7900, collected: 2370, productCost: 3240, packagingCost: 680, laborCost: 520, shippingCost: 180, discountAmount: 0, cogs: 4620, grossMarginDollars: 3280, grossMarginPercent: 41.5, invoiceStatus: 'partial', dueDate: 'Balance due at shipment', marginFlag: 'Healthy' },
  { orderId: 'ORD-SMC-221', customerName: 'Verve Hotels', revenue: 13750, collected: 0, productCost: 6520, packagingCost: 1480, laborCost: 820, shippingCost: 420, discountAmount: 280, cogs: 9240, grossMarginDollars: 4510, grossMarginPercent: 32.8, invoiceStatus: 'deposit due', dueDate: 'Deposit due today', marginFlag: 'Watch' },
  { orderId: 'ORD-SMC-222', customerName: 'Milo & Co', revenue: 6100, collected: 6100, productCost: 2380, packagingCost: 620, laborCost: 380, shippingCost: 160, discountAmount: 0, cogs: 3540, grossMarginDollars: 2560, grossMarginPercent: 42, invoiceStatus: 'paid', dueDate: 'Settled', marginFlag: 'Healthy' },
  { orderId: 'ORD-SMC-224', customerName: 'Lyon Executive Search', revenue: 1850, collected: 1850, productCost: 760, packagingCost: 260, laborCost: 180, shippingCost: 180, discountAmount: 0, cogs: 1380, grossMarginDollars: 470, grossMarginPercent: 25.4, invoiceStatus: 'paid', dueDate: 'Settled', marginFlag: 'Watch' },
  { orderId: 'ORD-SMC-226', customerName: 'Aster Group', revenue: 4800, collected: 1200, productCost: 2380, packagingCost: 720, laborCost: 340, shippingCost: 210, discountAmount: 420, cogs: 3650, grossMarginDollars: 730, grossMarginPercent: 15.2, invoiceStatus: 'overdue', dueDate: 'Overdue by 5 days', marginFlag: 'Blocked' },
]

export const customerProfiles: CustomerProfile[] = [
  { id: 'cust-aurora', name: 'Aurora Capital', segment: 'Corporate', lifetimeValue: 84200, lastOrderLabel: '28 days ago', vipStatus: true, nextOpportunity: 'Holiday board gifting program', notes: ['Prefers elegant monochrome packaging', 'Needs bilingual recipient experience'], preferredLanguage: 'Bilingual' },
  { id: 'cust-verve', name: 'Verve Hotels', segment: 'VIP', lifetimeValue: 112300, lastOrderLabel: '11 days ago', vipStatus: true, nextOpportunity: 'Summer concierge amenity boxes', notes: ['Multi-property coordination', 'Approvals routed through regional marketing lead'], preferredLanguage: 'Bilingual' },
  { id: 'cust-boreal', name: 'Boreal Advisory', segment: 'Growing', lifetimeValue: 28700, lastOrderLabel: 'Today', vipStatus: false, nextOpportunity: 'Quarterly board cadence', notes: ['Board retreat gifting every quarter'], preferredLanguage: 'EN' },
  { id: 'cust-milo', name: 'Milo & Co', segment: 'Seasonal', lifetimeValue: 16400, lastOrderLabel: '2 days ago', vipStatus: false, nextOpportunity: 'Founder anniversary gifting', notes: ['Strong response to local artisan add-ons'], preferredLanguage: 'FR' },
]

export const quoteRequestBrief: QuoteRequestBrief = {
  id: 'brief-501',
  occasion: 'Executive client appreciation',
  quantity: 85,
  budgetRange: '$120-$160 per gift',
  timeline: 'Delivery during the second week of June',
  brandingNeeds: 'Subtle foil monogram, bilingual enclosure, no loud corporate branding',
  deliveryNeeds: 'Split shipment to Montreal, Toronto, and Vancouver with tracked arrival windows',
  conciergeTone: 'Premium, polished, founder-level gifting support',
  languageMode: 'Bilingual',
}

export const corporateCampaigns: CorporateCampaignRecord[] = [
  { id: 'camp-610', accountName: 'Aurora Capital', theme: 'Executive holiday gifting', status: 'Awaiting approval', recipientCount: 120, addressCount: 34, brandedInsert: true, deadline: 'Recipient file lock Friday', invoiceTerms: 'NET15 balance after shipment', depositOutstanding: 5520, nextAction: 'CFO review at 3 PM', approvalCheckpoint: 'Budget + branded insert sign-off', reorderReady: true },
  { id: 'camp-611', accountName: 'Verve Hotels', theme: 'Mothers Day guest gifting suite', status: 'Deposit pending', recipientCount: 240, addressCount: 6, brandedInsert: true, deadline: 'Proof approval by Thursday', invoiceTerms: '30% deposit before reservation', depositOutstanding: 4125, nextAction: 'Deposit reminder queued', approvalCheckpoint: 'Regional marketing approval', reorderReady: false },
  { id: 'camp-612', accountName: 'Boreal Advisory', theme: 'Quarterly board retreat gifts', status: 'In production', recipientCount: 42, addressCount: 1, brandedInsert: false, deadline: 'Deliver next Tuesday', invoiceTerms: 'Balance due at shipment', depositOutstanding: 0, nextAction: 'Finalize recipient rooming list', approvalCheckpoint: 'Board coordinator confirmation', reorderReady: true },
  { id: 'camp-613', accountName: 'Langlois & Fils', theme: 'Returning law firm holiday campaign', status: 'Planning', recipientCount: 80, addressCount: 18, brandedInsert: true, deadline: 'Pilot proposal next week', invoiceTerms: 'NET15 with deposit exception', depositOutstanding: 0, nextAction: 'Reorder starter ready from last year campaign', approvalCheckpoint: 'Partner committee approval', reorderReady: true },
]

export const seasonalCampaigns: SeasonalCampaign[] = [
  { id: 'season-1', season: 'Christmas', launchWindow: 'Launch in September', audience: 'Corporate leadership teams and top clients', pipelineValue: 96000, heroConcept: 'Quiet Luxury Holiday Reserve', operationalNeed: 'Secure chocolate and rigid box inventory by July', status: 'Building' },
  { id: 'season-2', season: 'Mothers Day', launchWindow: 'Launch in March', audience: 'Hotels, spas, and executive teams', pipelineValue: 48200, heroConcept: 'Blush Heritage Thank You Collection', operationalNeed: 'Bilingual proof templates and floral sleeve supplier locked', status: 'Ready to launch' },
  { id: 'season-3', season: 'Employee Appreciation', launchWindow: 'Launch in April', audience: 'HR and People Ops leads', pipelineValue: 37800, heroConcept: 'Culture Wins Recognition Box', operationalNeed: 'Recipient upload and personalization workflow ready', status: 'Live' },
]

export const shippingOperations: ShippingOperation[] = [
  { id: 'ship-1', orderId: 'ORD-SMC-224', customerName: 'Lyon Executive Search', mode: 'Local delivery', trackingState: 'Out for delivery', rush: true, addressCount: 1, promiseWindow: 'Today 3 PM to 5 PM', courier: 'SMC Driver Team', calendarSlot: 'Today PM route' },
  { id: 'ship-2', orderId: 'ORD-SMC-225', customerName: 'Aurora Capital', mode: 'Corporate multi-drop', trackingState: 'Queued', rush: false, addressCount: 34, promiseWindow: 'Staggered next Thursday to Friday', courier: 'SMC + carrier hybrid', calendarSlot: 'Corporate holiday drop A', delayedAlert: 'Recipient CSV still incomplete for western offices' },
  { id: 'ship-3', orderId: 'ORD-SMC-221', customerName: 'Verve Hotels', mode: 'Carrier shipment', trackingState: 'Label created', rush: false, addressCount: 6, promiseWindow: 'Friday arrival', courier: 'Purolator', calendarSlot: 'Friday outbound', delayedAlert: 'Blocked until deposit and proof clear' },
  { id: 'ship-4', orderId: 'ORD-SMC-227', customerName: 'Maison Sereine', mode: 'Pickup', trackingState: 'Queued', rush: false, addressCount: 1, promiseWindow: 'Pickup Thursday 11 AM', courier: 'Client pickup', calendarSlot: 'Thursday pickup block' },
]

export const deliveryCalendar: DeliveryCalendarEntry[] = [
  { id: 'cal-1', dateLabel: 'Today', slot: 'PM', routeName: 'Montreal concierge rush route', stops: 4, rushOrders: 2 },
  { id: 'cal-2', dateLabel: 'Thursday', slot: 'AM', routeName: 'Corporate downtown drop', stops: 9, rushOrders: 0 },
  { id: 'cal-3', dateLabel: 'Friday', slot: 'All day', routeName: 'Carrier release wave', stops: 14, rushOrders: 1 },
]

export const crmReminders: CrmReminder[] = [
  { id: 'crm-1', customerId: 'cust-aurora', customerName: 'Aurora Capital', type: 'Repeat order', note: 'Reopen holiday leadership gifting in June before budget locks.', when: 'Next Monday' },
  { id: 'crm-2', customerId: 'cust-verve', customerName: 'Verve Hotels', type: 'VIP follow-up', note: 'Review concierge amenity gifting pilot after Mothers Day delivery.', when: 'Friday' },
  { id: 'crm-3', customerId: 'cust-milo', customerName: 'Milo & Co', type: 'Seasonal reactivation', note: 'Pitch founder anniversary edition with local artisan bundle.', when: 'In 10 days' },
]

export const shellNotifications: ShellNotification[] = [
  { id: 'note-1', title: 'Chocolate delay hits holiday reserve', note: 'Aurora Capital and two premium bundles need substitution approval this week.' },
  { id: 'note-2', title: 'Rush local delivery on clock', note: 'Lyon Executive Search must leave the studio by 3 PM to hit same-day handoff.' },
  { id: 'note-3', title: 'Margin leak on Aster basket', note: 'Discounting and packaging creep pushed one order under the safe margin floor.' },
]

export const notificationCenterItems: NotificationCenterItem[] = [
  { id: 'center-1', title: 'Owner handoff requested', note: 'Rox needs margin override context before approving the Aurora substitution.', owner: 'Rox', channel: 'Approvals', priority: 'critical', mention: 'rox' },
  { id: 'center-2', title: 'Mention from growth desk', note: 'Fred flagged the FR branded search campaign for budget expansion after a 5.2x ROAS spike.', owner: 'Fred', channel: 'Google Ads', priority: 'watch', mention: 'fred' },
  { id: 'center-3', title: 'Corporate portal follow-up', note: 'Lissa should review the Verve Hotels reorder brief before recipient uploads open.', owner: 'Lissa', channel: 'Corporate Portal', priority: 'normal', mention: 'lissa' },
  { id: 'center-4', title: 'Zoho sync digest', note: 'Three VIP reminders were refreshed into the concierge queue from Zoho this morning.', owner: 'CS Team', channel: 'Zoho CRM', priority: 'normal' },
]

export const ownerHandoffs: OwnerHandoff[] = [
  { id: 'handoff-1', from: 'Rox', to: 'Lissa', subject: 'Approve premium chocolate substitution for Aurora board gifts', dueBy: 'Today 13:30', status: 'new' },
  { id: 'handoff-2', from: 'Fred', to: 'Rox', subject: 'Confirm FR-only landing page promise before scaling Quebec search spend', dueBy: 'Today 15:00', status: 'accepted' },
  { id: 'handoff-3', from: 'Operations', to: 'Fred', subject: 'Align holiday launch copy with shipping capacity cap for Montreal same-day', dueBy: 'Tomorrow 09:00', status: 'ready' },
]

export const aiInsightCards: AiInsightCard[] = [
  { id: 'ai-1', title: 'Margin leakage predicted on one concierge quote', insight: 'Packaging upgrades and a 12% discount request will pull the Aster quote below the safe gross-margin floor unless the tier is raised.', confidence: 'High', actionOwner: 'Rox', module: 'quote-pipeline' },
  { id: 'ai-2', title: 'Best flagship wedge is corporate reorders', insight: 'Aurora and Langlois show the fastest payback path because recipient memory and invoice terms already exist.', confidence: 'High', actionOwner: 'Lissa', module: 'executive-dashboard' },
  { id: 'ai-3', title: 'Google Ads FR campaign deserves expansion', insight: 'French branded search is pacing at stronger ROAS than broad national spend and should be scaled before the next seasonal launch window.', confidence: 'Medium', actionOwner: 'Fred', module: 'google-ads-command-center' },
  { id: 'ai-4', title: 'Zoho concierge activity is a close signal', insight: 'Three VIP reminders now align with live quote windows, suggesting a same-week proposal sprint can convert a first flagship account.', confidence: 'Medium', actionOwner: 'CS Team', module: 'crm-internal-view' },
]

export const assignmentRecords: AssignmentRecord[] = [
  { id: 'assign-1', title: 'Finalize flagship proposal pricing ladder for Aurora', owner: 'Lissa', dueBy: 'Today 16:00', status: 'in-progress', module: 'quote-pipeline' },
  { id: 'assign-2', title: 'Validate premium chocolate substitution margin impact', owner: 'Rox', dueBy: 'Today 14:00', status: 'blocked', module: 'finance-surface' },
  { id: 'assign-3', title: 'Refresh Quebec branded search budget recommendation', owner: 'Fred', dueBy: 'Today 15:30', status: 'new', module: 'google-ads-command-center' },
  { id: 'assign-4', title: 'Prepare investor-grade demo close with reorder proof', owner: 'Nadia', dueBy: 'Tomorrow 09:00', status: 'in-progress', module: 'executive-dashboard' },
]

export const activityTimeline: ActivityTimelineEvent[] = [
  { id: 'act-1', at: '09:08', actor: 'Zoho connector', action: 'Synced VIP reminders', detail: 'Three concierge opportunities were refreshed into the CRM operating queue.', module: 'crm-internal-view' },
  { id: 'act-2', at: '09:14', actor: 'Fred', action: 'Commented on campaign pacing', detail: 'Requested a budget shift to FR brand search based on same-day ROAS trend.', module: 'google-ads-command-center' },
  { id: 'act-3', at: '09:22', actor: 'Rox', action: 'Flagged proposal margin risk', detail: 'Aster concierge quote moved to approval review after packaging creep.', module: 'quote-pipeline' },
  { id: 'act-4', at: '09:31', actor: 'Lissa', action: 'Assigned flagship pricing review', detail: 'Aurora proposal pricing ladder was routed into today\'s founder close plan.', module: 'executive-dashboard' },
]

export const commentThread: CommentThreadItem[] = [
  { id: 'comment-1', author: 'Lissa', audience: 'owner', message: '@Rox we need a clean premium-vs-signature recommendation before the Aurora meeting.', at: '09:18', module: 'quote-pipeline' },
  { id: 'comment-2', author: 'Fred', audience: 'internal', message: '@Lissa the FR search campaign gives us the strongest acquisition story for the investor walkthrough.', at: '09:21', module: 'executive-dashboard' },
  { id: 'comment-3', author: 'Customer Service', audience: 'client', message: 'Aurora asked for a clearer ROI summary in the proposal deck and a delivery confidence slide.', at: '09:26', module: 'corporate-client-portal' },
]

export const proposalPackages: ProposalPackage[] = [
  { id: 'proposal-essential', tier: 'Essential', pricePerRecipient: 118, depositPercent: 30, leadTime: '12 business days', marginPercent: 29.4, promise: 'Premium gifting baseline with branded inserts and bilingual service copy.', inclusions: ['Curated basket assortment', 'Bilingual insert cards', 'Corporate recipient workbook'] },
  { id: 'proposal-premium', tier: 'Premium', pricePerRecipient: 154, depositPercent: 40, leadTime: '10 business days', marginPercent: 33.8, promise: 'Best-fit flagship tier for executive gifting with stronger margin protection.', inclusions: ['Quiet-luxury packaging', 'Founder review checkpoint', 'Delivery confidence updates'] },
  { id: 'proposal-signature', tier: 'Signature', pricePerRecipient: 198, depositPercent: 50, leadTime: '7 business days', marginPercent: 36.1, promise: 'High-touch concierge tier for landmark accounts and investor-grade presentations.', inclusions: ['Signature artisan assortment', 'Dedicated concierge route', 'Board-ready PDF proposal deck'] },
]

export const liveConnectors: LiveConnector[] = [
  { id: 'shopify-core', name: 'Shopify Plus storefront', system: 'Shopify', status: 'healthy', lastSync: '2 min ago', latencyMs: 182, note: 'Orders, bundles, and cart confidence copy are current.', modules: ['shopify-intelligence-hub', 'guided-gift-builder', 'website-conversion-center'] },
  { id: 'ads-core', name: 'Google Ads revenue sync', system: 'Google Ads', status: 'healthy', lastSync: '5 min ago', latencyMs: 241, note: 'Campaign spend and conversion cohorts refreshed on schedule.', modules: ['google-ads-command-center', 'campaign-command-center'] },
  { id: 'zoho-core', name: 'Zoho CRM concierge bridge', system: 'Zoho', status: 'syncing', lastSync: '11 min ago', latencyMs: 524, note: 'VIP reminders and account owner mentions are being replayed after a field mapping update.', modules: ['crm-internal-view', 'corporate-client-portal', 'loyalty-vip-system'] },
]

export const currentOperator = {
  name: 'Nadia Belanger',
  initials: 'NB',
  role: 'Founder / Operator',
  region: 'Montreal',
}

export const executiveSnapshot: ExecutiveMetricSnapshot = {
  revenueToday: 18400,
  revenueWeek: 61250,
  revenueMonth: 147300,
  quotesPending: quoteWorkspaces.filter((quote) => ['reviewing', 'pricing', 'sent', 'approved'].includes(quote.stage)).length,
  ordersAtRiskToday: customOrders.filter((order) => order.atRisk).length,
  vendorDelaysAffectingOrders: vendorRiskAlerts.filter((alert) => alert.risk === 'late').length,
  depositsOutstanding: profitabilityRecords.filter((record) => record.invoiceStatus === 'deposit due' || record.invoiceStatus === 'overdue').length,
  marginAlerts: profitabilityRecords.filter((record) => record.marginFlag !== 'Healthy').length + quoteWorkspaces.filter((quote) => quote.marginPercent < 25).length,
  shippingQueueVolume: shippingOperations.filter((operation) => operation.trackingState !== 'Delivered').length,
  inventoryShortageWarnings: inventorySkus.filter((sku) => sku.bundleShortage || sku.urgentReplenishment).length,
  topCustomers: customerProfiles.slice(0, 3),
  seasonalOpportunities: seasonalCampaigns,
  topCorporateClients: [
    { name: 'Verve Hotels', value: 112300, note: 'Multi-property gifting with bilingual service expectations' },
    { name: 'Aurora Capital', value: 84200, note: 'Holiday and board gifting with complex multi-drop logistics' },
    { name: 'Langlois & Fils', value: 55600, note: 'Returning law firm client ready for reorder automation' },
  ],
  teamWorkload: [
    { owner: 'Nadia', active: 6, blocked: 1, note: 'Owner handling rush order and one premium approval path' },
    { owner: 'Arielle', active: 5, blocked: 2, note: 'Two corporate campaigns depend on deposit and recipient list readiness' },
    { owner: 'Sophie', active: 4, blocked: 1, note: 'Supplier recovery and substitution approvals on holiday stock' },
  ],
}

export const orderTrackingStory: {
  orderId: string
  customerName: string
  stage: OrderTrackingStage
  stages: Array<{ label: OrderTrackingStage; note: string; done: boolean; active: boolean }>
} = {
  orderId: 'ORD-SMC-220',
  customerName: 'Boreal Advisory',
  stage: 'in production',
  stages: [
    { label: 'confirmed', note: 'Quote approved and order released by Shop Moi Ca', done: true, active: false },
    { label: 'in production', note: 'Components are reserved and assembly is underway', done: false, active: true },
    { label: 'packaging', note: 'Final wrapping, insert cards, and personalization checks', done: false, active: false },
    { label: 'shipped', note: 'Courier handoff with tracking and recipient notifications', done: false, active: false },
    { label: 'delivered', note: 'Delivery confirmed and client success follow-up triggered', done: false, active: false },
  ],
}

export const demoScenarios: DemoScenario[] = [
  { id: 'demo-1', title: 'Christmas 200-order corporate campaign', summary: 'Aurora Capital needs a staggered 34-address executive gift release with branded inserts.', impact: 'Touches recipient uploads, vendor delays, reservations, shipping waves, and bilingual client comms.', route: '/internal/shipping-center' },
  { id: 'demo-2', title: 'Vendor delay on premium chocolate SKU', summary: 'Chocolaterie Mont-Royal is late on a hero component required by the holiday reserve bundle.', impact: 'Forces substitution and highlights bundle profitability impact before approval.', route: '/internal/supplier-po-center' },
  { id: 'demo-3', title: 'Rush executive gift order', summary: 'Lyon Executive Search needs same-day local delivery for a founder-level gift.', impact: 'Tests rush prioritization, local delivery queue, and SLA at-risk handling.', route: '/internal/shipping-center' },
  { id: 'demo-4', title: 'Returning law firm reorder', summary: 'Langlois & Fils wants a faster relaunch of last years holiday program.', impact: 'Exercises campaign memory, reorder acceleration, invoice terms, and recipient import.', route: '/client/corporate-client-portal' },
  { id: 'demo-5', title: 'Margin warning on over-discounted basket', summary: 'Aster Group requested packaging upgrades and a price concession that broke safe margin.', impact: 'Shows why the finance surface must stop bad deals before approval.', route: '/internal/finance-surface' },
  { id: 'demo-6', title: 'Same-day local delivery queue', summary: 'Four Montreal deliveries need coordination across pickup and direct drop windows.', impact: 'Demonstrates shipping calendar control and client confidence updates.', route: '/internal/shipping-center' },
]

export const shopifyMetrics: ShopifyMetric[] = [
  { label: 'Top products', value: 'Executive Quiet Luxury Basket, Bilingual Insert Set, Founder Welcome Box', note: 'Highest revenue and attach rate this month.' },
  { label: 'AOV', value: '$214', note: 'Up 11% versus prior period with bundle-first merchandising.' },
  { label: 'Repeat purchase rate', value: '42%', note: 'Corporate and VIP segments are driving repeat cadence.' },
  { label: 'Abandoned cart trend', value: '17%', note: 'Down 4 points after shipping confidence copy updates.' },
  { label: 'Traffic to revenue', value: '3.8%', note: 'Session-to-purchase conversion on high-intent campaigns.' },
]

export const shopifyBundlePerformance: ShopifyBundlePerformance[] = [
  { bundleSku: 'BND-EXEC-001', conversionRate: 6.8, aov: 244, repeatRate: 38 },
  { bundleSku: 'BND-EXEC-002', conversionRate: 4.2, aov: 198, repeatRate: 29 },
  { bundleSku: 'BND-MAISON-001', conversionRate: 5.5, aov: 221, repeatRate: 33 },
]

export const adsCampaigns: AdsCampaignPerformance[] = [
  { campaign: 'Holiday Corporate Gifts - Brand', channel: 'Search', language: 'EN', spend: 4200, conversions: 54, cpa: 77.8, roas: 5.4, branded: true, geo: 'Montreal + Toronto' },
  { campaign: 'Cadeaux corporatifs premium', channel: 'Search', language: 'FR', spend: 2600, conversions: 31, cpa: 83.9, roas: 4.8, branded: false, geo: 'Montreal + Quebec City' },
  { campaign: 'Executive Gift Baskets PMax', channel: 'Performance Max', language: 'EN', spend: 5100, conversions: 48, cpa: 106.3, roas: 4.1, branded: false, geo: 'National' },
]

export const campaignExecution: CampaignExecutionRecord[] = [
  { id: 'camp-exec-1', campaign: 'Christmas Corporate Wave', owner: 'Fred', channel: 'Shopify + Ads + Email', status: 'Asset build', launchWindow: 'September week 1', roiNote: 'Projected 5.1x blended ROI with early recipient capture.' },
  { id: 'camp-exec-2', campaign: 'Mothers Day Maison', owner: 'Fred', channel: 'Instagram + Meta Ads', status: 'Launch ready', launchWindow: 'March week 2', roiNote: 'Projected 4.2x with hotel partner expansion.' },
  { id: 'camp-exec-3', campaign: 'Law Firm Reorder Sprint', owner: 'Lissa', channel: 'Corporate portal + direct outreach', status: 'Planning', launchWindow: 'Next 10 days', roiNote: 'High-margin reorder path with minimal acquisition spend.' },
]

export const socialPlanner: SocialPlanItem[] = [
  { id: 'soc-1', platform: 'Instagram', theme: 'Holiday executive basket unboxing', postDate: 'Tue 9:00 AM', assetStatus: 'In production', collaborator: 'Montreal studio creator' },
  { id: 'soc-2', platform: 'Facebook', theme: 'Corporate reorder case study', postDate: 'Thu 1:00 PM', assetStatus: 'Approved' },
  { id: 'soc-3', platform: 'Instagram', theme: 'Local artisan partner spotlight', postDate: 'Sat 11:00 AM', assetStatus: 'Requested', collaborator: 'Chocolaterie Mont-Royal' },
]

export const websiteFunnel: WebsiteFunnelMetric[] = [
  { page: '/collections/executive-gifts', sessions: 8400, ctaClicks: 1210, quoteRequests: 214, builderStarts: 302, bounceRate: 34, dropOff: 'Price ladder unclear below $150 tier' },
  { page: '/corporate', sessions: 4200, ctaClicks: 990, quoteRequests: 311, builderStarts: 76, bounceRate: 27, dropOff: 'Recipient upload details discovered late' },
  { page: '/seasonal/christmas', sessions: 6900, ctaClicks: 1330, quoteRequests: 286, builderStarts: 255, bounceRate: 31, dropOff: 'Shipping promise copy needs stronger FR variant' },
]

export const guidedBuilderPresets: GuidedBuilderPreset[] = [
  { id: 'preset-1', budget: '$120-$160', recipient: 'Executive client', occasion: 'Holiday appreciation', luxuryLevel: 'Signature', corporate: true, localFavorites: true, timeline: '2-3 weeks', recommendedSkus: ['BND-EXEC-001', 'ADD-CARD-001'], estimatedTotal: 14800, marginPercent: 33.6 },
  { id: 'preset-2', budget: '$70-$110', recipient: 'Team recognition', occasion: 'Employee appreciation', luxuryLevel: 'Premium', corporate: true, localFavorites: false, timeline: '10 days', recommendedSkus: ['BND-MAISON-001', 'ADD-GC-001'], estimatedTotal: 9800, marginPercent: 29.4 },
  { id: 'preset-3', budget: '$180-$240', recipient: 'VIP founder', occasion: 'Milestone celebration', luxuryLevel: 'Signature', corporate: false, localFavorites: true, timeline: 'Rush 72h', recommendedSkus: ['BND-EXEC-001', 'PRD-CHO-002'], estimatedTotal: 2650, marginPercent: 31.2 },
]

export const loyaltyProfiles: LoyaltyProfile[] = [
  { customerId: 'cust-aurora', tier: 'Founder Circle', rewardsBalance: 840, repeatOrders: 14, savedPreferences: ['Monochrome packaging', 'Bilingual inserts', 'Executive tier assortments'], earlySeasonalAccess: true, conciergeEligible: true },
  { customerId: 'cust-verve', tier: 'Platinum', rewardsBalance: 620, repeatOrders: 19, savedPreferences: ['Hotel amenity bundles', 'Property-specific inserts'], earlySeasonalAccess: true, conciergeEligible: true },
  { customerId: 'cust-boreal', tier: 'Gold', rewardsBalance: 210, repeatOrders: 6, savedPreferences: ['Quarterly retreat kits', 'Board-level personalization'], earlySeasonalAccess: false, conciergeEligible: false },
]

export const exportReports: ExportReportDefinition[] = [
  { id: 'rep-1', name: 'Quote Pipeline Snapshot', format: 'CSV', source: 'QuoteWorkspace', updatedAt: 'Today 09:10', audience: 'Sales + founders', polishNote: 'Includes priority staging, safe-margin flags, and follow-up ownership.', filename: 'shopmoica-quote-pipeline-snapshot.csv' },
  { id: 'rep-2', name: 'Outstanding Deposits', format: 'PDF', source: 'OrderProfitabilityRecord', updatedAt: 'Today 09:12', audience: 'Finance + founders', polishNote: 'Founder-ready PDF with payment blockers, aging, and release risk.', filename: 'shopmoica-outstanding-deposits.pdf' },
  { id: 'rep-3', name: 'Campaign Performance Summary', format: 'PDF', source: 'CampaignExecutionRecord', updatedAt: 'Today 09:08', audience: 'Growth + founders', polishNote: 'Board-ready narrative with channel mix, ROI, and launch posture.', filename: 'shopmoica-campaign-performance-summary.pdf' },
  { id: 'rep-4', name: 'Top Customers and Repeat Revenue', format: 'CSV', source: 'CustomerProfile', updatedAt: 'Today 09:05', audience: 'CRM + growth', polishNote: 'Segmented export with VIP memory, repeat value, and reactivation timing.', filename: 'shopmoica-top-customers-repeat-revenue.csv' },
  { id: 'rep-5', name: 'Vendor Scorecards', format: 'PDF', source: 'SupplierProfile', updatedAt: 'Today 09:06', audience: 'Ops + founders', polishNote: 'Premium scorecard layout with artisan notes, on-time reliability, and seasonal risk.', filename: 'shopmoica-vendor-scorecards.pdf' },
  { id: 'rep-6', name: 'Shipping Queue Operations', format: 'CSV', source: 'ShippingOperation', updatedAt: 'Today 09:11', audience: 'Shipping + support', polishNote: 'Dispatch-grade CSV with rush ordering, route density, and client promise windows.', filename: 'shopmoica-shipping-queue-operations.csv' },
  { id: 'rep-7', name: 'Margin Intelligence Report', format: 'PDF', source: 'OrderProfitabilityRecord', updatedAt: 'Today 09:15', audience: 'Founders + finance', polishNote: 'Luxury-styled margin report spotlighting healthy, watch, and blocked deals.', filename: 'shopmoica-margin-intelligence-report.pdf' },
]

export const engineSurfaceMap = new Map(listFlowEngineModules().map((module) => [module.id, module]))

export function toPaymentGateOrder(order: CustomOrderRecord): FlowPaymentGateOrder {
  return {
    id: order.id,
    total_amount: order.orderValue,
    payment_status: order.paymentStatus,
    status:
      order.productionStage === 'completed'
        ? 'COMPLETED'
        : order.productionStage === 'shipped'
          ? 'SHIPPED'
          : 'CONFIRMED',
  }
}

export function getPaymentGateSummary(order: CustomOrderRecord) {
  return getPaymentGateState(toPaymentGateOrder(order), order.amountPaid, smcDepositRule)
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(amount)
}
