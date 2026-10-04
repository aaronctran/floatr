import { WEAR_PRESETS } from '../../services/floatRange';

interface Props {
  min: number;
  max: number;
  selectedWears?: string[];
  onChange: (range: { minFloat: number; maxFloat: number; selectedWears?: string[] }) => void;
}

export default function FloatRangeInput({ min, max, selectedWears, onChange }: Props) {
  const selected = selectedWears ?? WEAR_PRESETS.filter((wear) => min < wear.max && max > wear.min).map((wear) => wear.short);
  const toggleWear = (short: string) => {
    const next = selected.includes(short) ? selected.filter((value) => value !== short) : [...selected, short];
    const wears = WEAR_PRESETS.filter((wear) => next.includes(wear.short));
    onChange({ selectedWears: next, minFloat: wears.length ? Math.min(...wears.map((wear) => wear.min)) : min,
      maxFloat: wears.length ? Math.max(...wears.map((wear) => wear.max)) : max });
  };
  const changeBound = (bound: 'min' | 'max', value: number) => {
    if (!Number.isFinite(value)) return;
    const clamped = Math.max(0, Math.min(1, value));
    onChange({ selectedWears, ...(bound === 'min'
      ? { minFloat: Math.min(clamped, max), maxFloat: max }
      : { minFloat: min, maxFloat: Math.max(clamped, min) }) });
  };

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Wear conditions, select multiple" className="grid grid-cols-5 gap-1.5">
        {WEAR_PRESETS.map((wear) => (
          <button key={wear.short} type="button" title={`${wear.name}: ${wear.min}–${wear.max}`}
            aria-label={`${wear.name} (${wear.short})`} aria-pressed={selected.includes(wear.short)}
            onClick={() => toggleWear(wear.short)}
            style={{
              backgroundColor: selected.includes(wear.short) ? wear.color : `${wear.color}14`,
              color: selected.includes(wear.short) ? '#0f172a' : `light-dark(#51483b, ${wear.color})`,
              borderColor: selected.includes(wear.short) ? wear.color : `${wear.color}66`,
            }}
            className="rounded-md py-2 text-xs font-semibold border transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            {wear.short}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-text-secondary">{selected.length ? WEAR_PRESETS.filter((wear) => selected.includes(wear.short)).map((wear) => wear.short).join(' + ') : 'No wear conditions selected'}</span>
        <output aria-live="polite" className="font-mono text-accent-blue tabular-nums">{min.toFixed(4)} – {max.toFixed(4)}</output>
      </div>
      <div role="group" aria-label="Float range slider" className="relative h-12 mx-2">
        <div aria-hidden="true" className="absolute left-0 right-0 top-5 h-2 rounded-full overflow-hidden" style={{ background: `linear-gradient(to right, ${WEAR_PRESETS.map((wear) => `${wear.color} ${wear.min * 100}% ${wear.max * 100}%`).join(', ')})` }}>
          {WEAR_PRESETS.filter((wear) => !selected.includes(wear.short)).map((wear) => <span key={wear.short} className="absolute inset-y-0 bg-bg-primary/90" style={{ left: `${wear.min * 100}%`, width: `${(wear.max - wear.min) * 100}%` }} />)}
          <span className="absolute inset-y-0 left-0 bg-bg-primary/75" style={{ width: `${min * 100}%` }} />
          <span className="absolute inset-y-0 right-0 bg-bg-primary/75" style={{ width: `${(1 - max) * 100}%` }} />
        </div>
        {(['min', 'max'] as const).map((bound) => <input key={bound} type="range"
          aria-label={`${bound === 'min' ? 'Minimum' : 'Maximum'} float`}
          min="0" max="1" step="0.001" value={bound === 'min' ? min : max}
          aria-valuetext={(bound === 'min' ? min : max).toFixed(4)}
          onChange={(event) => changeBound(bound, event.target.valueAsNumber)}
          className={`float-range-handle float-range-${bound}`} />)}
      </div>
      <div aria-hidden="true" className="flex justify-between text-[10px] text-text-muted"><span>0.00 · Less wear</span><span>More wear · 1.00</span></div>
      <div className="grid grid-cols-2 gap-3">
        {(['min', 'max'] as const).map((bound) => (
          <label key={bound} className="block text-[11px] text-text-secondary">
            {bound === 'min' ? 'Minimum float' : 'Maximum float'}
            <input type="number" aria-label={`${bound === 'min' ? 'Minimum' : 'Maximum'} float exact value`}
              min={bound === 'min' ? 0 : min} max={bound === 'max' ? 1 : max} step="0.000001"
              value={bound === 'min' ? min : max} onChange={(event) => changeBound(bound, event.target.valueAsNumber)}
              className="mt-1 w-full rounded border border-ui-border/10 bg-bg-card px-2 py-1 text-text-primary font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue" />
          </label>
        ))}
      </div>
      {!selected.length && <p className="text-[10px] text-amber-400">Select at least one wear condition to receive deals.</p>}
    </div>
  );
}
