# Domain Model — Console

> Internal platform operations console for Nzila OS.
> See also: docs/PLATFORM_SURFACE_RESPONSIBILITIES.md

## Purpose

Console is the **internal operations interface** for platform administrators
and operations teams. It provides org management, user administration,
system configuration, and operational tooling.

## Primary Surfaces

| Surface | Purpose |
|---------|---------|
| Org management | Create, configure, and manage organisations |
| User administration | Manage user accounts, roles, and permissions |
| System configuration | Platform-wide settings, feature flags, environment config |
| Blob/storage management | View and manage platform storage resources |
| Operational tools | Health monitoring, log access, admin actions |

## Boundary Rules

- Console is a **Platform Admin** surface (not Control Plane)
- Console does NOT host governance dashboards (those belong in Control Plane)
- Console does NOT surface domain-specific app workflows
- Console should consume `@nzila/os-core`, `@nzila/db`, `@nzila/blob` for platform operations
