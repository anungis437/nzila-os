# Trade & Commerce — User Experience Strategy

> UX strategy for Trade OS, eEXPORTS, and Shop Quoter — serving freight forwarders, customs brokers, exporters, and retailers.

---

## User Personas

### 1. Freight Forwarder — "Alain"
- **Profile**: Operations manager at mid-size freight forwarder, handles 200+ shipments/month across truck, ocean, and air
- **Pain Points**: Manual carrier rate comparison (calls/emails), tracking across 10 carrier portals, exception management
- **Needs**: Single dashboard for all shipments, instant multi-carrier rate comparison, proactive exception alerts
- **Usage**: 50+ daily sessions, bulk shipment creation, carrier performance monitoring
- **Value Prop**: "Compare 15 carriers in 5 seconds instead of 5 hours"

### 2. Customs Broker — "Linda"
- **Profile**: Licensed customs broker handling 50 clients, specializes in USMCA cross-border compliance
- **Pain Points**: Manual HS code classification, paper-based certificates of origin, CBSA filing errors
- **Needs**: AI-assisted HS classification, automated document generation, EDI customs filing
- **Usage**: 30+ client files daily, document generation, compliance verification
- **Value Prop**: "File customs declarations in minutes, not hours — with zero errors"

### 3. SME Exporter — "Fatou"
- **Profile**: First-time exporter, food products company wanting to ship shea butter from Canada to US/EU
- **Pain Points**: No idea what documents are needed, confused by HS codes, overwhelmed by trade regulations
- **Needs**: Guided export workflow, regulatory checklists, plain-language compliance explanations
- **Usage**: 5-10 shipments/month (growing), needs hand-holding through first exports
- **Value Prop**: "Export your first international shipment with confidence — we handle the paperwork"

### 4. Retail Shop Owner — "Marcus"
- **Profile**: Owns 3 retail locations in Toronto, sells electronics and accessories, sources from 12 suppliers
- **Pain Points**: Manual quoting, inventory tracking in spreadsheets, no visibility into supplier lead times
- **Needs**: POS system, supplier quote comparison, reorder alerts, multi-location inventory
- **Usage**: All-day POS, weekly supplier quoting, monthly inventory reviews
- **Value Prop**: "Replace your spreadsheets with a smart POS that also manages suppliers"

---

## Trade OS UX Workflows

### Shipment Creation Wizard
```
Step 1: Origin & Destination           Step 2: Cargo Details
┌─────────────────────────┐           ┌─────────────────────────┐
│ From: [Toronto, ON    ] │           │ Items: [Add Item      ] │
│ To:   [Chicago, IL    ] │     →     │ Weight: [250 kg       ] │
│ Mode: ○ Truck ○ Air    │           │ Dims:   [48×40×48 in  ] │
│       ○ Ocean ○ Rail   │           │ Class:  [70           ] │
│ Cross-border? [✓]      │           │ Hazmat: [No           ] │
└─────────────────────────┘           └─────────────────────────┘
         │
Step 3: Rate Comparison               Step 4: Book & Track
┌─────────────────────────┐           ┌─────────────────────────┐
│ UPS     $342  2 days ★★ │           │ ✅ Booked with FedEx    │
│ FedEx   $298  3 days ★★★│     →     │ PRO#: 7942-8821-3094   │
│ Day&Ross $265 4 days ★★ │           │ Status: Picked Up      │
│ Purolator $310 2d  ★★★ │           │ ETA: March 15          │
│ [Sort: Price | Speed]   │           │ 📍 Live Tracking Map   │
└─────────────────────────┘           └─────────────────────────┘
```

### Tracking Dashboard
- Real-time map view: all active shipments on interactive map
- List view: sortable by status (in transit, delivered, exception, customs hold)
- Exception alerts: instant notification on delays, customs holds, damage
- Carrier performance: on-time %, claim rate, historical comparison

---

## eEXPORTS UX Workflows

