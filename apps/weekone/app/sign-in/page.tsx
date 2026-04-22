export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <p className="text-2xl font-bold">
          Week<span className="text-electric">One</span>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Welcome back. Sign in to continue.
        </p>
        <div className="mt-6">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- /api/auth/signin is a NextAuth API route, not a page; <Link> would be incorrect */}
          <a
            href="/api/auth/signin"
            className="block w-full rounded-lg bg-electric py-2.5 text-sm font-semibold text-white hover:bg-electric/90"
          >
            Sign In
          </a>
        </div>
      </div>
    </div>
  );
}
