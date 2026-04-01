'use client';

import { useShell } from '../context/provider.js';

export interface AppSwitcherProps {
  /** Maximum modules to show before collapsing into "more". */
  maxVisible?: number;
}

export function AppSwitcher({ maxVisible = 6 }: AppSwitcherProps) {
  const { modules, activeModuleId, navigateToModule } = useShell();

  const accessible = modules.filter((m) => m.accessible);
  const visible = accessible.slice(0, maxVisible);
  const overflow = accessible.slice(maxVisible);

  return (
    <div className="flex items-center gap-1">
      {visible.map((mod) => {
        const isActive = mod.id === activeModuleId;
        return (
          <button
            key={mod.id}
            type="button"
            onClick={() => navigateToModule(mod.id)}
            className={[
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-blue-100 text-blue-800'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800',
            ].join(' ')}
          >
            {mod.name}
          </button>
        );
      })}

      {overflow.length > 0 && (
        <div className="relative">
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100"
          >
            +{overflow.length} more
          </button>
        </div>
      )}
    </div>
  );
}