### Document Builder
```
Select Shipment → Auto-Fill Document Fields → Review & Export
┌─────────────────────────┐
│ Document Type:           │
│ [✓] Commercial Invoice   │
│ [✓] Certificate of Origin│
│ [ ] Phytosanitary Cert   │
│ [ ] Bill of Lading       │
│ [ ] Packing List         │
│                          │
│ Auto-fill from shipment? │
│ [Yes — Shipment #1234]   │
└─────────────────────────┘
    ↓
┌─────────────────────────┐
│ ✅ All fields complete   │
│ ⚠️  HS Code 0810.10 —   │
│    CFIA cert required    │
│ ❌ Missing: country of   │
│    manufacture           │
│                          │
│ [Fix Issues] [Override]  │
│ [Generate PDF] [EDI]     │
└─────────────────────────┘
```

### HS Code Search UX
- Natural language search: "fresh strawberries from Ontario"
- AI suggestion with confidence: "0810.10 — Fresh Strawberries (95% confidence)"
- Browse: hierarchical HS code tree navigation
- History: recent classifications with tariff rate changes highlighted
- Compare: USMCA vs CETA vs MFN tariff rates side-by-side

---

## Shop Quoter UX Workflows

### POS Interface
- Clean, touch-friendly layout for counter use
- Barcode scanner integration (USB/Bluetooth)
- Quick-add: frequent items grid, search autocomplete
- Payment: Stripe terminal integration (tap, chip, swipe)
- Receipt: email, print, or SMS delivery

### Supplier Quote Comparison
```
Product: Samsung Galaxy S24 Case
┌──────────────────────────────────┐
│ Supplier A: $4.20 ea │ 500 MOQ │ 14 days │
│ Supplier B: $3.85 ea │ 1000 MOQ │ 21 days │
│ Supplier C: $4.50 ea │ 200 MOQ │ 7 days  │
│                                  │
│ [Best Price] [Fastest] [Lowest MOQ] │
│ Last ordered: Supplier A, Feb 2025 │
└──────────────────────────────────┘
```

---

## Onboarding Flows

### Trade OS Onboarding (10 minutes)
1. Company profile: name, addresses, CBSA importer number
2. Carrier selection: which carriers do you use? → credential setup
3. First shipment: guided wizard with pre-filled sample data
4. Tracking demo: show real carrier tracking integration
5. Invite team: add operations staff, assign roles

### eEXPORTS Onboarding (8 minutes)
1. Exporter profile: company info, HS code categories, trade agreements used
2. Document preferences: default templates, company letterhead upload
3. First document: generate commercial invoice from sample shipment
4. Compliance check demo: show how validation flags missing fields
5. Connect to Trade OS (if applicable): auto-fill from shipment data

### Shop Quoter Onboarding (5 minutes)
1. Store setup: name, locations, tax rates
2. Product import: CSV upload or Shopify/WooCommerce sync
3. First sale: POS demo transaction
4. Supplier setup: add first supplier, create sample RFQ
5. Inventory: set reorder thresholds for top 10 products

---

## Design System

### Visual Language
- **Trade OS**: Professional blue (#1E40AF) — trust, reliability, logistics
- **eEXPORTS**: Green (#059669) — compliance, approval, go/no-go signals
- **Shop Quoter**: Orange (#EA580C) — energy, commerce, action
- **Shared**: Nzila brand purple accents, consistent typography (Inter)

### Component Library
- Shared React components across all 3 platforms
- Data tables with sorting, filtering, export (used in all platforms)
- Map components (Mapbox GL) for shipment tracking
- Document viewer (PDF.js) for generated documents
- Charts (Recharts) for analytics dashboards

---

## Accessibility & Responsive Design

### Standards
- WCAG 2.1 AA compliance across all platforms
- Keyboard navigation for all critical workflows
- Screen reader: ARIA labels on data tables, forms, maps
- Color contrast: 4.5:1 minimum ratio

### Responsive Breakpoints
- **Desktop** (≥1280px): Full dashboard, multi-panel layouts — primary use case
- **Tablet** (≥768px): Simplified layouts, POS optimized for tablet counters
- **Mobile** (≥375px): Tracking lookup, quick POS, notification management
- Shop Quoter POS: optimized for iPad counter mount (landscape 1024px)
