"use client";

import { usePathname } from "next/navigation";
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
] as const;

export default function LanguageSwitcher() {
  const pathname = usePathname();
  
  // Extract locale from pathname (e.g., /en-CA/... or /fr-CA/...)
  const pathSegments = pathname.split("/");
  const localeFromPath = pathSegments[1];
  const locale = locales.find((l) => l.code === localeFromPath)?.code || "en-CA";

  const currentLocale = locales.find((l) => l.code === locale) || locales[0];

  const switchLocale = (newLocale: string) => {
    // Remove the current locale from the pathname and add the new one
    const segments = pathname.split("/");
    segments[1] = newLocale; // Replace the locale segment
    const newPath = segments.join("/");
    
    // Force a full page reload to ensure translations are updated
    // eslint-disable-next-line react-hooks/immutability
    window.location.href = newPath;
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

