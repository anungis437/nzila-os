'use client';

import VendorForm from '@/components/financial/VendorForm';

export default function NewVendorClient() {
  return (
    <div className="container mx-auto py-10">
      <VendorForm mode="create" />
    </div>
  );
}
