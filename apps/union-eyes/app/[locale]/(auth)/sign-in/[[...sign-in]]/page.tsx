"use client";


export const dynamic = 'force-dynamic';
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex flex-col items-center justify-center w-full min-h-screen bg-background">
      <div className="w-full max-w-md">
        <SignIn
          appearance={{ 
            elements: {
              formButtonPrimary: "bg-primary hover:bg-primary/90",
              card: "rounded-xl shadow-sm"
            }
          }}
        />
      </div>
    </div>
  );
}
