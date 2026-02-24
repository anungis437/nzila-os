/**
 * Header component for the Template App
 * Features a modern glassmorphism design with bento-style UI elements
 * Includes subtle 3D effects and glowing accents
 */
"use client";

import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Home, LayoutDashboard, Menu, X } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import LanguageSwitcher from "./language-switcher";

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const isActive = (path: string) => pathname === path;

  // Prevent hydration mismatch by not rendering animations until mounted
  if (!mounted) {
    return (
      <div className="sticky top-0 z-50 w-full px-4 py-3 flex justify-center">
        <header 
          className="rounded-xl backdrop-blur-xl bg-white/50 border border-white/40 shadow-sm relative overflow-hidden max-w-fit mx-auto min-w-[min(95%,800px)]"
        >
          <div className="px-6 py-3 relative">
            <div className="flex items-center justify-between gap-8">
              {/* Minimal skeleton during SSR */}
              <div className="flex items-center space-x-3">
                <div className="bg-primary/10 p-2 rounded-xl shadow-sm border border-primary/20">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 text-primary" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-8 h-8" />
              </div>
            </div>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-50 w-full px-4 py-3 flex justify-center">
      {/* Glassmorphism container with width snapped to content */}
      <motion.header 
        className={`rounded-xl backdrop-blur-xl bg-white/50 border border-white/40 ${
          scrolled 
            ? "shadow-md" 
            : "shadow-sm"
        } relative overflow-hidden transition-all duration-300 max-w-fit mx-auto min-w-[min(95%,800px)]`}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Enhanced glassmorphism glow effects */}
        <motion.div 
          className="absolute inset-0 bg-linear-to-r from-primary/5 via-transparent to-primary/5 pointer-events-none"
          animate={{ 
            opacity: [0.5, 0.7, 0.5],
            background: [
              "linear-gradient(to right, rgba(var(--primary), 0.05), transparent, rgba(var(--primary), 0.05))",
              "linear-gradient(to right, rgba(var(--primary), 0.07), transparent, rgba(var(--primary), 0.07))",
              "linear-gradient(to right, rgba(var(--primary), 0.05), transparent, rgba(var(--primary), 0.05))"
            ]
          }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />
        
        {/* Enhanced edge highlights for 3D effect */}
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white to-transparent opacity-80" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-gray-300/50 to-transparent" />
        <div className="absolute inset-y-0 left-0 w-px bg-linear-to-b from-transparent via-white to-transparent opacity-80" />
        <div className="absolute inset-y-0 right-0 w-px bg-linear-to-b from-transparent via-white to-transparent opacity-80" />
        
        <div className="px-6 py-3 relative">
          <div className="flex items-center justify-between gap-8">
            {/* Logo area with glow */}
            <motion.div 
              className="flex items-center space-x-3"
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              <div className="bg-primary/10 p-2 rounded-xl shadow-sm border border-primary/20 relative group">
                {/* Enhanced glow behind logo */}
                <motion.div 
                  className="absolute inset-0 bg-primary/10 rounded-xl blur-md group-hover:blur-lg transition-all duration-300"
                  animate={{ 
                    boxShadow: [
                      "0 0 0px rgba(var(--primary), 0.2)", 
                      "0 0 15px rgba(var(--primary), 0.4)", 
                      "0 0 0px rgba(var(--primary), 0.2)"
                    ]
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                />
                
                <svg 
                  viewBox="0 0 24 24" 
                  className="w-6 h-6 text-primary relative z-10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 4h16v16H4z" />
                  <path d="M12 4v16" />
                  <path d="M4 12h16" />
                </svg>
              </div>
              <div className="text-lg font-bold bg-linear-to-r from-blue-900 to-blue-600 bg-clip-text text-transparent">
                UnionEyes
              </div>
            </motion.div>

            {/* Navigation - Desktop */}
            <nav className="hidden md:flex space-x-2">
              <NavButton 
                href="/" 
                icon={<Home size={18} />} 
                label="Home"
                isActive={isActive("/")}
              />

              <SignedIn>
                <NavButton 
                  href="/en-CA/dashboard" 
                  icon={<LayoutDashboard size={18} />} 
                  label="Dashboard"
                  isActive={isActive("/en-CA/dashboard") || isActive("/fr-CA/dashboard")}
                />
              </SignedIn>
            </nav>

            {/* Right side actions */}
            <div className="flex items-center space-x-3">
              <LanguageSwitcher />
              
              <SignedOut>
                <Link href="/login?redirect_url=/dashboard">
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="font-medium rounded-xl bg-white/70 hover:bg-white/90 shadow-sm border border-white/60 text-gray-800 relative overflow-hidden group"
                    >
                      {/* Enhanced button glow effect */}
                      <motion.span 
                        className="absolute inset-0 w-full h-full bg-linear-to-r from-primary/0 via-primary/20 to-primary/0"
                        animate={{ 
                          x: ['-100%', '200%'],
                        }}
                        transition={{ 
                          duration: 2.5, 
                          ease: "easeInOut",
                          repeat: Infinity,
                          repeatDelay: 1
                        }}
                      />
                      <span className="relative z-10">Sign In</span>
                    </Button>
                  </motion.div>
                </Link>
              </SignedOut>

              <SignedIn>
                <motion.div 
                  className="bg-white/80 p-0.5 rounded-full shadow-sm border border-white/80 relative w-9.5 h-9.5"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {/* Enhanced glow behind avatar */}
                  <motion.div 
                    className="absolute inset-0 rounded-full"
                    animate={{ 
                      boxShadow: [
                        "0 0 0px rgba(var(--primary), 0.2)", 
                        "0 0 10px rgba(var(--primary), 0.4)", 
                        "0 0 0px rgba(var(--primary), 0.2)"
                      ]
                    }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  />
                  
                  <UserButton 
                    afterSignOutUrl="/"
                    appearance={{
                      elements: {
                        avatarBox: "w-full h-full rounded-full",
                        avatarImage: "w-full h-full rounded-full object-cover"
                      }
                    }}
                  />
                </motion.div>
              </SignedIn>

              {/* Mobile menu button */}
              <div className="md:hidden">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleMenu}
                    aria-label="Toggle menu"
                    className="text-gray-800 bg-white/70 rounded-xl shadow-sm border border-white/60 hover:bg-white/90 relative overflow-hidden w-9.5 h-9.5 p-0"
                  >
                    {/* Enhanced button glow effect */}
                    <motion.span 
                      className="absolute inset-0 w-full h-full bg-linear-to-r from-primary/0 via-primary/20 to-primary/0"
                      animate={{ 
                        x: ['-100%', '200%'],
                      }}
                      transition={{ 
                        duration: 2.5, 
                        ease: "easeInOut",
                        repeat: Infinity,
                        repeatDelay: 1
                      }}
                    />
                    
                    <span className="relative z-10">
                      {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </span>
                  </Button>
                </motion.div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile menu with animation */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.nav 
              className="md:hidden border-t border-white/30 mt-1 p-3 bg-white/80 backdrop-blur-md rounded-b-xl"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="space-y-3 flex flex-col">
                <MobileNavLink 
                  href="/" 
                  icon={<Home size={18} />} 
                  label="Home" 
                  isActive={isActive("/")}
                  onClick={toggleMenu}
                />

                <SignedIn>
                  <MobileNavLink 
                    href="/en-CA/dashboard" 
                    icon={<LayoutDashboard size={18} />} 
                    label="Dashboard" 
                    isActive={isActive("/en-CA/dashboard") || isActive("/fr-CA/dashboard")}
                    onClick={toggleMenu}
                  />
                </SignedIn>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </motion.header>
    </div>
  );
}

interface NavButtonProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
}

function NavButton({ href, icon, label, isActive }: NavButtonProps) {
  return (
    <Link href={href}>
      <motion.div
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
      >
        <Button
          variant="ghost"
          size="sm"
          className={`rounded-xl flex items-center space-x-1.5 px-4 py-2 shadow-sm border transition-all duration-200 relative overflow-hidden ${
            isActive 
              ? "bg-primary/10 border-primary/30 text-primary" 
              : "bg-white/70 border-white/60 text-gray-700 hover:bg-white/90 hover:text-gray-900"
          }`}
        >
          <span className="relative z-10">{icon}</span>
          <span className="relative z-10">{label}</span>
        </Button>
      </motion.div>
    </Link>
  );
}

interface MobileNavLinkProps extends NavButtonProps {
  onClick: () => void;
}

function MobileNavLink({ href, icon, label, isActive, onClick }: MobileNavLinkProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, x: 4 }}
      transition={{ type: "spring", stiffness: 400, damping: 10 }}
    >
      <Link
        href={href}
        onClick={onClick}
        className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg border relative overflow-hidden ${
          isActive 
            ? "bg-primary/10 border-primary/30 text-primary" 
            : "bg-white/70 border-white/60 text-gray-700"
        }`}
      >
        <span className="relative z-10">{icon}</span>
        <span className="relative z-10 font-medium">{label}</span>
      </Link>
    </motion.div>
  );
}

