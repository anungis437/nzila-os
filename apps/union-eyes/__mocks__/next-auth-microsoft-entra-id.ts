export default function MicrosoftEntraID() {
  return {
    id: 'microsoft-entra-id',
    name: 'Microsoft Entra ID',
    type: 'oauth',
    authorization: { url: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize' },
    token: { url: 'https://login.microsoftonline.com/common/oauth2/v2.0/token' },
    userinfo: { url: 'https://graph.microsoft.com/oidc/userinfo' },
    profile(profile: Record<string, unknown>) {
      return {
        id: String(profile.sub ?? 'test-user'),
        name: String(profile.name ?? 'Test User'),
        email: String(profile.email ?? 'test@example.com'),
        image: null,
      };
    },
  };
}
