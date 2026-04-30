export type MaestriaLocale = 'en-CA' | 'fr-CA'

export type CommerceLaneId = 'internal' | 'client'

export interface CommerceKpi {
  label: string
  value: string
  note: string
}

export interface CommerceModule {
  lane: CommerceLaneId
  slug: string
  path: string
  title: string
  strapline: string
  summary: string
  outcome: string
  stages: string[]
  components: string[]
  dataModels: string[]
  engineModules: string[]
  revenueLevers: string[]
  wowMoments: string[]
  stickiness: string[]
  kpis: CommerceKpi[]
}

export interface DataModelDefinition {
  name: string
  purpose: string
  fields: string[]
}

export interface RolloutPhase {
  window: string
  focus: string
  outcomes: string[]
}

export interface RepoSequenceItem {
  step: string
  surfaces: string[]
}

export interface RevenueModelItem {
  lever: string
  mechanism: string
  impact: string
}

export interface MaestriaCopy {
  eyebrow: string
  title: string
  subtitle: string
  laneA: string
  laneB: string
  sitemapTitle: string
  dataTitle: string
  roadmapTitle: string
  revenueTitle: string
  wowTitle: string
  stickinessTitle: string
  mvpTitle: string
}

const internalModules: CommerceModule[] = [
  {
    lane: 'internal',
    slug: 'executive-dashboard',
    path: '/internal/executive-dashboard',
    title: 'Executive Dashboard',
    strapline: 'The founder-relief cockpit for revenue, risk, and workload.',
    summary:
      'Give the owner one screen for revenue pulse, blocked cash, delayed orders, margin erosion, and near-term seasonal demand.',
    outcome: 'The owner sees what needs intervention in under three minutes every morning.',
    stages: ['today', 'week', 'month', 'risk review', 'team pulse'],
    components: [
      'Revenue pulse cards',
      'Orders at risk today rail',
      'Vendor delay impact table',
      'Deposits outstanding queue',
      'Margin alert rail',
      'Top customers leaderboard',
      'Shipping queue volume card',
      'Inventory shortage warning panel',
      'Seasonal demand board',
      'Team workload pulse',
    ],
    dataModels: [
      'ExecutiveMetricSnapshot',
      'QuotePipelineSnapshot',
      'OrderDelayAlert',
      'DepositExposure',
      'VendorRiskAlert',
      'ShippingOperation',
      'CustomerValueProfile',
      'SeasonalOpportunity',
      'WorkloadPulse',
    ],
    engineModules: ['flow.status', 'flow.approvals', 'flow.tasks', 'flow.automations'],
    revenueLevers: [
      'Faster intervention on stuck quotes',
      'Lower deposit leakage',
      'Visibility into margin erosion before shipment',
    ],
    wowMoments: [
      'One homepage showing cash at risk, quotes at risk, and orders at risk together',
      'Seasonal opportunity cards that pull dormant corporate buyers back into play',
    ],
    stickiness: [
      'Daily operator habit',
      'Shared source of truth for founder and staff',
      'Becomes the morning decision ritual',
    ],
    kpis: [
      { label: 'Revenue today', value: '$18.4K', note: 'Live booked and collected cash view' },
      { label: 'Orders at risk today', value: '3', note: 'SLA, vendor, or payment blockers require intervention' },
      { label: 'Vendor delays', value: '2', note: 'Supplier issues currently affecting live orders' },
      { label: 'Shipping queue', value: '4', note: 'Outbound jobs still needing release or delivery control' },
    ],
  },
  {
    lane: 'internal',
    slug: 'quote-pipeline',
    path: '/internal/quote-pipeline',
    title: 'Quote Pipeline',
    strapline: 'A premium quote system built to win without leaking margin.',
    summary:
      'Manage new, reviewing, pricing, sent, approved, won, and lost quotes with templates, margin guidance, follow-ups, and one-click conversion to orders.',
    outcome: 'Quotes move faster while preserving profitability discipline.',
    stages: ['new', 'reviewing', 'pricing', 'sent', 'approved', 'won', 'lost'],
    components: [
      'Quote stage board',
      'Template selector',
      'Margin guidance drawer',
      'Branded quote PDF generator',
      'Follow-up reminder queue',
      'Convert-to-order action bar',
    ],
    dataModels: [
      'QuoteWorkspace',
      'QuoteTemplate',
      'MarginGuidanceAlert',
      'QuotePdfManifest',
      'FollowUpReminder',
      'QuoteConversionRecord',
    ],
    engineModules: ['flow.intake', 'flow.approvals', 'flow.quoting', 'flow.automations'],
    revenueLevers: [
      'Higher win rate from faster proposal turnaround',
      'Protected contribution margin',
      'Better follow-up conversion',
    ],
    wowMoments: [
      'Premium quote PDFs that feel like a luxury brand, not a spreadsheet export',
      'Inline safe-margin guidance before staff send bad deals',
    ],
    stickiness: [
      'Historical template library compounds over time',
      'Follow-up memory becomes institutional instead of personal',
    ],
    kpis: [
      { label: 'Quotes pending', value: '23', note: 'Across all seven stages' },
      { label: 'Median quote cycle', value: '19h', note: 'Request to quote sent' },
      { label: 'Win rate', value: '41%', note: 'Trailing 30-day conversion' },
    ],
  },
  {
    lane: 'internal',
    slug: 'custom-order-management',
    path: '/internal/custom-order-management',
    title: 'Custom Order Management',
    strapline: 'Operational control for bespoke, high-touch orders.',
    summary:
      'Track packaging specs, personalization notes, deadlines, dependencies, and production stage for every custom order.',
    outcome: 'Fewer misses between quote acceptance and fulfillment execution.',
    stages: [
      'quote approved',
      'deposit received',
      'components reserved',
      'assembly queued',
      'in production',
      'quality check',
      'packed',
      'shipped / out for delivery',
      'completed',
    ],
    components: [
      'Order master record',
      'Packaging specification panel',
      'Personalization brief',
      'Component reservation rail',
      'SLA timer and at-risk flags',
      'Deadline dependency graph',
      'Production stage indicator',
    ],
    dataModels: [
      'CustomOrderRecord',
      'PackagingSpec',
      'PersonalizationInstruction',
      'InventoryReservation',
      'DeliveryDependency',
      'ProductionCheckpoint',
    ],
    engineModules: ['flow.routing', 'flow.tasks', 'flow.status'],
    revenueLevers: [
      'Protects premium custom-order margin',
      'Reduces remake costs',
      'Improves delivery reliability for corporate buyers',
    ],
    wowMoments: ['A single premium record that unifies every detail the team normally chases across chats and email.'],
    stickiness: ['Operational memory stays inside the system, not inside one project manager.'],
    kpis: [
      { label: 'Orders due this week', value: '14', note: 'Sorted by dependency risk' },
      { label: 'Blocked dependencies', value: '3', note: 'Packaging, proof, or supplier blockers' },
      { label: 'On-time rate', value: '96%', note: 'Custom orders delivered on promise' },
    ],
  },
  {
    lane: 'internal',
    slug: 'production-tracker',
    path: '/internal/production-tracker',
    title: 'Production Tracker',
    strapline: 'From queued to completed, with proof and quality gates.',
    summary:
      'Run the production line through queued, preparing, assembling, quality check, ready, shipped, and completed with evidence-driven transitions.',
    outcome: 'Production moves with confidence instead of hallway follow-up.',
    stages: [
      'queued',
      'assembling',
      'quality check',
      'packed',
      'shipped',
      'completed',
    ],
    components: [
      'Production board',
      'Proof desk queue',
      'Reservation verification rail',
      'Quality check checklist',
      'Ready-to-ship summary',
      'SLA breach alert strip',
      'Exception lane',
    ],
    dataModels: [
      'ProductionJob',
      'ProofReview',
      'QualityCheckRecord',
      'ShipmentHandoff',
      'ProductionException',
    ],
    engineModules: ['flow.tasks', 'flow.status', 'flow.automations'],
    revenueLevers: [
      'Lower fulfillment failure cost',
      'More reliable delivery promise',
      'Higher trust for high-value orders',
    ],
    wowMoments: ['A proof-to-QC workflow that feels as polished as a premium retail operations desk.'],
    stickiness: ['Production history, QC evidence, and resolution patterns become hard to replace.'],
    kpis: [
      { label: 'Jobs in QC', value: '6', note: 'Awaiting final sign-off' },
      { label: 'Ready today', value: '11', note: 'Prepared for shipping cutoff' },
      { label: 'Exceptions', value: '2', note: 'Need founder review' },
    ],
  },
  {
    lane: 'internal',
    slug: 'inventory-center',
    path: '/internal/inventory-center',
    title: 'Inventory Center',
    strapline: 'Stock discipline for fast-moving seasonal gifting.',
    summary:
      'Show stock on hand, reserved stock, reorder alerts, supplier ETAs, and seasonal inventory positions.',
    outcome: 'The team buys earlier and misses fewer fulfillment windows.',
    stages: ['available', 'reserved', 'reorder needed', 'on PO', 'arriving'],
    components: [
      'Catalog truth ledger',
      'Bundle component availability map',
      'Reserved stock ribbon',
      'Substitution recommendation rail',
      'Reorder alert rail',
      'Supplier ETA board',
      'Seasonal inventory planner',
      'Dead stock and top-seller panel',
    ],
    dataModels: [
      'CatalogSku',
      'BundleAssemblyRequirement',
      'InventorySku',
      'ReservedAllocation',
      'ReorderAlert',
      'SupplierEta',
      'SeasonalStockPlan',
    ],
    engineModules: ['flow.status', 'flow.automations', 'flow.tasks'],
    revenueLevers: [
      'Avoids out-of-stock revenue loss',
      'Reduces dead seasonal inventory',
      'Improves working capital timing',
    ],
    wowMoments: ['Seasonal inventory planning tied directly to quote demand and supplier lead time.'],
    stickiness: ['The forecast and allocation history gets smarter every campaign cycle.'],
    kpis: [
      { label: 'SKUs at risk', value: '8', note: 'Likely to stock out inside 21 days' },
      { label: 'Reserved value', value: '$12.6K', note: 'Committed against live orders' },
      { label: 'Bundle shortages', value: '2', note: 'Partial component gaps threatening assembly' },
    ],
  },
  {
    lane: 'internal',
    slug: 'supplier-po-center',
    path: '/internal/supplier-po-center',
    title: 'Supplier / PO Center',
    strapline: 'Procurement with memory, variance control, and vendor signal.',
    summary:
      'Create POs, route approvals, review vendor history, and surface cost variance alerts before margin slips away.',
    outcome: 'Procurement becomes a controlled lever, not an afterthought.',
    stages: ['draft PO', 'approval', 'sent', 'confirmed', 'received', 'variance review'],
    components: [
      'Vendor directory',
      'PO composer',
      'Approval drawer',
      'Vendor history timeline',
      'MOQ and lead time panel',
      'Cost variance alert panel',
      'Quality note rail',
      'Seasonal readiness board',
      'Receipt and discrepancy workspace',
    ],
    dataModels: [
      'PurchaseOrderRecord',
      'SupplierProfile',
      'VendorCostHistoryEntry',
      'VendorRiskAlert',
      'VendorHistoryEntry',
      'CostVarianceAlert',
      'ReceiptVarianceRecord',
    ],
    engineModules: ['flow.approvals', 'flow.po-invoice', 'flow.tasks'],
    revenueLevers: [
      'Suppresses silent cost creep',
      'Faster PO issuance on won deals',
      'Better vendor decisions through history',
    ],
    wowMoments: ['Cost variance becomes obvious before it kills quote margin.'],
    stickiness: ['Vendor performance history compounds every PO cycle.'],
    kpis: [
      { label: 'POs awaiting approval', value: '5', note: 'High-value or off-standard purchases' },
      { label: 'Variance alerts', value: '3', note: 'Cost moved since quoted price' },
      { label: 'Late-risk vendors', value: '2', note: 'Currently threatening live orders or seasonal launch readiness' },
    ],
  },
  {
    lane: 'internal',
    slug: 'shipping-center',
    path: '/internal/shipping-center',
    title: 'Shipping Center',
    strapline: 'Control local delivery, carriers, pickup, and multi-drop campaigns without chaos.',
    summary:
      'Run local delivery queues, carrier handoffs, pickup orders, corporate multi-address drops, and rush prioritization with customer-safe tracking clarity.',
    outcome: 'Shipping becomes a confident operating discipline instead of an end-of-line scramble.',
    stages: ['label created', 'queued', 'out for delivery', 'in transit', 'delayed', 'delivered'],
    components: [
      'Local delivery queue',
      'Carrier shipment board',
      'Pickup handoff block',
      'Multi-address corporate drop planner',
      'Rush order prioritization rail',
      'Delivery calendar',
      'Delay alert panel',
    ],
    dataModels: [
      'ShippingOperation',
      'DeliveryCalendarEntry',
      'RecipientListBatch',
      'ProjectTrackingSummary',
      'DelayAlert',
    ],
    engineModules: ['flow.status', 'flow.tasks', 'flow.automations'],
    revenueLevers: [
      'Protects premium client trust at fulfillment',
      'Reduces missed or duplicated delivery coordination',
      'Improves rush-order conversion confidence',
    ],
    wowMoments: ['One operator surface that handles local concierge delivery and corporate multi-drop complexity in the same workflow.'],
    stickiness: ['Shipping memory, route rhythm, and corporate drop patterns become deeply operational and hard to replace.'],
    kpis: [
      { label: 'Outbound queue', value: '4', note: 'Orders still needing release, dispatch, or customer-safe updates' },
      { label: 'Rush deliveries', value: '2', note: 'Orders requiring founder-grade prioritization today' },
      { label: 'Delayed shipments', value: '2', note: 'Need proactive recovery before trust erosion' },
    ],
  },
  {
    lane: 'internal',
    slug: 'shopify-intelligence-hub',
    path: '/internal/shopify-intelligence-hub',
    title: 'Shopify Intelligence Hub',
    strapline: 'Commerce telemetry for what is selling, converting, and repeating.',
    summary:
      'Unify Shopify product velocity, AOV, repeat purchase behavior, abandoned cart movement, and bundle performance to guide growth decisions.',
    outcome: 'Fred can optimize demand without guessing what actually drives revenue quality.',
    stages: ['traffic', 'product interest', 'add to cart', 'checkout', 'purchase', 'repeat'],
    components: [
      'Top product leaderboard',
      'AOV trend panel',
      'Repeat purchase tracker',
      'Abandoned cart trend lane',
      'Bundle performance matrix',
      'Traffic to revenue signal board',
    ],
    dataModels: ['ShopifyMetric', 'ShopifyBundlePerformance', 'WebsiteFunnelMetric'],
    engineModules: ['flow.automations', 'flow.status'],
    revenueLevers: [
      'Improves merchandising and bundle tuning',
      'Lifts repeat purchase behavior',
      'Reduces cart abandonment leakage',
    ],
    wowMoments: ['Merchandising decisions are grounded in revenue-quality signals, not just top-line clicks.'],
    stickiness: ['Historical Shopify performance fingerprints become a compounding growth asset.'],
    kpis: [
      { label: 'AOV', value: '$214', note: 'Up 11% versus prior period' },
      { label: 'Repeat purchase rate', value: '42%', note: 'Driven by corporate and VIP segments' },
      { label: 'Bundle conversion', value: '5.5%', note: 'Average across top curated bundles' },
    ],
  },
  {
    lane: 'internal',
    slug: 'google-ads-command-center',
    path: '/internal/google-ads-command-center',
    title: 'Google Ads Command Center',
    strapline: 'Spend, efficiency, and language-level performance in one command view.',
    summary:
      'Track spend, conversions, CPA, ROAS, branded vs non-branded performance, geo signal, and EN/FR campaign outcomes with budget and waste alerts.',
    outcome: 'Fred sees exactly where ad dollars are scaling profit and where budget is leaking.',
    stages: ['budgeting', 'delivery', 'conversion', 'optimization', 'scaling'],
    components: [
      'Spend and conversion scorecards',
      'CPA and ROAS comparison table',
      'Branded vs non-branded split',
      'EN vs FR campaign performance rail',
      'Geo heat performance board',
      'Budget cap and waste alert panel',
    ],
    dataModels: ['AdsCampaignPerformance', 'CampaignExecutionRecord'],
    engineModules: ['flow.automations', 'flow.tasks'],
    revenueLevers: [
      'Reduces wasted spend quickly',
      'Improves ROAS through language and keyword optimization',
      'Prioritizes high-margin demand segments',
    ],
    wowMoments: ['One panel exposes which campaigns deserve more budget right now and which should be throttled.'],
    stickiness: ['Historical campaign intelligence makes each seasonal cycle smarter and cheaper.'],
    kpis: [
      { label: 'Blended ROAS', value: '4.8x', note: 'Across active search and PMax campaigns' },
      { label: 'Avg CPA', value: '$89', note: 'Within target for corporate-qualified leads' },
      { label: 'Waste alerts', value: '2', note: 'Campaigns requiring immediate budget correction' },
    ],
  },
  {
    lane: 'internal',
    slug: 'campaign-command-center',
    path: '/internal/campaign-command-center',
    title: 'Campaign Command Center',
    strapline: 'Plan, launch, and monitor campaign execution without channel drift.',
    summary:
      'Control active campaigns, promo calendar, holiday readiness, launch tracker, and channel performance from one operating desk.',
    outcome: 'Campaign execution becomes coordinated across marketing, operations, and founder approvals.',
    stages: ['planning', 'asset build', 'launch ready', 'live', 'post-mortem'],
    components: [
      'Active campaign board',
      'Promo calendar',
      'Holiday readiness checklist',
      'Asset status tracker',
      'Launch tracker',
      'Channel performance summary',
    ],
    dataModels: ['CampaignExecutionRecord', 'SeasonalCampaign'],
    engineModules: ['flow.tasks', 'flow.status', 'flow.automations'],
    revenueLevers: [
      'Faster campaign launch throughput',
      'Lower launch errors and asset misses',
      'Better cross-channel ROI consistency',
    ],
    wowMoments: ['The team can see exactly what blocks launch and who owns the unblock.'],
    stickiness: ['Campaign memory and post-mortem evidence reduce repeat execution mistakes.'],
    kpis: [
      { label: 'Active campaigns', value: '3', note: 'Currently in planning, build, or launch-ready states' },
      { label: 'Launch readiness', value: '82%', note: 'Assets and approvals complete for next wave' },
      { label: 'Channel spread', value: '4', note: 'Channels currently orchestrated per campaign' },
    ],
  },
  {
    lane: 'internal',
    slug: 'social-presence-planner',
    path: '/internal/social-presence-planner',
    title: 'Social Presence Planner',
    strapline: 'IG and FB planning tied to real campaigns, assets, and collaborations.',
    summary:
      'Coordinate social content calendar, promo themes, asset requests, collaborator work, and posting cadence with campaign context.',
    outcome: 'Social becomes a disciplined demand channel instead of ad hoc posting.',
    stages: ['theme planning', 'asset request', 'production', 'approval', 'scheduled', 'live'],
    components: [
      'IG/FB content calendar',
      'Promo theme board',
      'Asset request queue',
      'Influencer and local partner collab tracker',
      'Posting cadence monitor',
    ],
    dataModels: ['SocialPlanItem', 'CampaignExecutionRecord'],
    engineModules: ['flow.tasks', 'flow.automations'],
    revenueLevers: [
      'Improves campaign top-of-funnel quality',
      'Increases consistency of promotional reach',
      'Strengthens local brand authority through collaborator content',
    ],
    wowMoments: ['Social planning is visibly tied to campaign outcomes, not just a content checklist.'],
    stickiness: ['Cadence history and collab memory reduce planning overhead each month.'],
    kpis: [
      { label: 'Scheduled posts', value: '18', note: 'Next 30 days across IG and FB' },
      { label: 'Asset blockers', value: '3', note: 'Items waiting on production or approval' },
      { label: 'Collab campaigns', value: '2', note: 'Local artisan/influencer integrated campaigns' },
    ],
  },
  {
    lane: 'internal',
    slug: 'website-conversion-center',
    path: '/internal/website-conversion-center',
    title: 'Website Conversion Center',
    strapline: 'Landing-page and funnel intelligence for quote and builder conversion.',
    summary:
      'Track top pages, CTA clicks, quote requests, gift builder usage, bounce indicators, and funnel drop-offs to prioritize conversion improvements.',
    outcome: 'Fred can move site conversion quality every week with clear next actions.',
    stages: ['visit', 'engage', 'cta click', 'quote/builder start', 'submit', 'convert'],
    components: [
      'Top landing page table',
      'CTA click leaderboard',
      'Quote request conversion panel',
      'Gift builder usage tracker',
      'Bounce and drop-off indicator rail',
    ],
    dataModels: ['WebsiteFunnelMetric', 'ShopifyMetric'],
    engineModules: ['flow.intake', 'flow.automations'],
    revenueLevers: [
      'Improves quote and builder conversion',
      'Reduces high-intent traffic waste',
      'Prioritizes fixes with strongest revenue impact',
    ],
    wowMoments: ['Page-level bottlenecks become obvious with actionable context, not vanity metrics.'],
    stickiness: ['Funnel optimization history compounds as a proprietary growth playbook.'],
    kpis: [
      { label: 'Quote request rate', value: '6.7%', note: 'From high-intent landing pages' },
      { label: 'Builder start rate', value: '4.9%', note: 'Sessions entering guided curation flow' },
      { label: 'Bounce watch pages', value: '2', note: 'Pages requiring immediate copy or CTA tuning' },
    ],
  },
  {
    lane: 'internal',
    slug: 'finance-surface',
    path: '/internal/finance-surface',
    title: 'Finance Surface',
    strapline: 'Cash, AOV, invoice risk, and profitability in one place.',
    summary:
      'Track deposits due, unpaid invoices, cash collected, AOV, and order profitability with action-oriented views.',
    outcome: 'Finance and operations finally share the same operational truth.',
    stages: ['deposit due', 'invoice issued', 'payment partial', 'paid', 'profit reviewed'],
    components: [
      'Cash collected scorecard',
      'Deposit aging queue',
      'Unpaid invoices table',
      'Margin composition board',
      'AOV trend chart',
      'Order profitability ledger',
    ],
    dataModels: [
      'CashCollectionSnapshot',
      'DepositAgingRecord',
      'InvoiceRiskRecord',
      'AverageOrderValueTrend',
      'OrderProfitabilityRecord',
      'DiscountImpactRecord',
    ],
    engineModules: ['flow.po-invoice', 'flow.status', 'flow.approvals'],
    revenueLevers: [
      'Cash recovery',
      'Margin protection',
      'Better forecasting for founder decisions',
    ],
    wowMoments: ['Deposits due shown directly beside blocked production and order profitability.'],
    stickiness: ['Once finance uses this for cash recovery, replacement friction rises sharply.'],
    kpis: [
      { label: 'Cash collected MTD', value: '$147K', note: 'Collected against invoices and deposits' },
      { label: 'Unpaid invoices', value: '12', note: 'Requires follow-up or escalation' },
      { label: 'Margin leaks', value: '2', note: 'Orders priced below safe contribution after packaging and shipping' },
    ],
  },
  {
    lane: 'internal',
    slug: 'crm-internal-view',
    path: '/internal/crm-internal-view',
    title: 'CRM Internal View',
    strapline: 'Customer memory, repeat cadence, and VIP context for the team.',
    summary:
      'Show customer history, corporate account structure, repeat-order reminders, and VIP notes that matter in premium gifting.',
    outcome: 'The team treats valuable buyers like known clients, not fresh tickets.',
    stages: ['prospect', 'active', 'repeat', 'vip', 'seasonal revival'],
    components: [
      'Customer history timeline',
      'Corporate account hierarchy',
      'Repeat-order reminder queue',
      'VIP note panel',
      'Seasonal reactivation board',
    ],
    dataModels: [
      'CustomerProfile',
      'CorporateAccount',
      'RepeatOrderReminder',
      'VipClientNote',
      'SeasonalReactivationOpportunity',
    ],
    engineModules: ['flow.intake', 'flow.automations', 'flow.tasks'],
    revenueLevers: [
      'Higher repeat order rate',
      'Better corporate retention',
      'More precise seasonal outreach',
    ],
    wowMoments: ['Corporate buyer memory is instantly visible before a staff member picks up the conversation.'],
    stickiness: ['VIP context and ordering history become a proprietary relationship asset.'],
    kpis: [
      { label: 'Top customers', value: '18', note: 'Contribute 64% of trailing GMV' },
      { label: 'Repeat reminders', value: '27', note: 'Likely reorder opportunities in next 30 days' },
      { label: 'VIP accounts', value: '9', note: 'White-glove handling required' },
    ],
  },
]

