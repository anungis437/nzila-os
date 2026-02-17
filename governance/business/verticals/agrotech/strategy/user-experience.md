# Agrotech UX Strategy
> User experience design for CORA + PonduOps platforms, optimized for agricultural users in Sub-Saharan Africa.

---

## 1. User Personas

### Persona 1: Marie — Smallholder Farmer
- **Context**: 2-hectare cassava farm in Bas-Congo province, DRC
- **Device**: Feature phone (KaiOS) + occasional shared smartphone at cooperative office
- **Literacy**: Limited written literacy (Lingala speaker), comfortable with voice and icons
- **Connectivity**: <10% of the day with mobile data; relies on cooperative WiFi for sync
- **Goals**: Know market prices before selling, track input costs, receive weather alerts
- **Pain points**: Middlemen exploit price information asymmetry, no record of past yields, input purchases are cash-only with no receipts
- **Platform usage**: PonduOps (harvest logging via cooperative manager), CORA (price alerts via SMS)

### Persona 2: Jean-Pierre — Cooperative Manager
- **Context**: Manages a 300-member cassava and maize cooperative in Katanga
- **Device**: Android tablet (provided by NGO program) + personal smartphone
- **Literacy**: Functionally literate in French, basic computer skills learned through donor programs
- **Connectivity**: 3G coverage at cooperative office, intermittent mobile data in field
- **Goals**: Track member contributions, coordinate bulk sales, report to federation, manage input orders
- **Pain points**: Paper-based records are error-prone, no visibility into member farm activities, government reporting is manual and time-consuming
- **Platform usage**: PonduOps (cooperative management, financial ledger), CORA (supply listings, buyer matching)

### Persona 3: Amara — Enterprise Buyer
- **Context**: Procurement manager at a Kinshasa-based grain trading company
- **Device**: Desktop computer + smartphone
- **Literacy**: University-educated, comfortable with business software, bilingual French/English
- **Connectivity**: Stable broadband at office
- **Goals**: Source consistent supply of graded commodities, negotiate bulk pricing, track shipments
- **Pain points**: Supply unpredictability, quality inconsistency, fragmented supplier relationships
- **Platform usage**: CORA (demand requests, match review, transaction management, analytics dashboard)

---

## 2. Offline-First UX Design

### Progressive Web App (PWA) Strategy
- **Install prompt**: Triggered after 2nd visit; lightweight (<5MB initial install)
- **Service worker**: Caches all UI assets, fonts, and icons; app shell loads in <2s on 2G
- **Local data**: SQLite (via sql.js) stores farmer profiles, harvest records, pending transactions
- **Visual indicators**: Prominent online/offline status bar; pending sync count badge

### SMS Fallback System
For farmers without smartphones (Persona 1: Marie):
- **Market prices**: `SMS "PRIX MANIOC" to 12345` → receives current cassava prices for 3 nearest markets
- **Weather alerts**: Automatic SMS 48h before severe weather events (rain, drought)
- **Harvest confirmation**: SMS-based harvest recording: `RECOLTE MANIOC 500KG` → logged in PonduOps

### USSD Integration
- **Menu-driven interface**: `*123#` → structured menus for price check, harvest log, cooperative balance
- **Session-based**: No data plan required, works on any phone with GSM network
- **Language selection**: First menu: `1. Lingala  2. Français  3. Swahili  4. English`

### Sync UX Patterns
- **Background sync**: Automatic when connectivity detected, no user action required
- **Manual sync button**: Large, prominent "Sync Now" button on home screen for cooperative managers
- **Conflict notification**: Toast notification for non-critical conflicts (auto-resolved); modal for financial conflicts requiring manager review
- **Sync progress**: Visual progress bar showing upload/download status with record counts

---

## 3. Local Language Support

### Supported Languages (Priority Order)
| Language | Coverage | Users | Status |
|---|---|---|---|
| **French** | Primary UI language | All DRC users | Complete |
| **Lingala** | Western DRC, Kinshasa | 25M+ speakers | In progress |
| **Swahili** | Eastern DRC, East Africa | 100M+ speakers | Planned Q3 2025 |
| **English** | Enterprise buyers, international | Admin/API docs | Complete |
| **Kinyarwanda** | Rwanda expansion | 12M speakers | Planned 2027 |

### Localization Strategy
- **Translation management**: Crowdin platform with cooperative manager translators (paid per word)
- **Agricultural terminology**: Custom glossary for crop names, farming terms, units of measure per language
- **Right-to-left**: Not required for target languages; all LTR layouts
- **Number formatting**: Locale-aware number formatting (comma vs period decimal separators)
- **Date formatting**: Day/Month/Year format standard across Francophone Africa
- **Voice labels**: Audio descriptions for icon buttons (recorded by native speakers) for low-literacy users

### Content Localization Rules
1. All user-facing strings externalized (no hardcoded text in templates)
2. Agricultural terms use local names (e.g., "pondu" not "cassava leaves" in Lingala context)
3. Units default to local convention (kg, hectares) with metric system throughout
4. Currency displays in both local (CDF — Congolese Franc) and reference (USD) simultaneously

---

## 4. Onboarding Flow

