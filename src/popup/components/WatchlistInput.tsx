import { useId, useRef, useState } from 'react';
import { isIgnoredWatchItem, replaceWatchlistLine, suggestWatchSkins, toggleIgnoredWatchLine } from '../../services/watchlist';

export default function WatchlistInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const input = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const [caret, setCaret] = useState(value.length);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const lineStart = caret === 0 ? 0 : value.lastIndexOf('\n', caret - 1) + 1;
  const lineEnd = value.indexOf('\n', caret);
  const suggestions = open ? suggestWatchSkins(value.slice(lineStart, lineEnd < 0 ? value.length : lineEnd)) : [];
  const active = Math.min(selected, Math.max(0, suggestions.length - 1));

  const choose = (suggestion: string) => {
    const next = replaceWatchlistLine(value, caret, suggestion);
    onChange(next.text);
    setCaret(next.caret);
    setOpen(false);
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(next.caret, next.caret);
      setOpen(false);
    });
  };

  return (
    <div>
      <textarea
        ref={input}
        value={value}
        aria-label="Watchlist skins, one per line"
        role="combobox"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-expanded={suggestions.length > 0}
        aria-controls={`${id}-suggestions`}
        aria-activedescendant={suggestions.length ? `${id}-${active}` : undefined}
        onChange={(event) => {
          onChange(event.target.value);
          setCaret(event.target.selectionStart);
          setSelected(0);
          setOpen(true);
        }}
        onClick={(event) => { setCaret(event.currentTarget.selectionStart); setSelected(0); setOpen(true); }}
        onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') { setOpen(false); return; }
          if (!suggestions.length) return;
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setSelected((active + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length);
          } else if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            choose(suggestions[active]);
          }
        }}
        placeholder={'M4A4 | Poseidon (Factory New)\nAK-47 | Redline (Field-Tested)'}
        className="w-full min-h-[72px] px-2.5 py-2 bg-bg-card border border-ui-border/[0.06] rounded-md text-text-primary text-xs placeholder:text-text-muted focus:outline-none focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20 transition-all resize-y"
      />
      {suggestions.length > 0 && (
        <ul id={`${id}-suggestions`} role="listbox" aria-label="Matching skins" className="mt-1 max-h-44 overflow-y-auto rounded-md border border-ui-border/10 bg-bg-card">
          {suggestions.map((suggestion, index) => (
            <li key={suggestion} id={`${id}-${index}`} role="option" aria-selected={index === active}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(suggestion)}
              className={`px-2.5 py-2 text-xs cursor-pointer ${index === active ? 'bg-accent-blue text-on-accent' : 'text-text-secondary hover:bg-ui-overlay/10'}`}>
              {suggestion}
            </li>
          ))}
        </ul>
      )}
      <p className="text-[10px] text-text-muted mt-1">Type a weapon or skin. Use ↑/↓ and Enter to select; Shift+Enter adds a line. No wear suffix scans all available wears.</p>
      {value.trim() && (
        <fieldset className="mt-3 space-y-1">
          <legend className="text-xs font-semibold text-text-secondary mb-1">Skins included in scans</legend>
          <p className="text-[10px] text-text-muted mb-2">Uncheck a skin to ignore it. Changes save automatically; check it again to restore it. Ignored lines start with !. If all skins are ignored, no listings are scanned.</p>
          {value.split('\n').map((line, index) => line.trim() ? (
            <label key={index} className="flex items-start gap-2 rounded-md bg-bg-card px-2 py-1.5 text-xs text-text-secondary">
              <input type="checkbox" checked={!isIgnoredWatchItem(line)}
                onChange={() => onChange(toggleIgnoredWatchLine(value, index))}
                className="mt-0.5 accent-accent-blue" />
              <span className={isIgnoredWatchItem(line) ? 'line-through text-text-muted' : ''}>
                {line.trim().replace(/^!\s*/, '') || '(empty ignored entry)'}
              </span>
              {isIgnoredWatchItem(line) && <span className="ml-auto text-[10px] text-text-muted">Ignored</span>}
            </label>
          ) : null)}
        </fieldset>
      )}
    </div>
  );
}
