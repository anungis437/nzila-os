import { AuthPolicyForm } from '@/components/admin/auth-policy-form';

export const dynamic = 'force-dynamic';

export default function AuthPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">
        Authentication policy
      </h1>
      <p className="text-sm text-gray-600 mb-8">
        Control which sign-in methods are available to members of this
        organization, enforce single sign-on, and require two-factor
        authentication for privileged roles.
      </p>
      <AuthPolicyForm />
    </div>
  );
}
