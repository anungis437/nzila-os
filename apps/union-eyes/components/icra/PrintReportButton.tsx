'use client';

/**
 * Small client island used inside the (server) results page to expose a
 * Print-to-PDF affordance from the enterprise hero. The hero itself stays
 * server-rendered; only this button needs the browser.
 */
export default function PrintReportButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== 'undefined') window.print();
      }}
      className="inline-flex items-center gap-2 rounded-md border border-white/30 bg-white/10 px-4 py-2 text-xs font-medium text-white backdrop-blur-md transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/60 print:hidden"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-4 w-4"
        aria-hidden
      >
        <path d="M5 4h10v3H5V4Zm-2 4h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1v2H4v-2H3a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2Zm3 6h8v3H6v-3Zm10-3a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
      </svg>
      {label}
    </button>
  );
}
