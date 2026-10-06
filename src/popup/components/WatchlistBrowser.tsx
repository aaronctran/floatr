import { useId, useMemo, useState } from 'react';
import { Check, Plus, Search } from 'lucide-react';
import { SKIN_CATALOG } from '../../constants/skins';
import { normalizeWatchItem, suggestWatchSkins } from '../../services/watchlist';

const categoryIndexes: Record<string, readonly number[]> = {
  Pistols: [1, 2, 3, 4, 30, 32, 36, 61, 63, 64],
  Rifles: [7, 8, 10, 13, 16, 39, 60],
  Snipers: [9, 11, 38, 40],
  SMGs: [17, 19, 23, 24, 26, 33, 34],
  Heavy: [14, 25, 27, 28, 29, 35],
};
const weapons = [...new Map(SKIN_CATALOG.map(skin => [skin.weapon, skin.defIndex])).entries()]
  .sort(([a], [b]) => a.localeCompare(b));
const categories = ['All', ...Object.keys(categoryIndexes), 'Knives', 'Gloves'];
const inCategory = (index: number, category: string) => category === 'All' ||
  (category === 'Gloves' ? index >= 5027 : category === 'Knives' ? index === 42 || index === 59 || index >= 500 && index < 5027 : categoryIndexes[category]?.includes(index));

