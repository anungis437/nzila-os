# Health & Safety Navigation Integration Guide

This guide explains how to add the Health & Safety module to the UnionEyes navigation sidebar.

## 📍 Location

Modify: `components/sidebar.tsx`

## 🔨 Implementation

### Option 1: Add to "Your Union" Section

Add Health & Safety as a core member feature (recommended):

```tsx
{
  title: t('sidebar.yourUnion'),
  roles: ["member", "steward", "officer", "admin"],
  items: [
    { href: `/${locale}/dashboard`, icon: <Home size={16} />, label: t('navigation.dashboard'), roles: ["member", "steward", "officer", "admin"] },
    { href: `/${locale}/dashboard/claims`, icon: <FileText size={16} />, label: t('claims.myCases'), roles: ["member", "steward", "officer", "admin"] },
    { href: `/${locale}/dashboard/claims/new`, icon: <Mic size={16} />, label: t('claims.submitNew'), roles: ["member", "steward", "officer", "admin"] },
    // ⭐ ADD THIS LINE
    { href: `/${locale}/dashboard/health-safety`, icon: <Shield size={16} />, label: 'Health & Safety', roles: ["member", "steward", "officer", "admin"] },
    { href: `/${locale}/dashboard/pension`, icon: <Briefcase size={16} />, label: 'My Pension & Benefits', roles: ["member", "steward", "officer", "admin"] },
    { href: `/${locale}/dashboard/dues`, icon: <DollarSign size={16} />, label: 'Dues & Payments', roles: ["member", "steward", "officer", "admin"] },
  ]
}
```

### Option 2: Create Dedicated "Workplace Safety" Section

Create a new section for Health & Safety (more prominent):

```tsx
{
  title: 'Workplace Safety',
  roles: ["member", "steward", "officer", "admin"],
  items: [
    { 
      href: `/${locale}/dashboard/health-safety`, 
      icon: <Shield size={16} />, 
      label: 'Safety Dashboard', 
      roles: ["member", "steward", "officer", "admin"] 
    },
    { 
      href: `/${locale}/dashboard/health-safety/incidents`, 
      icon: <AlertTriangle size={16} />, 
      label: 'Report Incident', 
      roles: ["member", "steward", "officer", "admin"] 
    },
    { 
      href: `/${locale}/dashboard/health-safety/hazards`, 
      icon: <FileWarning size={16} />, 
      label: 'Report Hazard', 
      roles: ["member", "steward", "officer", "admin"] 
    },
    { 
      href: `/${locale}/dashboard/health-safety/inspections`, 
      icon: <ClipboardCheck size={16} />, 
      label: 'Inspections', 
      roles: ["steward", "officer", "admin"] 
    },
  ]
}
```

### Option 3: Add to "Representative Tools" (Steward+)

Limit to representatives and leadership:

```tsx
{
  title: t('sidebar.representativeTools'),
  roles: ["steward", "officer", "admin"],
  items: [
    { href: `/${locale}/dashboard/workbench`, icon: <FileBarChart size={16} />, label: t('claims.caseQueue'), roles: ["steward", "officer", "admin"] },
    { href: `/${locale}/dashboard/members`, icon: <Users size={16} />, label: t('members.directory'), roles: ["steward", "officer", "admin"] },
    // ⭐ ADD THIS LINE
    { href: `/${locale}/dashboard/health-safety`, icon: <Shield size={16} />, label: 'Health & Safety', roles: ["steward", "officer", "admin"] },
    { href: `/${locale}/dashboard/clause-library`, icon: <Library size={16} />, label: t('sidebar.clauseLibrary'), roles: ["steward", "officer", "admin"] },
    ...
  ]
}
```

## 📦 Required Icon Imports

Add to the top of `sidebar.tsx`:

```tsx
import { 
  Shield,           // For main H&S dashboard
  AlertTriangle,    // For incidents
  ClipboardCheck,   // For inspections
  FileWarning,      // For hazards (if needed)
  // ... existing imports
} from "lucide-react";
```

**Note:** `Shield` is already imported, so you may only need to add `AlertTriangle`, `ClipboardCheck`, and `FileWarning`.

## 🌐 Translation Keys

Add to your `messages/{locale}.json`:

