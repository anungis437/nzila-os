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

#### 2. **Incident Management** (5 components)
- `IncidentListTable` - Paginated incident listing
- `IncidentReportForm` - Comprehensive incident reporting
- `IncidentDetailView` - Full incident details
- `IncidentStatusBadge` - Status indicator
- `IncidentTimelineViewer` - Activity timeline

#### 3. **Inspection Management** (4 components)
- `InspectionScheduleCalendar` - Calendar view for inspections
- `InspectionChecklist` - Interactive checklist
- `InspectionReportViewer` - Report display
- `InspectionFindingsCard` - Summary card

#### 4. **Hazard Management** (3 components)
- `HazardReportForm` - Hazard reporting
- `HazardsList` - Grid view of hazards
- `HazardPriorityBadge` - Priority indicator

#### 5. **Additional Features** (4 components)
- `PPEDistributionTracker` - PPE inventory management
- `SafetyCommitteeMeetingScheduler` - Meeting scheduler
- `SafetyTrainingRecordsViewer` - Training tracking
- `CorrectiveActionTracker` - Action item management

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
    // Handle submission
    console.log("Incident reported:", data);
  };

  return (
    <IncidentReportForm
      organizationId="org_123"
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
          organizationId="org_123"
          onSubmit={(data) => {
            // Handle submission
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <HazardsList
          organizationId="org_123"
          onViewDetails={(id) => router.push(`/hazards/${id}`)}
        />
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
- Export functionality

---

### IncidentReportForm

**Purpose**: Comprehensive incident reporting form

**Props**:
```typescript
interface IncidentReportFormProps {
  organizationId: string;
  initialData?: Partial<IncidentReport>;
  incidentId?: string;
  onSubmit: (data: IncidentReport) => void | Promise<void>;
  onCancel?: () => void;
}
```

**Features**:
- Multi-section form (Details, Injuries, Witnesses, Actions, Reporter)
- File attachments
- Auto-save drafts
- Form validation with zod

---

### InspectionChecklist

**Purpose**: Interactive checklist for inspections

**Props**:
```typescript
interface InspectionChecklistProps {
  inspectionId: string;
  items: ChecklistItem[];
  onComplete: (results: ChecklistResults) => void | Promise<void>;
  onSaveDraft?: (results: Partial<ChecklistResults>) => void;
}
```

**Features**:
- Pass/Fail/N/A selection
- Photo attachments per item
- Progress tracking
- Auto-save
- Category grouping

---

### HazardsList

**Purpose**: Grid view of reported hazards

**Props**:
```typescript
interface HazardsListProps {
  organizationId: string;
  onViewDetails?: (hazardId: string) => void;
}
```

**Features**:
- Search functionality
- Status and priority filtering
- Responsive grid layout
- Priority badges

---

### PPEDistributionTracker

**Purpose**: Track PPE inventory and distribution

**Props**:
```typescript
interface PPEDistributionTrackerProps {
  organizationId: string;
  onDistribute?: (itemId: string) => void;
  onReorder?: (itemId: string) => void;
}
```

**Features**:
- Stock level monitoring
- Low/critical stock alerts
- Distribution history
- Reorder recommendations

---

### SafetyTrainingRecordsViewer

**Purpose**: Display employee training records

**Props**:
```typescript
interface SafetyTrainingRecordsViewerProps {
  organizationId: string;
  employeeId?: string;
  onViewCertificate?: (recordId: string) => void;
}
```

**Features**:
- Compliance rate tracking
- Expiry alerts
- Certificate downloads
- Training history

---

### CorrectiveActionTracker

**Purpose**: Track follow-up actions

**Props**:
```typescript
interface CorrectiveActionTrackerProps {
  organizationId: string;
  sourceType?: "incident" | "inspection" | "hazard";
  sourceId?: string;
  onViewAction?: (actionId: string) => void;
}
```

**Features**:
- Priority and deadline tracking
- Assignment management
- Progress monitoring
- Overdue alerts

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

### Corrective Actions
- `GET /api/health-safety/corrective-actions?organizationId={id}`

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