const clientModules: CommerceModule[] = [
  {
    lane: 'client',
    slug: 'smart-quote-request-portal',
    path: '/client/smart-quote-request-portal',
    title: 'Smart Quote Request Portal',
    strapline: 'A guided intake flow that captures what staff actually need to quote.',
    summary:
      'Collect occasion, quantity, budget, timeline, branding, and delivery needs in a premium request experience that flows directly into engine-driven quoting.',
    outcome: 'Higher-quality requests, faster first response, less back-and-forth before quoting.',
    stages: ['brief', 'budget', 'brand needs', 'delivery needs', 'review', 'submitted'],
    components: [
      'Occasion and recipient form',
      'Budget and quantity selector',
      'Timeline confidence slider',
      'Branding upload block',
      'Delivery needs planner',
      'Submission summary and next-step promise',
    ],
    dataModels: [
      'QuoteRequestBrief',
      'BrandAssetUpload',
      'DeliveryRequirement',
      'OccasionProfile',
      'QuoteRequestSubmission',
    ],
    engineModules: ['flow.intake', 'flow.routing', 'flow.automations'],
    revenueLevers: [
      'Higher quote-request conversion',
      'Better quote quality from first intake',
      'Faster route to paid orders',
    ],
    wowMoments: ['A request portal that feels concierge-level instead of generic lead capture.'],
    stickiness: ['Customers learn that Maestria understands their brief before they talk to sales.'],
    kpis: [
      { label: 'Request completion', value: '78%', note: 'Visitors who finish intake' },
      { label: 'Avg first response', value: '2.3h', note: 'Submission to team contact' },
      { label: 'Qualified briefs', value: '91%', note: 'Enough detail to quote immediately' },
    ],
  },
  {
    lane: 'client',
    slug: 'guided-gift-builder',
    path: '/client/guided-gift-builder',
    title: 'Guided Gift Builder',
    strapline: 'A luxury-guided builder for budget, recipient, occasion, and taste.',
    summary:
      'Let customers build by budget, recipient, occasion, luxury level, corporate gifting intent, and local favorites without losing premium curation.',
    outcome: 'Customers self-qualify faster and discover higher-value packages.',
    stages: ['budget', 'recipient', 'occasion', 'luxury level', 'curation', 'submit'],
    components: [
      'Budget path selector',
      'Recipient and occasion chips',
      'Luxury level dial',
      'Corporate gifting mode',
      'Local favorites carousel',
      'Curated recommendation grid',
    ],
    dataModels: [
      'GiftBuilderSession',
      'RecipientProfile',
      'OccasionPreset',
      'LuxuryLevelSetting',
      'CuratedBundleSuggestion',
    ],
    engineModules: ['flow.intake', 'flow.quoting', 'flow.automations'],
    revenueLevers: [
      'Upsell into higher-margin bundles',
      'Reduces friction for smaller but profitable orders',
      'Creates repeatable curated-buying journeys',
    ],
    wowMoments: ['The builder feels like a premium shopping concierge, not a configurator.'],
    stickiness: ['Saved preferences and repeat use make future ordering faster and more personal.'],
    kpis: [
      { label: 'Builder conversion', value: '18%', note: 'Sessions that become quote or order' },
      { label: 'Average bundle uplift', value: '+22%', note: 'Compared with manual starter requests' },
      { label: 'Local favorites attach', value: '34%', note: 'Orders including local-curated add-ons' },
    ],
  },
  {
    lane: 'client',
    slug: 'corporate-client-portal',
    path: '/client/corporate-client-portal',
    title: 'Corporate Client Portal',
    strapline: 'The buyer portal for repeat campaigns, approvals, and deposits.',
    summary:
      'Allow corporate buyers to reorder previous campaigns, upload recipient lists, approve quotes, pay deposits, and track projects.',
    outcome: 'Corporate buyers stay inside the relationship instead of falling back to email chaos.',
    stages: ['campaign history', 'reorder', 'upload list', 'approve quote', 'pay deposit', 'track project'],
    components: [
      'Campaign history vault',
      'Reorder starter',
      'Recipient list uploader',
      'Multi-address drop planner',
      'Branded insert approval block',
      'Quote approval center',
      'Deposit payment action panel',
      'Invoice terms panel',
      'Project tracker summary',
    ],
    dataModels: [
      'CorporateCampaignRecord',
      'RecipientListBatch',
      'ClientApprovalRecord',
      'DepositPaymentIntent',
      'ProjectTrackingSummary',
      'ClientInvoiceTerms',
    ],
    engineModules: ['flow.approvals', 'flow.quoting', 'flow.po-invoice', 'flow.status'],
    revenueLevers: [
      'Increases reorder rate',
      'Speeds approvals and deposits',
      'Improves enterprise trust and retention',
    ],
    wowMoments: ['A corporate buyer can reopen a past campaign and relaunch it in minutes.'],
    stickiness: ['Archived campaigns and recipient lists create real switching cost.'],
    kpis: [
      { label: 'Corporate reorders', value: '12', note: 'Triggered this quarter' },
      { label: 'Approval speed', value: '1.6d', note: 'Quote sent to approved' },
      { label: 'Deposit completion', value: '82%', note: 'Approved quotes with deposit paid inside 72h' },
    ],
  },
  {
    lane: 'client',
    slug: 'order-tracking-experience',
    path: '/client/order-tracking-experience',
    title: 'Order Tracking Experience',
    strapline: 'A premium, calm tracking view for high-touch gifting orders.',
    summary:
      'Track orders through confirmed, in production, packaging, shipped, and delivered with proactive guidance and elegant status storytelling.',
    outcome: 'Reduces anxious support contact while increasing client trust.',
    stages: ['confirmed', 'in production', 'packaging', 'shipped', 'delivered'],
    components: [
      'Status timeline',
      'Packaging progress card',
      'Shipping handoff panel',
      'Delivery promise block',
      'Need help action tray',
    ],
    dataModels: [
      'ClientOrderTracker',
      'PackagingProgressUpdate',
      'ShippingMilestone',
      'DeliveryPromise',
      'SupportEscalationRequest',
    ],
    engineModules: ['flow.status', 'flow.automations'],
    revenueLevers: [
      'Fewer reactive support requests',
      'Better post-sale confidence',
      'Improves repeat purchase willingness',
    ],
    wowMoments: ['Tracking feels editorial and premium instead of courier-like and cold.'],
    stickiness: ['Trust during the fulfillment window improves future reorder confidence.'],
    kpis: [
      { label: 'Tracking adoption', value: '73%', note: 'Clients who revisit after order confirmation' },
      { label: 'Support deflection', value: '31%', note: 'Fewer status-check messages' },
      { label: 'Delivered NPS', value: '68', note: 'Measured after order completion' },
    ],
  },
  {
    lane: 'client',
    slug: 'loyalty-vip-system',
    path: '/client/loyalty-vip-system',
    title: 'Loyalty / VIP System',
    strapline: 'Retention mechanics that feel premium, not transactional.',
    summary:
      'Reward repeat buyers, save gifting preferences, and unlock early seasonal access for high-value customers.',
    outcome: 'Stronger repeat purchasing and deeper emotional retention.',
    stages: ['join', 'preference save', 'reward unlock', 'seasonal preview', 'vip concierge'],
    components: [
      'Loyalty tier summary',
      'Saved preference locker',
      'Reward progress tracker',
      'Early seasonal access board',
      'VIP concierge invitation panel',
    ],
    dataModels: [
      'LoyaltyProfile',
      'SavedPreferenceSet',
      'RewardLedgerEntry',
      'SeasonalAccessPass',
      'VipConciergeStatus',
    ],
    engineModules: ['flow.automations', 'flow.tasks'],
    revenueLevers: [
      'More repeat orders',
      'Higher customer lifetime value',
      'Premium account expansion',
    ],
    wowMoments: ['VIP clients feel known before they even start the next order.'],
    stickiness: ['Preferences, tiers, and early-access behavior make the relationship cumulative.'],
    kpis: [
      { label: 'Repeat rate', value: '48%', note: 'Customers ordering more than once in 12 months' },
      { label: 'VIP share', value: '16%', note: 'High-value loyalty segment' },
      { label: 'Early access uptake', value: '57%', note: 'Eligible clients joining seasonal previews' },
    ],
  },
  {
    lane: 'client',
    slug: 'seasonal-campaign-engine',
    path: '/client/seasonal-campaign-engine',
    title: 'Seasonal Campaign Engine',
    strapline: 'The revenue calendar for Christmas, Mother’s Day, Valentine’s, appreciation, and events.',
    summary:
      'Package seasonal campaigns around premium landing pages, campaign starters, and fast handoff into quoting or reorder flows.',
    outcome: 'Turns known seasonal demand into predictable revenue programs.',
    stages: ['campaign brief', 'theme selection', 'launch', 'quote capture', 'conversion', 'retention'],
    components: [
      'Seasonal campaign hub',
      'Holiday landing modules',
      'Campaign starter cards',
      'Employee appreciation toolkit',
      'Conversion and reorder CTA rail',
    ],
    dataModels: [
      'SeasonalCampaign',
      'CampaignTheme',
      'CampaignLead',
      'HolidayInventorySignal',
      'CampaignPerformanceSnapshot',
    ],
    engineModules: ['flow.intake', 'flow.quoting', 'flow.automations', 'flow.status'],
    revenueLevers: [
      'Predictable seasonal pipeline generation',
      'Higher campaign conversion',
      'Better inventory planning from visible demand',
    ],
    wowMoments: ['Seasonal pages feel like premium brand campaigns, not generic sales pages.'],
    stickiness: ['Annual campaign planning becomes easier with every season recorded in-platform.'],
    kpis: [
      { label: 'Seasonal leads', value: '86', note: 'Campaign-originated this quarter' },
      { label: 'Campaign conversion', value: '29%', note: 'Lead to approved quote' },
      { label: 'Reactivation lift', value: '+18%', note: 'Dormant customers revived via campaign engine' },
    ],
  },
  {
    lane: 'client',
    slug: 'concierge-requests',
    path: '/client/concierge-requests',
    title: 'Concierge Requests',
    strapline: 'White-glove intake for premium gifting moments.',
    summary:
      'Offer a premium request path for high-touch clients who need bespoke sourcing, special handling, or executive-level gifting support.',
    outcome: 'Captures premium work without forcing it through commodity forms.',
    stages: ['request', 'concierge review', 'curation', 'proposal', 'delivery coordination'],
    components: [
      'White-glove intake form',
      'Concierge SLA panel',
      'Curated response timeline',
      'Executive gifting note capture',
      'Delivery coordination summary',
    ],
    dataModels: [
      'ConciergeRequest',
      'ConciergePriorityRule',
      'CuratedProposal',
      'ExecutiveRecipientNote',
      'DeliveryCoordinationPlan',
    ],
    engineModules: ['flow.intake', 'flow.routing', 'flow.tasks', 'flow.approvals'],
    revenueLevers: [
      'Captures high-margin premium orders',
      'Raises brand perception',
      'Creates upsell path into VIP handling',
    ],
    wowMoments: ['The form itself signals premium care and operational confidence.'],
    stickiness: ['High-touch clients stay where they feel personally handled.'],
    kpis: [
      { label: 'Concierge avg order', value: '$7.8K', note: 'Higher than standard channel' },
      { label: 'Response SLA', value: '<2h', note: 'Target first concierge response' },
      { label: 'Premium conversion', value: '37%', note: 'Concierge requests becoming paid work' },
    ],
  },
]

