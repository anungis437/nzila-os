'use client'

/**
 * Tiny client-side button that dispatches a synthetic ⌘K keystroke to open
 * the global CommandPalette. Lives in the desktop TopBar so users can
 * discover the shortcut without memorizing it.
 */
export function PaletteTrigger() {
  const onClick = () => {
    // The palette listens for keydown with metaKey/ctrlKey + 'k'.
    // Synthesize a matching event so we don't have to thread state from layout.
    const ev = new KeyboardEvent('keydown', {
      key: 'k',
      code: 'KeyK',
      ctrlKey: true,
      metaKey: true,
      bubbles: true,
    })
    window.dispatchEvent(ev)
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500 shadow-sm hover:bg-slate-50"
      aria-label="Open command palette"
    >
      <span>Jump to…</span>
      <span className="flex items-center gap-0.5">
        <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 ring-1 ring-slate-200">
          ⌘
        </kbd>
        <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 ring-1 ring-slate-200">
          K
        </kbd>
      </span>
    </button>
  )
}
