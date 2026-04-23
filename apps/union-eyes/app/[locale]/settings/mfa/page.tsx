import { MfaSettings } from '@/components/auth/mfa-settings';

export const dynamic = 'force-dynamic';

export default function MfaSettingsPage() {
  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">
        Two-factor authentication
      </h1>
      <p className="text-sm text-gray-600 mb-8">
        Protect your account with a time-based one-time password (TOTP) from
        an authenticator app such as Microsoft Authenticator, 1Password, or
        Authy.
      </p>
      <MfaSettings />
    </div>
  );
}
