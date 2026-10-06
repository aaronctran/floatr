import { useId, useState } from 'react';
import { Info } from 'lucide-react';

export default function SectionHelp({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);

  return (
    <span className="relative inline-flex shrink-0 normal-case tracking-normal font-normal"
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => { if (!pinned) setOpen(false); }}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setPinned(false); } }}
      onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); setPinned(false); } }}>
      <button type="button" aria-label={`About ${label}`} aria-describedby={open ? id : undefined}
        onFocus={() => setOpen(true)}
        onClick={() => { setPinned(!pinned); setOpen(!pinned); }}
        className="inline-flex items-center justify-center p-1 rounded text-text-muted hover:text-accent-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue">
        <Info className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
      {open && <span id={id} role="tooltip"
        className="absolute right-0 top-full z-50 w-64 max-w-[calc(100vw-3rem)] rounded-md border border-ui-border/15 bg-bg-card p-3 text-xs leading-relaxed text-text-primary shadow-xl">
        {children}
      </span>}
    </span>
  );
}