export default function WatchlistBrowser({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId();
  const [category, setCategory] = useState('All');
  const [weapon, setWeapon] = useState('');
  const [query, setQuery] = useState('');
  const [variant, setVariant] = useState<'standard' | 'stattrak' | 'souvenir'>('standard');
  const stattrak = variant === 'stattrak';
  const souvenir = variant === 'souvenir';
  const variantFill = souvenir ? '#e3bb53' : '#e98b36';
  const variantInk = souvenir ? 'light-dark(#795b0d, #e3bb53)' : 'light-dark(#995014, #efaa63)';
  const [selected, setSelected] = useState(0);
  const [message, setMessage] = useState('');
  const availableWeapons = weapons.filter(([, index]) => inCategory(index, category));
  const suggestions = useMemo(() => {
    if (!query.trim() && !weapon) return [];
    const search = query.replace(/^(?:★\s*)?(?:st|stattrak|statrak|souvenir)™?[.\s]+/i, '');
    const names = suggestWatchSkins(`${stattrak ? 'st ' : souvenir ? 'Souvenir ' : ''}${weapon} ${search}`.trim(), SKIN_CATALOG.length);
    const eligible = new Set(SKIN_CATALOG.filter(skin => inCategory(skin.defIndex, category) && (!weapon || skin.weapon === weapon) && (!stattrak || skin.stattrak) && (!souvenir || skin.souvenir)).map(skin => skin.name));
    return names.filter(name => eligible.has(name.replace(/StatTrak™ |Souvenir /g, '').replace(/ \([^)]*\)$/, ''))).slice(0, 8);
  }, [query, weapon, category, stattrak, souvenir]);
  const watched = new Set(value.split('\n').filter(line => line.trim()).map(line => normalizeWatchItem(line.replace(/^\s*!\s*/, '')).normalized.toLowerCase()));
  const active = Math.min(selected, Math.max(0, suggestions.length - 1));
  const add = (name: string) => {
    if (watched.has(name.toLowerCase())) { setMessage('This skin is already in your watchlist.'); return; }
    onChange([...value.split('\n').filter(line => line.trim()), name].join('\n'));
    setMessage(`Added ${name}`);
  };
  return <div>
    <div className="mb-2 rounded-lg border border-ui-border/10 bg-bg-card p-1.5">
      <div role="group" aria-label="Skin variant" className="grid grid-cols-3 gap-1 rounded-md bg-bg-primary p-1">
        {(['standard', 'stattrak', 'souvenir'] as const).map(option => <button key={option} type="button" aria-pressed={variant === option}
          onClick={() => { setVariant(option); setSelected(0); setMessage(''); }}
          style={option !== 'standard' ? {
            backgroundColor: variant === option ? (option === 'souvenir' ? '#e3bb53' : '#e98b36') : option === 'souvenir' ? 'light-dark(#fff7dc, #2b2516)' : 'light-dark(#fff1e5, #2d2116)',
            borderColor: variant === option ? (option === 'souvenir' ? '#e3bb53' : '#e98b36') : option === 'souvenir' ? 'light-dark(#dfce96, #66572c)' : 'light-dark(#e8c4a3, #694322)',
            color: variant === option ? '#261406' : option === 'souvenir' ? 'light-dark(#795b0d, #e3bb53)' : 'light-dark(#995014, #efaa63)',
          } : undefined}
          className={`inline-flex min-w-0 items-center justify-center gap-1 rounded-md border px-1.5 py-2 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 ${option === 'souvenir' ? 'focus-visible:ring-[#e3bb53] hover:opacity-90' : option === 'stattrak' ? 'focus-visible:ring-[#e98b36] hover:opacity-90' : 'focus-visible:ring-accent-blue'} ${variant === option ? 'border-accent-blue bg-accent-blue text-on-accent shadow-sm' : 'border-transparent text-text-muted hover:bg-ui-overlay/5 hover:text-text-primary'}`}>
          {option === 'stattrak' ? 'StatTrak™' : option === 'souvenir' ? 'Souvenir' : 'Standard'}
        </button>)}
      </div>
    </div>
    <div className="flex w-full items-center gap-1 rounded-lg border border-accent-blue/40 bg-bg-card p-1.5 focus-within:ring-2 focus-within:ring-accent-blue/20">
      <select aria-label="Weapon category" value={category}
        onChange={event => { setCategory(event.target.value); setWeapon(''); setQuery(''); setSelected(0); setMessage(''); }}
        className="w-[27%] min-w-0 border-r border-ui-border/10 bg-bg-card py-1.5 text-xs text-text-primary focus-visible:outline-accent-blue">
        {categories.map(name => <option key={name}>{name}</option>)}
      </select>
      {category !== 'All' && <select aria-label="Weapon" value={weapon}
        onChange={event => { setWeapon(event.target.value); setQuery(''); setSelected(0); setMessage(''); }}
        className="w-[27%] min-w-0 border-r border-ui-border/10 bg-bg-card py-1.5 text-xs text-text-primary focus-visible:outline-accent-blue">
        <option value="">All weapons</option>
        {availableWeapons.map(([name]) => <option key={name}>{name}</option>)}
      </select>}
      <Search aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-accent-blue" />
      <input type="search" value={query} role="combobox" aria-label="Search skins" aria-autocomplete="list"
        aria-expanded={suggestions.length > 0} aria-controls={`${id}-results`} aria-activedescendant={suggestions.length ? `${id}-${active}` : undefined}
        placeholder={category === 'All' ? 'Search skins…' : 'Finish…'}
        onChange={event => { setQuery(event.target.value); setSelected(0); setMessage(''); }}
        onKeyDown={event => {
          if (!suggestions.length) return;
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault(); setSelected((active + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length);
          } else if (event.key === 'Enter') { event.preventDefault(); add(suggestions[active]); }
        }}
        className="w-0 min-w-0 flex-1 bg-transparent py-1.5 text-xs text-text-primary placeholder:text-text-muted focus-visible:outline-accent-blue" />
    </div>
    <ul id={`${id}-results`} role="listbox" aria-label="Matching skins" className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-ui-border/10 bg-bg-card empty:hidden">
      {suggestions.map((name, index) => <li key={name} id={`${id}-${index}`} role="option" aria-selected={index === active}
        className={`flex items-center gap-2 border-b border-ui-border/10 px-3 py-2 last:border-0 ${index === active ? 'bg-accent-blue/10' : ''}`}>
        <span className="min-w-0 flex-1 text-xs text-text-primary">
          {variant !== 'standard' && <span style={{ color: variantInk }} className="mb-1 block text-[10px] font-semibold">{souvenir ? 'Souvenir' : 'StatTrak™'}</span>}
          {name.replace(/StatTrak™ |Souvenir /, '')}
        </span>
        <button type="button" onClick={() => add(name)} disabled={watched.has(name.toLowerCase())} aria-label={`Add ${name} to watchlist`}
          style={variant !== 'standard' && !watched.has(name.toLowerCase()) ? { backgroundColor: variantFill, color: '#261406' } : undefined}
          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-accent-blue px-2 py-1.5 text-[11px] font-medium text-on-accent hover:opacity-90 disabled:bg-ui-overlay/5 disabled:text-text-muted focus-visible:ring-2 focus-visible:ring-accent-blue">
          {watched.has(name.toLowerCase()) ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {watched.has(name.toLowerCase()) ? 'Watching' : 'Add'}
        </button>
      </li>)}
    </ul>
    {(query.trim() || weapon) && !suggestions.length && <p className="mt-2 text-[11px] text-text-muted">{variant !== 'standard' ? `No ${souvenir ? 'Souvenir' : 'StatTrak'} matches. Try another skin or switch to Standard.` : 'No matching skins. Try another finish or choose All.'}</p>}
    {message && <p className="mt-2 text-[11px] text-accent-green" aria-live="polite">{message}</p>}
  </div>;
}
