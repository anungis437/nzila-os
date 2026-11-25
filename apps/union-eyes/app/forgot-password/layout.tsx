import { UnprefixedAuthIntl } from '@/components/auth/unprefixed-auth-intl';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <UnprefixedAuthIntl>{children}</UnprefixedAuthIntl>;
}
