# Health & Safety Module Components

Comprehensive UI components for workplace health and safety management in the UnionEyes application.

## 📦 Installation

All components are located in `components/health-safety/` and can be imported from the barrel export:

```typescript
import { 
  HealthSafetyDashboard, 
  IncidentReportForm,
  HazardsList 
} from "@/components/health-safety";
```

## 🏗️ Architecture

### Component Categories

#### 1. **Core Dashboard** (3 components)
- `HealthSafetyDashboard` - Main dashboard with metrics and navigation
- `SafetyMetricsCard` - Reusable KPI display card
- `IncidentTrendChart` - Data visualization for trends

#### 2. **Incident Management** (4 components)
- `IncidentListTable` - Paginated incident listing
- `IncidentReportForm` - Comprehensive incident reporting
- `IncidentStatusBadge` - Status indicator
- `IncidentTimelineViewer` - Activity timeline

#### 3. **Inspection Management** (3 components)
- `InspectionScheduleCalendar` - Calendar view for inspections
- `InspectionReportViewer` - One inspection as recorded: checklist results, recorded score, findings and notes
- `InspectionFindingsCard` - Summary card

#### 4. **Hazard Management** (3 components)
- `HazardReportForm` - Hazard reporting
- `HazardsList` - Grid view of hazards
- `HazardPriorityBadge` - Priority indicator

