'use client';

import FinancialCapabilityUnavailable from './FinancialCapabilityUnavailable';

interface VendorFormProps {
  vendor?: unknown;
  mode: 'create' | 'edit';
}

/** Vendor maintenance has no qualified record store; see FinancialCapabilityUnavailable. */
export default function VendorForm(_props: VendorFormProps) {
  return <FinancialCapabilityUnavailable capability="vendors" />;
}
