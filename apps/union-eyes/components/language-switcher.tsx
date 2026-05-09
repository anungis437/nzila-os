"use client";

import { usePathname, useRouter } from "@/i18n/navigation";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import { motion } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const locales = [
  { code: "en-CA", label: "English", flag: "🇨🇦" },
  { code: "fr-CA", label: "Français", flag: "🇨🇦" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
] as const;

type LocaleCode = (typeof locales)[number]["code"];

export default function LanguageSwitcher() {
  // next-intl's usePathname strips the locale prefix, giving the "clean" path.
  // e.g. on /en-CA/solutions it returns /solutions
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();

  // Read active locale from URL params (most reliable vs. parsing the raw path)
  const localeParam = (params?.locale as string) ?? "en-CA";
  const locale: LocaleCode =
    (locales.find((l) => l.code === localeParam)?.code as LocaleCode) ?? "en-CA";

  const currentLocale = locales.find((l) => l.code === locale) ?? locales[0];

  const switchLocale = (newLocale: LocaleCode) => {
    // next-intl's router.replace(path, { locale }) swaps the [locale] segment
    // and properly invalidates NextIntlClientProvider, triggering a server
    // component re-render with the new messages bundle.
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-xl flex items-center space-x-1.5 px-3 py-2 shadow-sm border bg-white/70 border-white/60 text-gray-700 hover:bg-white/90 hover:text-gray-900 relative overflow-hidden"
          >
            <Globe size={16} className="relative z-10" />
            <span className="relative z-10 text-lg">{currentLocale.flag}</span>
            <span className="relative z-10 hidden sm:inline">{currentLocale.label}</span>
          </Button>
        </motion.div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 bg-white/95 backdrop-blur-md border-white/60 shadow-lg">
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc.code}
            onClick={() => switchLocale(loc.code)}
            className={`flex items-center space-x-2 cursor-pointer ${
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