> **Not offered:** corrective-action tracking (the `corrective_actions` table is neither declared in the schema nor authorised for the
> tenant runtime role), report / PDF exports (no export service or authority model covers members' health data), hazard photos and
> incident attachments (no upload route stores a file), incident drafts (nothing restored them), scheduling an inspection (no screen for it
> exists), and a detail page for a hazard or an incident (none exists; `HazardsList` and `IncidentListTable` show a View button only when
> the host passes `onViewDetails`). The UI offers none of these.

> **Reading the routes:** the routes answer through `withApi` as `{ success, data, timestamp }` (a CRUD list: `data.data` rows and
> `data.pagination`), and fail with `{ code, message }`. The screens read them with `@/lib/client/api-envelope`, `@/lib/client/row-fields` (a
> record that lacks a column the database never leaves empty is an error, not a record with an invented value) and `use-stats.ts`
> (statistics keyed by organization and attempt). A list or figure that could not be loaded is shown as an error with a retry, and an
> unknown figure (an average over nothing, a rate nobody scored) is a dash: neither is shown as an empty list or a zero.

## 🚀 Quick Start

### Basic Dashboard Setup

```typescript
import { HealthSafetyDashboard } from "@/components/health-safety";

export default function HealthSafetyPage() {
  return (
    <HealthSafetyDashboard 
      organizationId="org_123"
      period="30d"
    />
  );
}
```

### Incident Reporting

```typescript
import { IncidentReportForm } from "@/components/health-safety";

export default function ReportIncidentPage() {
  const handleSubmit = async (data) => {
    // POST toIncidentRequest(data) to /api/health-safety/incidents and throw when it refuses: the form stays open and shows the reason.
    console.log("Incident reported:", data);
  };

  return (
    <IncidentReportForm
      onSubmit={handleSubmit}
      onCancel={() => router.back()}
    />
  );
}
```

### Hazard Management

```typescript
import { HazardsList, HazardReportForm } from "@/components/health-safety";

export default function HazardsPage() {
  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      {showForm ? (
        <HazardReportForm
          onSubmit={async (data) => {
            // POST the fields to /api/health-safety/hazards and throw when it refuses: the form stays open and shows the reason.
            // Never send organizationId: the route takes the organization from the session and rejects a body that names one.
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <HazardsList organizationId="org_123" />
      )}
    </div>
  );
}
```

## 📚 Component Reference

### HealthSafetyDashboard

**Purpose**: Main entry point for the Health & Safety module

**Props**:
```typescript
interface HealthSafetyDashboardProps {
  organizationId: string;
  period?: "7d" | "30d" | "90d" | "12m";
}
```

**Features**:
- Real-time safety metrics
- Incident trend visualization
- Tabbed navigation (Overview, Incidents, Inspections, Hazards)

---

### IncidentReportForm

**Purpose**: Comprehensive incident reporting form

**Props**:
```typescript
interface IncidentReportFormProps {
  initialData?: Partial<IncidentFormData>;
  /** Saves the report; throws when it is refused, so the form stays open and shows the reason. */
  onSubmit: (data: IncidentFormData) => Promise<void>;
  onCancel?: () => void;
}
```

**Features**:
- Multi-section form (Details, Injuries, Witnesses, Actions, Reporter)
- Form validation with zod
- No attachments and no draft: no route stores a file and nothing restored a draft. See `incident-payload.ts` for how the fields reach the incidents route

---

### HazardsList

**Purpose**: Grid view of reported hazards

**Props**:
```typescript
interface HazardsListProps {
  organizationId: string;
  /** Without it a hazard is listed but cannot be opened: there is no button. */
  onViewDetails?: (hazardId: string) => void;
}
```

**Features**:
- Search
- Status filter (reported, assessed, assigned, resolved, closed) and level filter (low, moderate, high, critical, extreme): the values the routes store
- Responsive grid, a page at a time
- Priority badges
- An error with a retry when the list cannot be loaded

## 🔌 API Integration

All components integrate with the following API endpoints:

### Dashboard & Metrics
- `GET /api/health-safety/dashboard?organizationId={id}&period={period}`

### Incidents
- `GET /api/health-safety/incidents?organizationId={id}`
- `POST /api/health-safety/incidents`
- `GET /api/health-safety/incidents/{id}`
- `PUT /api/health-safety/incidents/{id}`
- `GET /api/health-safety/incidents/trends?organizationId={id}&period={period}`

### Inspections
- `GET /api/health-safety/inspections?organizationId={id}`
- `POST /api/health-safety/inspections`
- `GET /api/health-safety/inspections/{id}`
- `PUT /api/health-safety/inspections/{id}`

### Hazards
- `GET /api/health-safety/hazards?organizationId={id}`
- `POST /api/health-safety/hazards`
- `GET /api/health-safety/hazards/{id}`

### PPE
- `GET /api/health-safety/ppe/inventory?organizationId={id}`
- `POST /api/health-safety/ppe/distribute`
- `POST /api/health-safety/ppe/reorder`

### Training
- `GET /api/health-safety/training/records?organizationId={id}`

## 🎨 Styling

All components use:
- **Tailwind CSS** for styling
- **Dark mode** support via `dark:` prefix
- **Responsive design** with mobile-first approach
- **shadcn/ui** component library

## ♿ Accessibility

- Semantic HTML structure
- ARIA labels and roles
- Keyboard navigation support
- Screen reader compatible
- Focus management

## 📱 Responsive Design

All components are fully responsive with breakpoints:
- **Mobile**: < 768px
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px

## 🧪 Testing

Example test setup:

```typescript
import { render, screen } from "@testing-library/react";
import { HealthSafetyDashboard } from "@/components/health-safety";

describe("HealthSafetyDashboard", () => {
  it("renders dashboard with metrics", () => {
    render(<HealthSafetyDashboard organizationId="org_123" />);
    expect(screen.getByText("Safety Metrics")).toBeInTheDocument();
  });
});
```

## 🔒 Security Considerations

- All API calls require authentication
- Organization-level access control via `organizationId`
- File upload validation for attachments
- XSS protection via React's built-in escaping

## 📝 TypeScript

All components are fully typed with:
- Props interfaces exported
- Type inference support
- Generic type support where applicable

## 🤝 Contributing

When adding new components:

1. Follow existing component patterns
2. Include JSDoc comments
3. Add TypeScript interfaces
4. Implement error handling
5. Support dark mode
6. Ensure accessibility
7. Add to barrel export in `index.ts`

## 📄 License

Part of the UnionEyes application.

## 🆘 Support

For issues or questions, refer to the main UnionEyes documentation.