export const commerceModules = [...internalModules, ...clientModules]

export const mvpLaunchSet = [
  'Executive Dashboard',
  'Quote Pipeline',
  'Custom Order Management',
  'Production Tracker',
  'Finance Surface',
  'Smart Quote Request Portal',
  'Corporate Client Portal',
  'Order Tracking Experience',
  'Seasonal Campaign Engine',
]

export const dataModelDefinitions: DataModelDefinition[] = [
  {
    name: 'QuoteWorkspace',
    purpose: 'Canonical quote record joining request brief, pricing, approval, and conversion state.',
    fields: ['id', 'customerId', 'campaignId', 'stage', 'budget', 'marginProfile', 'nextFollowUpAt'],
  },
  {
    name: 'CustomOrderRecord',
    purpose: 'Operational order record for bespoke gifting and promotional product delivery.',
    fields: ['id', 'quoteId', 'clientId', 'deadlineAt', 'packagingSpecId', 'productionStage', 'dependencies'],
  },
  {
    name: 'ProductionJob',
    purpose: 'Tracks each production run from queue through QC and ship readiness.',
    fields: ['id', 'orderId', 'stage', 'proofStatus', 'qualityStatus', 'shipReadyAt'],
  },
  {
    name: 'InventorySku',
    purpose: 'Real-time stock visibility with reservation and seasonal planning context.',
    fields: ['sku', 'onHand', 'reserved', 'reorderPoint', 'supplierEtaDays', 'seasonalTag'],
  },
  {
    name: 'SupplierProfile',
    purpose: 'Vendor memory for purchasing decisions and performance insight.',
    fields: ['id', 'name', 'leadTimeDays', 'paymentTerms', 'varianceScore', 'preferredCategories'],
  },
  {
    name: 'OrderProfitabilityRecord',
    purpose: 'Surface profitability by order, invoice, and production outcome.',
    fields: ['orderId', 'revenue', 'cogs', 'grossMargin', 'varianceFromQuote', 'alertLevel'],
  },
  {
    name: 'CustomerProfile',
    purpose: 'Internal CRM memory for repeat buying, VIP context, and corporate structure.',
    fields: ['id', 'segment', 'lifetimeValue', 'lastOrderAt', 'vipStatus', 'savedPreferences'],
  },
  {
    name: 'QuoteRequestBrief',
    purpose: 'Client-submitted intake that routes directly into Flow Engine.',
    fields: ['id', 'occasion', 'quantity', 'budget', 'timeline', 'brandingNeeds', 'deliveryNeeds'],
  },
  {
    name: 'CorporateCampaignRecord',
    purpose: 'Stores reusable campaign memory for reorders and enterprise programs.',
    fields: ['id', 'accountId', 'theme', 'recipientCount', 'previousQuoteIds', 'status'],
  },
  {
    name: 'LoyaltyProfile',
    purpose: 'Tracks repeat behavior, rewards, and VIP access tiers.',
    fields: ['customerId', 'tier', 'points', 'rewardBalance', 'earlyAccessFlags'],
  },
  {
    name: 'SeasonalCampaign',
    purpose: 'Revenue program entity for Christmas, Mother’s Day, Valentine’s, and event gifting campaigns.',
    fields: ['id', 'season', 'launchDate', 'theme', 'inventorySignal', 'leadVolume', 'conversionRate'],
  },
]

