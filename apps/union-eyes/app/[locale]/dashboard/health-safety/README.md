# Health & Safety Dashboard Pages

Production-ready Next.js pages for the Health & Safety module in the UnionEyes application.

## 📁 File Structure

```
app/[locale]/dashboard/health-safety/
├── page.tsx                    # Main H&S dashboard
├── incidents/
│   ├── page.tsx               # Incidents list & management
│   └── new/
│       └── page.tsx           # New incident report form
├── inspections/
│   └── page.tsx               # Inspections management
└── hazards/
    └── page.tsx               # Hazard reports & tracking
```

## 📄 Pages Overview

### 1. Main Dashboard (`page.tsx`)

**Route:** `/dashboard/health-safety`

**Features:**
- Quick overview cards (Days Without Incident, Open Hazards, Compliance Rate)
- Navigation cards to sub-sections (Incidents, Inspections, Hazards, Training)
- Embedded `HealthSafetyDashboard` component with full metrics
- Period selector (7d, 30d, 90d, 12m)
- Quick action: Report Incident button

**Key Components Used:**
- `HealthSafetyDashboard`
- `SafetyMetricsCard`
- `IncidentTrendChart`

---

### 2. Incidents Page (`incidents/page.tsx`)

**Route:** `/dashboard/health-safety/incidents`

**Features:**
- Statistics cards (Total, Under Investigation, Closed, Avg. Resolution Time) for the chosen period; an unknown figure is a dash, and failed statistics are an alert with a retry
- Period selector (7 days, 30 days, 90 days, 12 months): it applies to the statistics and the trends. The list has its own search and status and severity filters
- Tabbed view (List, Trends)
- Incident list table with status badges
- Trend analysis charts
- Quick action: Report Incident button

**Key Components Used:**
- `IncidentListTable`
- `IncidentTrendChart`
- `IncidentStatusBadge`

**Navigation:**
- Back to main H&S dashboard
- Incident reporting (there is no incident detail page, so listed incidents cannot be opened)

---

### 3. New Incident Report (`incidents/new/page.tsx`)

**Route:** `/dashboard/health-safety/incidents/new`

**Features:**
- Comprehensive incident report form
- Important safety notice banner
- Anonymous reporting option
- Witness information
- Form validation
- Success toast notifications (a refusal is shown by the form, which stays open with what was typed)

**Key Components Used:**
- `IncidentReportForm`

**Workflow:**
1. User fills out incident details
2. Submits form (the route needs the health_safety_rep role)
3. Success notification
4. Redirects to incidents list

> **How the report reaches the route:** `toIncidentRequest` (`components/health-safety/incident-payload.ts`) turns the form into the body
> of `POST /api/health-safety/incidents`. The body names no organization (the route takes the caller's own and refuses a body that
> names one) and carries only fields the route stores. What the form asks for that has no column of its own (immediate cause, injuries,
> witness contacts, preventive measures, how to reach the reporter) is written, labelled, into the incident's narrative (`whatHappened`),
> so nothing typed is dropped. The form takes no attachments and keeps no draft: no route stores a file and nothing restored a draft.

---

### 4. Inspections Page (`inspections/page.tsx`)

**Route:** `/dashboard/health-safety/inspections`

**Features:**
- Statistics cards (Total, Overdue, Compliance Rate, Avg. Score); a rate nobody scored is a dash, not 0%
- Three-tab view:
  - **Calendar:** Visual schedule of inspections (an inspection chosen there opens in the list view)
  - **List View:** Select an inspection to see it as recorded (checklist results, score, findings and notes)
  - **Findings:** Issues requiring attention; each finding's View Full Report opens it in the list view
- Scheduling an inspection is not offered: no screen for it exists

**Key Components Used:**
- `InspectionScheduleCalendar`
- `InspectionReportViewer`
- `InspectionFindingsCard`

**Navigation:**
- Back to main H&S dashboard

---

### 5. Hazards Page (`hazards/page.tsx`)

**Route:** `/dashboard/health-safety/hazards`

**Features:**
- Statistics cards (Total, Critical, In Progress, Avg. Resolution Time); an unknown figure is a dash
- Hazard list (all reported hazards), with search and status and level filters of its own
- Quick action: Report Hazard button
- Inline hazard report form, also opened by `?report=1`

**Key Components Used:**
- `HazardsList`
- `HazardReportForm`
- `HazardPriorityBadge`

**Workflow:**
1. Click "Report Hazard" → Shows form
2. Submit hazard report (the route needs the health_safety_rep role; a refusal is shown and the form stays open)
3. Returns to hazards list

There is no hazard detail page, so listed hazards cannot be opened.

---

## 🎨 Design Patterns

All pages follow consistent UnionEyes patterns:

