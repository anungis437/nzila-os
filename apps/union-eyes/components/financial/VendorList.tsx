'use client';

import FinancialCapabilityUnavailable from './FinancialCapabilityUnavailable';

interface VendorListProps {
  organizationId?: string | null;
}

/** Vendors have no qualified record store; see FinancialCapabilityUnavailable. */
export default function VendorList(_props: VendorListProps) {
  return <FinancialCapabilityUnavailable capability="vendors" />;
}
