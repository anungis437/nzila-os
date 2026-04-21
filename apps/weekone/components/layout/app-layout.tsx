import { Sidebar } from "./sidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex-1 p-6">{children}</div>
      </main>
    </div>
  );
}