export const repoSequence: RepoSequenceItem[] = [
  {
    step: '1. Harden Flow Engine boundaries',
    surfaces: [
      'packages/flow-engine payment gating, workflows, approvals, supplier core',
      'packages/platform-commerce-org edition contracts',
      'packages/pricing-engine jurisdiction abstraction backlog',
    ],
  },
  {
    step: '2. Build Maestria internal operating shell',
    surfaces: [
      'apps/maestria internal routes',
      'executive dashboard, quote pipeline, order management, production, finance',
      'premium operator navigation and layout',
    ],
  },
  {
    step: '3. Build client growth engine',
    surfaces: [
      'apps/maestria external routes',
      'quote request portal, gift builder, corporate portal, tracking, seasonal campaigns',
      'edition-aware content and campaign system',
    ],
  },
  {
    step: '4. Wire bilingual and premium retail polish',
    surfaces: [
      'FR and EN copy system',
      'luxury-grade UI language',
      'mobile-first performance and conversion tuning',
    ],
  },
  {
    step: '5. Launch pilot and instrument revenue',
    surfaces: [
      'Shop Moi Ça pilot',
      'cash, quote, conversion, reorder, and seasonal campaign instrumentation',
      'evidence pack for commercialization',
    ],
  },
]

export const rolloutPlan: RolloutPhase[] = [
  {
    window: '0-30 days',
    focus: 'Operational core launch',
    outcomes: [
      'Ship Maestria operator shell with executive dashboard, quote pipeline, custom order management, production tracker, and finance surface',
      'Move quote, approval, and payment gating traffic onto Flow Engine boundaries',
      'Launch premium smart quote request portal for inbound demand',
    ],
  },
  {
    window: '31-60 days',
    focus: 'Client growth surfaces and seasonal demand engine',
    outcomes: [
      'Launch corporate client portal, order tracking, and seasonal campaign engine',
      'Add inventory center and supplier PO center',
      'Stand up bilingual content model and premium mobile optimization',
    ],
  },
  {
    window: '61-90 days',
    focus: 'Retention and premium expansion',
    outcomes: [
      'Launch guided gift builder, loyalty/VIP, concierge requests, and CRM internal view',
      'Instrument repeat-order automation and seasonal reactivation',
      'Produce revenue and retention scorecards for Shop Moi Ça pilot evidence',
    ],
  },
]

