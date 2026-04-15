"use client";

import { usePathname, useRouter } from "next/navigation";
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

export default function LanguageSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  
  // Extract locale from pathname (e.g., /en-CA/... or /fr-CA/...)
  const pathSegments = pathname.split("/");
  const localeFromPath = pathSegments[1];
  const locale = locales.find((l) => l.code === localeFromPath)?.code || "en-CA";

  const currentLocale = locales.find((l) => l.code === locale) || locales[0];

  const switchLocale = (newLocale: string) => {
    const segments = pathname.split("/");
    // segments[1] is either a locale code (e.g. "fr-CA") or a root marketing
    // page segment (e.g. "story", "pricing").  Only replace it when it IS a
    // locale; otherwise prepend the new locale to the full path.
    const knownLocaleCodes: string[] = locales.map((l) => l.code);
    const hasLocalePrefix = knownLocaleCodes.includes(segments[1]);

    let newPath: string;
    if (hasLocalePrefix) {
      // /fr-CA/story  →  /en-CA/story
      segments[1] = newLocale;
      newPath = segments.join("/");
    } else {
      // /story  →  /fr-CA/story
      // /       →  /fr-CA
      const rest = pathname === "/" ? "" : pathname;
      newPath = `/${newLocale}${rest}`;
    }

    router.replace(newPath);
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

