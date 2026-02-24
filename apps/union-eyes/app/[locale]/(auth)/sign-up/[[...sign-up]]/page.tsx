"use client";


export const dynamic = 'force-dynamic';
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex flex-col items-center justify-center w-full min-h-screen">
      <div className="w-full max-w-md">
        <SignUp
          appearance={{ 
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
