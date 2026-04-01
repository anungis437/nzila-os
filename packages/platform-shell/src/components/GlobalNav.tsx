'use client';

import { useShell } from '../context/provider.js';

export function GlobalNav() {
  const { modules, activeModuleId, navigateToModule, org } = useShell();

  return (
    <nav className="flex w-16 flex-col items-center border-r border-gray-200 bg-white py-4">
      {/* Org avatar */}
      <div className="mb-6">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white"
          title={org?.name ?? 'No org'}
        >
          {org?.name?.charAt(0)?.toUpperCase() ?? '?'}
        </div>
      </div>

      {/* Module icons */}
      <div className="flex flex-1 flex-col gap-2">
        {modules.map((mod) => {
          if (!mod.accessible) return null;
          const isActive = mod.id === activeModuleId;
          return (
            <button
              key={mod.id}
              type="button"
              onClick={() => navigateToModule(mod.id)}
              title={mod.name}
              className={[
                'flex h-10 w-10 items-center justify-center rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700',
              ].join(' ')}
            >
              {mod.name.charAt(0).toUpperCase()}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
