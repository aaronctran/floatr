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
      <div role="group" aria-label="UI color palette" className="grid grid-cols-2 gap-2">
        {THEMES.map((palette) => <button key={palette.id} type="button" disabled={!ready} aria-pressed={theme === palette.id}
          onClick={() => void chooseTheme(palette.id)}
          className={`rounded-lg border p-3 text-left text-xs ${theme === palette.id ? 'border-accent-blue ring-1 ring-accent-blue' : 'border-ui-border/15'}`}
          style={{ background: palette.bg, color: palette.text }}>
          <span className="mb-2 flex gap-1.5" aria-hidden="true">{[palette.card, palette.muted, palette.accent].map((color) => <span key={color} className="h-4 w-4 rounded-full" style={{ background: color }} />)}</span>
          <span>{palette.name}{theme === palette.id ? ' ✓' : ''}</span>
        </button>)}
      </div>
    </section>
    {message && <p role="status" className="text-xs text-text-secondary">{message}</p>}
  </div>;
}