export const revenueModel: RevenueModelItem[] = [
  {
    lever: 'Quote velocity',
    mechanism: 'Smart intake, templates, and follow-up reminders reduce lost inbound demand',
    impact: 'More approved quotes per month without hiring another coordinator',
  },
  {
    lever: 'Margin protection',
    mechanism: 'Margin alerts, cost variance warnings, and deposit gating stop bad orders from flowing through',
    impact: 'Gross margin preserved on high-touch custom work',
  },
  {
    lever: 'Repeat corporate revenue',
    mechanism: 'Corporate portal, campaign history, recipient lists, and reorder actions reduce friction for repeat programs',
    impact: 'Higher annual account value and more predictable seasonal bookings',
  },
  {
    lever: 'Seasonal demand capture',
    mechanism: 'Campaign engine and reactivation surfaces turn fixed holiday demand into managed pipeline',
    impact: 'Better pre-season planning and larger campaign wins',
  },
  {
    lever: 'Founder relief',
    mechanism: 'Executive dashboard and operator workflows centralize decisions that currently live in inboxes and chats',
    impact: 'Founder attention moves from firefighting to growth',
  },
]

export const instantWowMoments = [
  'A founder dashboard that shows revenue, deposits, delayed orders, and margin alerts on one premium screen',
  'Branded quote experiences and PDFs that feel like a luxury brand presentation',
  'A client portal where corporate buyers can reorder campaigns, approve quotes, and pay deposits without email chase',
  'An order tracking experience that feels polished and reassuring instead of operationally cold',
]