```json
{
  "navigation": {
    "healthSafety": "Health & Safety",
    "incidents": "Incidents",
    "inspections": "Inspections",
    "hazards": "Hazards"
  },
  "sidebar": {
    "workplaceSafety": "Workplace Safety",
    "safetyDashboard": "Safety Dashboard",
    "reportIncident": "Report Incident",
    "reportHazard": "Report Hazard"
  }
}
```

Then use in sidebar:

```tsx
{ 
  href: `/${locale}/dashboard/health-safety`, 
  icon: <Shield size={16} />, 
  label: t('navigation.healthSafety'), 
  roles: ["member", "steward", "officer", "admin"] 
}
```

## 🎯 Recommended Placement

**Best Practice:** Add to "Your Union" section as shown in Option 1.

**Rationale:**
- Makes safety reporting accessible to all members
- Positions safety as a core union function
- Encourages reporting culture
- Aligns with member-first navigation

## 🔐 Role-Based Access

### Current Pages Support These Roles:

```typescript
// All H&S pages check for organizationId
// Recommended role access:

// Dashboard: All roles
["member", "steward", "officer", "admin", "health_safety_rep"]

// Report Incident/Hazard: All roles
["member", "steward", "officer", "admin", "health_safety_rep"]

// View/Manage Incidents: Representatives+
["steward", "officer", "admin", "health_safety_rep"]

// Inspections: Representatives+
["steward", "officer", "admin", "health_safety_rep"]

// Admin/Analytics: Leadership
["officer", "admin"]
```

### To Implement Permission Checks:

Add to pages where needed:

```tsx
import { useHasPermission } from "@/lib/auth/rbac-hooks";
import { Permission } from "@/lib/auth/roles";

const hasManagePermission = useHasPermission(Permission.MANAGE_HEALTH_SAFETY);
const hasViewPermission = useHasPermission(Permission.VIEW_HEALTH_SAFETY_CLAIMS);
```

## 🎨 Icon Styling

The sidebar uses 16px icons consistently:

```tsx
icon: <Shield size={16} />
```

Color is applied automatically by the sidebar component based on active state.

## 📱 Mobile Support

The sidebar automatically collapses on mobile (`w-[60px]` on mobile, `w-[220px]` on desktop).

Icons are visible on both, labels only show on desktop.

## ✅ Complete Integration Example

Add this section after "Participation" and before "Representative Tools":

```tsx
{
  title: 'Workplace Safety',
  roles: ["member", "steward", "officer", "admin", "health_safety_rep"],
  items: [
    { 
      href: `/${locale}/dashboard/health-safety`, 
      icon: <Shield size={16} />, 
      label: t('sidebar.safetyDashboard') || 'Safety Dashboard', 
      roles: ["member", "steward", "officer", "admin", "health_safety_rep"] 
    },
    { 
      href: `/${locale}/dashboard/health-safety/incidents/new`, 
      icon: <AlertTriangle size={16} />, 
      label: t('sidebar.reportIncident') || 'Report Incident', 
      roles: ["member", "steward", "officer", "admin", "health_safety_rep"] 
    },
    { 
      href: `/${locale}/dashboard/health-safety/hazards`, 
      icon: <FileWarning size={16} />, 
      label: t('sidebar.reportHazard') || 'Report Hazard', 
      roles: ["member", "steward", "officer", "admin", "health_safety_rep"] 
    },
  ]
},
```

## 🧪 Testing

After integration:

1. ✅ Check navigation item appears for correct roles
2. ✅ Verify icon visibility on mobile
3. ✅ Test active state highlighting
4. ✅ Confirm translations load correctly
5. ✅ Test navigation flow to all H&S pages

## 📋 Quick Implementation Checklist

- [ ] Import required icons (`Shield`, `AlertTriangle`, `ClipboardCheck`, `FileWarning`)
- [ ] Add navigation section to `getNavigationSections()`
- [ ] Add translation keys to messages JSON
- [ ] Test on mobile and desktop
- [ ] Verify role-based visibility
- [ ] Test active state highlighting
- [ ] Document any custom permission logic

## 🚀 Ready to Deploy

Once integrated:
1. Navigation will automatically filter by role
2. Active page highlighting works out of the box
3. Mobile/desktop responsive behavior is automatic
4. Translation fallbacks use English labels

---

**File to Modify:** `components/sidebar.tsx`  
**Lines to Add:** ~10-20 depending on approach  
**Breaking Changes:** None  
**Backward Compatible:** Yes
