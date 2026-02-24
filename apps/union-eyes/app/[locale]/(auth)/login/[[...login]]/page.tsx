"use client";


export const dynamic = 'force-dynamic';
import { SignIn, useUser } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { useTheme } from "next-themes";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const { theme } = useTheme();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url");
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();

  // Redirect if already signed in
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace(redirectUrl || "/dashboard");
    }
  }, [isLoaded, isSignedIn, redirectUrl, router]);

  // Don&apos;t render SignIn if already signed in or still loading
  if (!isLoaded || isSignedIn) {
    return (
      <div className="flex items-center justify-center min-h-100">
        <Loader2 className="animate-spin h-8 w-8 text-purple-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="w-full">
        <SignIn
          // Always redirect to dashboard or the specified redirect URL
          fallbackRedirectUrl={redirectUrl || "/en-CA/dashboard"}
          appearance={{ 
            baseTheme: theme === "dark" ? dark : undefined,
            elements: {
              formButtonPrimary: "bg-primary hover:bg-primary/90",
              card: "rounded-xl shadow-sm",
              formFieldInput: "rounded-lg border-gray-300 dark:border-gray-700"
            }
          }}
        />
      </div>
    </div>
  );
}
