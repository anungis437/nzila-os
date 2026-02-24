'use client';


export const dynamic = 'force-dynamic';
import VendorForm from '@/components/financial/VendorForm';

export default function NewVendorPage() {
  return (
    <div className="container mx-auto py-10">
      <VendorForm mode="create" />
    </div>
  );
}