### Layout
- **Client Components** (`"use client"`)
- Framer Motion animations for smooth transitions
- Responsive grid layouts (mobile-first)
- Gradient backgrounds with backdrop blur
- Max-width containers (max-w-7xl)

### Header Structure
```tsx
- Breadcrumb navigation (Back button)
- Page title with icon
- Description text
- Action buttons (primary action)
```

### Statistics Cards
- 4-column grid (responsive)
- Icon with colored accent
- Large number display
- Supporting text/context

### Filtering
- Search input with icon
- Select dropdowns for filters
- Consistent spacing and layout
- Responsive grid

### Tabs
- Shadcn/ui Tabs component
- Icon + label format
- Consistent tab content structure

---

## 🔌 Integration Points

### Required Props
All pages expect:
- `organizationId` from `useOrganizationId()` hook
- `user` object from `useUser()` hook

### API Endpoints (To Be Implemented)

```typescript
// Statistics
GET /api/health-safety/dashboard?organizationId={id}&period={period}
GET /api/health-safety/incidents/stats?organizationId={id}&period={period}
GET /api/health-safety/inspections/stats?organizationId={id}
GET /api/health-safety/hazards/stats?organizationId={id}

// Data Operations
POST /api/health-safety/incidents
POST /api/health-safety/hazards
GET  /api/health-safety/incidents?organizationId={id}
GET  /api/health-safety/inspections?organizationId={id}
GET  /api/health-safety/hazards?organizationId={id}

// Inspection as recorded (CRUD item route)
GET  /api/health-safety/inspections/{id}

// No export route: no export service or authority model covers members' health data.
```

---

## 🔐 Authentication & Permissions

### Current Implementation
- Organization-level checks via `useOrganizationId()`
- User authentication via platform auth
- Graceful fallback when no organization selected

### Recommended Permissions
Based on `lib/auth/roles.ts`:

```typescript
// View permissions
VIEW_HEALTH_SAFETY_CLAIMS
VIEW_ANALYTICS

// Create/Manage permissions
CREATE_HEALTH_SAFETY_CLAIM
MANAGE_HEALTH_SAFETY

// Role suggestions
HEALTH_SAFETY_REP - Full access
STEWARD - View + Create
MEMBER - View own + Create
```

---

## 🌐 Internationalization

All pages use `next-intl`:

```typescript
const t = useTranslations();
```

### Translation Keys Needed

Add to your messages JSON:

```json
{
  "healthSafety": {
    "title": "Health & Safety",
    "incidents": "Incidents",
    "inspections": "Inspections",
    "hazards": "Hazards",
    "reportIncident": "Report Incident",
    "scheduleInspection": "Schedule Inspection",
    "reportHazard": "Report Hazard",
    "export": "Export",
    "filters": "Filters",
    "search": "Search..."
  }
}
```

---

## ♿ Accessibility

All pages implement:
- Semantic HTML structure
- ARIA labels on interactive elements
- Keyboard navigation support
- Focus management
- Screen reader compatible
- Color contrast compliance

---

## 📱 Responsive Breakpoints

```css
Mobile:  < 768px   (1 column)
Tablet:  768-1024px (2 columns)
Desktop: > 1024px   (3-4 columns)
```

All pages are fully responsive with mobile-first design.

---

## 🧪 Testing Checklist

- [ ] Organization selection required
- [ ] Statistics load correctly
- [ ] Filters update data
- [ ] Tab navigation works
- [ ] Forms validate input
- [ ] Success/error toasts display
- [ ] Navigation flows correctly
- [ ] Mobile responsive
- [ ] Dark mode compatible

---

## 🚀 Next Steps

1. **Implement API endpoints** for real data
2. **Add permission checks** at page/component level
3. **Complete translations** for all text
4. **Add role-based feature toggling**
5. **Add detailed incident/hazard views**
6. **Create training module page**
7. **Add dashboard to navigation sidebar**

---

## 📝 Notes

- All pages currently use mock data - replace with API calls
- Toast notifications use Sonner library
- All components are from `@/components/health-safety`
- Animation delays create smooth sequential loading
- There are no export buttons and no corrective-action tab: neither has a route and authority model behind it

---

## 🤝 Contributing

When adding new H&S pages:
1. Follow the established pattern (Header → Stats → Filters → Tabs)
2. Use consistent motion animations
3. Include proper TypeScript types
4. Add to this README
5. Document API requirements
6. Include translation keys

---

## 📞 Support

For issues or questions about these pages, refer to:
- `components/health-safety/README.md` - Component documentation
- `lib/auth/roles.ts` - Permission system
- Existing dashboard pages for patterns

---

**Created:** February 2026  
**Last Updated:** February 11, 2026  
**Version:** 1.0.0