export const longTermStickiness = [
  'Historical campaign memory and recipient list reuse',
  'Supplier, cost variance, and production evidence tied to every order',
  'Saved client preferences, loyalty state, and VIP handling rules',
  'Seasonal demand and margin history that compounds every campaign cycle',
  'Workflow habits embedded in founder and staff routines',
]

const copyByLocale: Record<MaestriaLocale, MaestriaCopy> = {
  'en-CA': {
    eyebrow: 'Shop Moi Ça flagship build',
    title: 'Maestria Commerce for premium gifting operators.',
    subtitle:
      'Two deployable lanes drive the build: an internal operations engine for staff and owners, and a client growth engine for buyers, reorders, and seasonal demand.',
    laneA: 'Lane A — Internal Operations Engine',
    laneB: 'Lane B — Client Growth Experience Engine',
    sitemapTitle: 'Full sitemap',
    dataTitle: 'Required data models',
    roadmapTitle: '30 / 60 / 90 rollout',
    revenueTitle: 'Revenue impact model',
    wowTitle: 'What will wow Shop Moi Ça instantly',
    stickinessTitle: 'What creates long-term stickiness',
    mvpTitle: 'MVP first launch set',
  },
  'fr-CA': {
    eyebrow: 'Construction phare pour Shop Moi Ça',
    title: 'Commerce Maestria pour les opérateurs cadeaux haut de gamme.',
    subtitle:
      'Deux voies déployables structurent le produit : un moteur d’opérations internes pour l’équipe et la direction, puis un moteur de croissance client pour les acheteurs, les réassorts et la demande saisonnière.',
    laneA: 'Voie A — Moteur d’opérations internes',
    laneB: 'Voie B — Moteur d’expérience de croissance client',
    sitemapTitle: 'Plan complet du site',
    dataTitle: 'Modèles de données requis',
    roadmapTitle: 'Déploiement 30 / 60 / 90 jours',
    revenueTitle: 'Modèle d’impact revenu',
    wowTitle: 'Ce qui impressionnera Shop Moi Ça immédiatement',
    stickinessTitle: 'Ce qui crée la rétention long terme',
    mvpTitle: 'Premier lancement MVP',
  },
}

export function getMaestriaCopy(locale: string): MaestriaCopy {
  return copyByLocale[locale === 'fr-CA' ? 'fr-CA' : 'en-CA']
}

export function getCommerceModulesByLane(lane: CommerceLaneId): CommerceModule[] {
  return commerceModules.filter((module) => module.lane === lane)
}

export function getCommerceModule(lane: CommerceLaneId, slug: string): CommerceModule | undefined {
  return commerceModules.find((module) => module.lane === lane && module.slug === slug)
}