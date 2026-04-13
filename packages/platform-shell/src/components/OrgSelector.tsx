'use client';

import { useShell } from '../context/provider';

export function OrgSelector() {
  const { org, availableOrgs, switchOrg } = useShell();

  if (availableOrgs.length <= 1) {
    return (
      <div className="px-3 py-2 text-sm font-medium text-gray-700">
        {org?.name ?? 'No organization'}
      </div>
    );
  }

  return (
    <div className="relative">
      <select
        value={org?.id ?? ''}
        onChange={(e) => switchOrg(e.target.value)}
        className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {availableOrgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}