### Cooperative-Mediated Registration (Primary)
```
Step 1: Cooperative manager creates cooperative account on PonduOps
        → Receives cooperative ID + admin credentials
        → Guided setup: cooperative name, location, crops, member count

Step 2: Manager registers members at cooperative meeting
        → Bulk entry: name + phone number (minimum viable profile)
        → Photo capture (optional, for ID verification)
        → Each member receives SMS with personal login code

Step 3: Field agent conducts group training session (2 hours)
        → Device-appropriate training (phone: SMS/USSD, smartphone: PWA)
        → Practice: log a harvest, check a market price, view cooperative balance
        → Printed quick-reference card (icon-based, language-appropriate)

Step 4: First real data entry within 7 days
        → Cooperative manager logs first cooperative activity (meeting, contribution)
        → 3+ members log harvest or field activity
        → System sends congratulatory SMS to cooperative + members
```

### Field Agent Assisted Setup
- Field agents carry pre-configured tablets with PonduOps pre-loaded
- Agent scans national ID (OCR) → auto-fills registration fields
- GPS coordinates captured automatically for farm location
- Training conducted during weekly cooperative meeting (captive audience)
- Agent follows standardized onboarding checklist with success criteria

### Onboarding KPIs
| Metric | Target | Measurement |
|---|---|---|
| Cooperative activation (first 3 activities logged) | <7 days | Time from account creation |
| Member registration rate | >80% of members within 30 days | Members registered / stated member count |
| First harvest logged | <14 days from registration | Time from member registration |
| Cooperative manager proficiency | >90% pass rate | Post-training assessment (10 questions) |

---

## 5. Accessibility & Low-Bandwidth Design

### Performance Budgets
| Metric | Target | Rationale |
|---|---|---|
| First Contentful Paint | <2s on 2G | Rural 2G is common; users abandon after 3s |
| Total page weight | <200KB (gzipped) | Data costs are significant ($0.50/MB in DRC) |
| Time to interactive | <4s on low-end Android | Most devices are $50-100 Android phones |
| Offline capability | 100% core features | Connectivity is unreliable; core flows must work offline |

### Low-Bandwidth Design Principles
- **Icon-first navigation**: All primary actions represented by intuitive agricultural icons (crop, harvest, market, money)
- **Minimal imagery**: SVG icons (<2KB each) instead of photographs; no decorative images
- **Text compression**: Brotli compression on all API responses, reducing payload 60-80%
- **Lazy loading**: Secondary content (analytics charts, historical data) loaded on demand
- **Data-saver mode**: Toggle to disable images, reduce update frequency, minimize sync payload

### Voice-First Interface (Pilot — 2026)
- Voice-commanded harvest entry: "J'ai récolté 500 kilos de manioc" (Lingala and French)
- Voice-read market prices: Automated voice call with daily price updates
- Integration with IVR (Interactive Voice Response) for feature phone users
- Speech-to-text for farmer notes and field observations

---

## 6. Design System: Agricultural Visual Language

### Color Palette
| Color | Hex | Usage |
|---|---|---|
| **Earth Green** | `#2D6A4F` | Primary actions, positive states, healthy crops |
| **Harvest Gold** | `#E9C46A` | Warnings, pending actions, pre-harvest |
| **Soil Brown** | `#6B4226` | Secondary elements, backgrounds, land indicators |
| **Alert Red** | `#E63946` | Errors, crop disease, overdue items |
| **Sky Blue** | `#457B9D` | Information, weather, water-related features |
| **Neutral White** | `#F8F9FA` | Background, cards, clean surfaces |

### Agricultural Iconography
- **Crop health indicators**: Color-coded leaf icons (green → yellow → red) for field status
- **Growth stages**: Seed → sprout → plant → harvest visual progress bar
- **Weather**: Simplified weather icons optimized for small screens (sun, rain, storm, dry)
- **Financial**: Money stack icon for revenue, downward arrow for expenses, balance scale for ledger

### Data Visualization Standards
- **Yield charts**: Simple bar charts with cooperative average comparison line
- **Price trends**: Sparklines (compact line charts) for commodity price history
- **Cooperative health**: Traffic light (red/yellow/green) dashboard cards — no complex charts
- **Maps**: Simplified regional maps showing cooperative locations and market distances

---

## 7. Field Testing Methodology

### Rural User Research Protocol
1. **In-context interviews** (2-3 hours at farm/cooperative): Observe actual workflow, document pain points with current manual process
2. **Task-based usability testing**: 5 core tasks (register, log harvest, check price, view balance, sync data) timed and scored
3. **A/B testing**: Deploy feature variants to 2-3 cooperatives, measure adoption and task completion
4. **Seasonal rhythm**: Research cadence aligned with agricultural calendar (pre-planting, planting, mid-season, harvest)

### Cooperative Feedback Loops
- **Monthly cooperative manager survey**: 5-question SMS survey on feature usage and satisfaction
- **Quarterly field visits**: Product team visits 3-5 cooperatives per quarter for in-depth feedback
- **Feature request board**: Cooperative managers submit requests via simple SMS or in-app form
- **Beta cooperative program**: 5 "champion cooperatives" get early access to new features, provide structured feedback

### Metrics Collection (Privacy-Preserving)
- **Analytics**: Anonymized event tracking (screen views, feature usage, task completion rates)
- **Performance**: Real User Monitoring (RUM) for load times, sync durations, error rates
- **No PII in analytics**: Farmer names, phone numbers, and financial data excluded from analytics pipeline
- **Cooperative-level aggregation**: All performance metrics reported at cooperative level, not individual farmer
