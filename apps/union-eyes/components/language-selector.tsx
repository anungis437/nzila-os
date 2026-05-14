import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { locales } from '@/i18n';
import { localeNames, visibleLocales } from '@/i18n/config';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function LanguageSelector() {
  const t = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleLocaleChange = (newLocale: string) => {
    const segments = pathname.split('/');
    const hasLocalePrefix = locales.includes(segments[1] as (typeof locales)[number]);
    const nextPath = hasLocalePrefix
      ? `/${newLocale}${segments.slice(2).length > 0 ? `/${segments.slice(2).join('/')}` : ''}`
      : `/${newLocale}${pathname === '/' ? '' : pathname}`;

    router.push(nextPath);
  };

  return (
    <Select value={locale} onValueChange={handleLocaleChange}>
      <SelectTrigger className="w-35">
        <SelectValue placeholder={t('selectLanguage')} />
      </SelectTrigger>
      <SelectContent>
        {visibleLocales.map((loc) => (
          <SelectItem key={loc} value={loc}>
            {localeNames[loc]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

