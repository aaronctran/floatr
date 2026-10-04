import { useEffect, useState } from 'react';
import { getSettings, setSettings } from '../../services/storage';
import { THEMES, applyTheme } from '../../services/themes';

export default function SettingsTab() {
  const [apiKey, setApiKey] = useState('');
  const [theme, setTheme] = useState('original');
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    Promise.all([getSettings(), chrome.storage.local.get('uiTheme')]).then(([settings, stored]) => {
      setApiKey(settings.apiKey); setTheme(stored.uiTheme ?? 'original'); setReady(true);
    }).catch((err) => setMessage(err.message));
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes.uiTheme) setTheme(changes.uiTheme.newValue ?? 'original');
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);
  const chooseTheme = async (id: string) => {
    try {
      await chrome.storage.local.set({ uiTheme: id });
      applyTheme(id); setTheme(id); setMessage('UI colors saved.');
    } catch (err: any) { setMessage(`Error: ${err.message}`); }
  };
  const saveKey = async () => {
    try { await setSettings({ apiKey: apiKey.trim() }); setMessage('API key saved.'); }
    catch (err: any) { setMessage(`Error: ${err.message}`); }
  };
  return <div className="space-y-6">
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-text-primary">API Key</h2>
      <label className="block text-xs text-text-secondary">CSFloat API key
        <input type="password" autoComplete="off" disabled={!ready} value={apiKey} onChange={(event) => setApiKey(event.target.value)}
          className="mt-2 w-full p-2 rounded-md bg-bg-card border border-ui-border/15 text-text-primary" placeholder="Enter your API key" />
      </label>
      <div className="flex gap-2">
        <button disabled={!ready} onClick={saveKey} className="rounded-md px-3 py-2 bg-accent-blue text-on-accent text-xs font-semibold disabled:opacity-50">Save API Key</button>
        <a href="https://csfloat.com/profile" target="_blank" rel="noreferrer" className="px-2 py-2 text-xs text-accent-blue">Open CSFloat</a>
      </div>
    </section>
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-text-primary">UI Colors</h2>
      <p className="text-xs text-text-muted">Choose a palette. Colors apply and save immediately.</p>
      <fieldset disabled={!ready} className="grid grid-cols-4 gap-x-2 gap-y-4 pt-2">
        <legend className="sr-only">UI color palette</legend>
        {THEMES.map((palette) => <label key={palette.id} className="relative flex min-w-0 cursor-pointer flex-col items-center gap-2 py-1 text-center">
          <input type="radio" name="ui-theme" value={palette.id} checked={theme === palette.id}
            onChange={() => void chooseTheme(palette.id)} className="peer sr-only" />
          <span aria-hidden="true"
            className="relative h-10 w-10 rounded-full border border-ui-border/20 peer-checked:ring-2 peer-checked:ring-accent-blue peer-checked:ring-offset-2 peer-checked:ring-offset-bg-primary peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-accent-blue peer-disabled:opacity-50"
            style={{ background: `linear-gradient(135deg, ${palette.bg} 0% 50%, ${palette.accent} 50% 100%)` }}>
            {theme === palette.id && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent-blue text-[10px] text-on-accent">✓</span>}
          </span>
          <span className="text-[11px] leading-snug text-text-muted peer-checked:font-semibold peer-checked:text-text-primary">{palette.name}</span>
        </label>)}
      </fieldset>
    </section>
    {message && <p role="status" className="text-xs text-text-secondary">{message}</p>}
  </div>;
}
