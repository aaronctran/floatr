import type { Settings } from '../../types';
export default function StickerFilter({ value, onChange }: { value: Settings['stickerFilter']; onChange: (value: Settings['stickerFilter']) => void }) {
  return <div role="group" aria-label="Applied stickers" className="grid grid-cols-3 gap-1 rounded-lg border border-ui-border/10 bg-bg-card p-1">
    {([{ value: 'all', label: 'All' }, { value: 'with', label: 'With stickers' }, { value: 'without', label: 'No stickers' }] as const).map((option) =>
      <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}
        className={`rounded-md px-2 py-2 text-xs font-semibold ${value === option.value ? 'bg-accent-blue text-on-accent' : 'text-text-muted hover:bg-ui-overlay/5'}`}>{option.label}</button>)}
  </div>;
}
