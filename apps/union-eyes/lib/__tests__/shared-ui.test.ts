import { describe, it, expect, vi } from 'vitest';

vi.mock('@nzila/ui', () => ({
  Button: () => null,
  Card: () => null,
  Badge: () => null,
  Container: () => null,
  Sidebar: () => null,
  SidebarItem: () => null,
  SidebarSection: () => null,
}));

import * as sharedUi from '../shared-ui';

describe('lib/shared-ui', () => {
  it('bridges the expected @nzila/ui components', () => {
    expect(sharedUi.NzilaButton).toBeDefined();
    expect(sharedUi.NzilaCard).toBeDefined();
    expect(sharedUi.NzilaBadge).toBeDefined();
    expect(sharedUi.NzilaContainer).toBeDefined();
    expect(sharedUi.NzilaSidebar).toBeDefined();
    expect(sharedUi.NzilaSidebarItem).toBeDefined();
    expect(sharedUi.NzilaSidebarSection).toBeDefined();
  });
});
