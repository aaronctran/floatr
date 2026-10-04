import { useId, useState } from 'react';
import { Check, Pause, Pencil, Play, Trash2 } from 'lucide-react';
import { isIgnoredWatchItem, normalizeWatchlist, toggleIgnoredWatchLine } from '../../services/watchlist';

import WatchlistBrowser from './WatchlistBrowser';

export default function WatchlistInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId();
  const [editing, setEditing] = useState<{ index: number; original: string; draft: string } | null>(null);
  const [editError, setEditError] = useState('');
  const actionClass = 'inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card';
  const saveEdit = () => {
    if (!editing) return;
    const lines = value.split('\n');
    if (lines[editing.index] !== editing.original) {
      setEditError('This entry changed. Cancel and reopen Edit to try again.');
      return;
    }
    const draft = editing.draft.trim().replace(/^!\s*/, '');
    if (!draft || /[\r\n]/.test(draft)) {
      setEditError('Enter one skin name.');
      return;
    }
    const normalized = normalizeWatchlist([draft])[0].normalized;
    lines[editing.index] = `${isIgnoredWatchItem(editing.original) ? '! ' : ''}${normalized}`;
    onChange(lines.join('\n'));
    setEditing(null);
    setEditError('');
  };
  return (
    <div>
      <WatchlistBrowser value={value} onChange={onChange} />
      {value.trim() && (
        <fieldset className="mt-3 space-y-1">
          <legend className="text-xs font-semibold text-text-secondary mb-1">Skins included in scans</legend>
          {value.split('\n').filter((line) => line.trim()).every(isIgnoredWatchItem) && <p className="text-[11px] text-text-muted mb-2">All skins paused · no listings scanned.</p>}
          {value.split('\n').map((line, index) => line.trim() ? (
            <div key={index} className={`rounded-md border px-3 py-2.5 text-xs ${isIgnoredWatchItem(line) ? 'bg-accent-amber/5 border-accent-amber/30 border-l-[3px]' : 'bg-bg-card border-ui-border/10'}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
              <span className="text-text-primary font-medium break-words min-w-0 flex-1">
                {line.trim().replace(/^!\s*/, '') || '(empty ignored entry)'}
              </span>
              <span className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${isIgnoredWatchItem(line) ? 'bg-accent-amber/15' : 'bg-accent-green/10'}`}
                style={{ color: isIgnoredWatchItem(line) ? 'light-dark(#92400e, #fbbf24)' : 'light-dark(#166534, #4ade80)' }}>
                {isIgnoredWatchItem(line) ? <Pause className="w-3 h-3" aria-hidden="true" /> : <Check className="w-3 h-3" aria-hidden="true" />}
                {isIgnoredWatchItem(line) ? 'Paused' : 'Active'}
              </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <button type="button" className={`${actionClass} bg-accent-blue/15 border-accent-blue/40 text-accent-blue hover:bg-accent-blue/25`} aria-label={`Edit ${line.trim().replace(/^!\s*/, '')}`}
                  onClick={() => { setEditing({ index, original: line, draft: line.trim().replace(/^!\s*/, '') }); setEditError(''); }}><Pencil className="w-3.5 h-3.5" aria-hidden="true" />Edit</button>
                <button type="button" className={`${actionClass} ${isIgnoredWatchItem(line) ? 'bg-accent-green/15 border-accent-green/40 hover:bg-accent-green/25' : 'bg-accent-amber/15 border-accent-amber/40 hover:bg-accent-amber/25'}`}
                  style={{ color: isIgnoredWatchItem(line) ? 'light-dark(#166534, #4ade80)' : 'light-dark(#92400e, #fbbf24)' }}
                  aria-label={`${isIgnoredWatchItem(line) ? 'Resume' : 'Pause'} ${line.trim().replace(/^!\s*/, '')}`}
                  onClick={() => { setEditing(null); onChange(toggleIgnoredWatchLine(value, index)); }}>
                  {isIgnoredWatchItem(line) ? <Play className="w-3.5 h-3.5" aria-hidden="true" /> : <Pause className="w-3.5 h-3.5" aria-hidden="true" />}
                  {isIgnoredWatchItem(line) ? 'Resume' : 'Pause'}
                </button>
                <button type="button" className={`${actionClass} bg-accent-red/10 border-accent-red/35 hover:bg-accent-red/20`} style={{ color: 'light-dark(#b91c1c, #f87171)' }} aria-label={`Remove ${line.trim().replace(/^!\s*/, '')}`}
                  onClick={() => { setEditing(null); onChange(value.split('\n').filter((_, lineIndex) => lineIndex !== index).join('\n')); }}><Trash2 className="w-3.5 h-3.5" aria-hidden="true" />Remove</button>
              </div>
              {editing?.index === index && (
                <div className="mt-3 space-y-2">
                  <label className="block" htmlFor={`${id}-edit`}>Skin name</label>
                  <input id={`${id}-edit`} type="text" autoFocus value={editing.draft}
                    aria-invalid={!!editError} aria-describedby={editError ? `${id}-edit-error` : undefined}
                    onChange={(event) => { setEditing({ ...editing, draft: event.target.value }); setEditError(''); }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') { event.preventDefault(); saveEdit(); }
                      if (event.key === 'Escape') { setEditing(null); setEditError(''); }
                    }}
                    className="w-full px-2.5 py-2 bg-bg-primary border border-ui-border/10 rounded-md text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue" />
                  <div className="flex gap-2">
                    <button type="button" onClick={saveEdit} className="px-2.5 py-1.5 rounded-md bg-accent-blue text-on-accent">Save changes</button>
                    <button type="button" className={`${actionClass} border-ui-border/15 text-text-secondary hover:bg-ui-overlay/5`} onClick={() => { setEditing(null); setEditError(''); }}>Cancel</button>
                  </div>
                  {editError && <p id={`${id}-edit-error`} role="alert" className="text-accent-red">{editError}</p>}
                </div>
              )}
            </div>
          ) : null)}
        </fieldset>
      )}
    </div>
  );
}
