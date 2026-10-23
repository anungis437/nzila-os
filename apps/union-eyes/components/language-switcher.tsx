"use client";

import { usePathname, useRouter } from "@/i18n/navigation";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// NOTE: `it` and `pt` remain valid routes but are hidden from the picker
// until their translations are complete. Keep in sync with
// `apps/union-eyes/i18n/config.ts` -> `visibleLocales`.
const locales = [
  { code: "en-CA", label: "English", flag: "🇨🇦" },
  { code: "fr-CA", label: "Français", flag: "🇨🇦" },
] as const;

type LocaleCode = (typeof locales)[number]["code"];

export default function LanguageSwitcher() {
  // next-intl's usePathname strips the locale prefix, giving the "clean" path.
  // e.g. on /en-CA/solutions it returns /solutions
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  // Read active locale from URL params (most reliable vs. parsing the raw path)
  const localeParam = (params?.locale as string) ?? "en-CA";
  const locale: LocaleCode =
    (locales.find((l) => l.code === localeParam)?.code as LocaleCode) ?? "en-CA";

  const currentLocale = locales.find((l) => l.code === locale) ?? locales[0];

  const switchLocale = (newLocale: LocaleCode) => {
    // next-intl's router.replace(path, { locale }) swaps the [locale] segment
    // and properly invalidates NextIntlClientProvider, triggering a server
    // component re-render with the new messages bundle.
    const query = searchParams.toString();
    router.replace(pathname + (query ? '?' + query : '') + window.location.hash, { locale: newLocale });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="default"
            aria-label={locale === "fr-CA" ? "Changer de langue" : "Change language"}
            className="flex shrink-0 items-center gap-1.5 border border-border bg-card px-3"
          >
            <Globe size={16} className="relative z-10" />
            <span className="relative z-10 sm:hidden">{locale === 'fr-CA' ? 'FR' : 'EN'}</span>
            <span className="relative z-10 hidden sm:inline">{currentLocale.label}</span>
          </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 bg-white/95 backdrop-blur-md border-white/60 shadow-lg">
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc.code}
            onClick={() => switchLocale(loc.code)}
            className={`flex min-h-11 items-center space-x-2 cursor-pointer ${
              loc.code === locale ? "bg-primary/10 text-primary" : ""
            }`}
          >
            <span className="text-lg">{loc.flag}</span>
            <span>{loc.label}</span>
            {loc.code === locale && (
              <span className="ml-auto text-primary">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

