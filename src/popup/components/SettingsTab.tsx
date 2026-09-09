import { useState, useEffect, useCallback } from 'react';
import { ExternalLink, Save, TestTube, Play, Pause, Database } from 'lucide-react';
import type { Settings, SensitivityLevel } from '../../types';
import { getSettings, setSettings, saveTestDeals } from '../../services/storage';
import { listingToDeal, MOCK_BUY_NOW_LISTINGS } from '../../services/testData';

const SENSITIVITY_MAP: Record<SensitivityLevel, { label: string; stickerRatio: number; desc: string }> = {
  strict: { label: 'Strict', stickerRatio: 0.70, desc: 'Fewer deals, higher quality — stickers worth ≥70% of price' },
  balanced: { label: 'Balanced', stickerRatio: 0.50, desc: 'Flags stickers worth ≥50% of the listing price' },
  loose: { label: 'Loose', stickerRatio: 0.30, desc: 'More deals, more noise — stickers worth ≥30% of price' },
};

export default function SettingsTab() {
  const [settings, setLocalSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    getSettings().then(setLocalSettings);
  }, []);

  const updateField = useCallback((field: keyof Settings, value: any) => {
    setLocalSettings((prev) => (prev ? { ...prev, [field]: value } : null));
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const sens = SENSITIVITY_MAP[settings.sensitivity || 'balanced'];
    const newSettings: Partial<Settings> = {
      ...settings,
      stickerRatioThreshold: sens.stickerRatio,
      pollIntervalMinutes: Math.max(1, Math.min(60, settings.pollIntervalMinutes)),
      maxListingsPerPoll: Math.max(1, Math.min(50, settings.maxListingsPerPoll)),
      minFloat: Math.max(0, Math.min(1, settings.minFloat)),
      maxFloat: Math.max(0, Math.min(1, settings.maxFloat)),
    };
    await setSettings(newSettings);
    setSaving(false);
    setTestResult('Settings saved!');
    setTimeout(() => setTestResult(null), 2000);
  };

  const toggleEnabled = async () => {
    if (!settings) return;
    const next = { ...settings, enabled: !settings.enabled };
    setLocalSettings(next);
    await setSettings({ enabled: next.enabled });
    if (next.enabled) {
      try { await chrome.runtime.sendMessage({ action: 'poll-now' }); } catch (e) {}
    }
  };

  // Consolidated test: goes through the background worker (canonical API
  // path), takes the first 5 buy_now listings, saves them as deal cards,
  // and falls back to mock data if the live call fails.
  const handleTestApi = async () => {
    console.log('[Floatr] handleTestApi clicked');
    if (!settings) {
      console.log('[Floatr] settings is null, aborting');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      let listings: any[] = [];
      let source = 'api';

      try {
        console.log('[Floatr] Requesting preview-listings from background...');
        const response = await chrome.runtime.sendMessage({ action: 'preview-listings', limit: 5 });
        if (!response.ok) {
          throw new Error(response.error || 'API call failed');
        }
        listings = (response.listings || []).slice(0, 5);
        console.log('[Floatr] Got', listings.length, 'listings from API');
      } catch (apiErr: any) {
        console.log('[Floatr] API call failed:', apiErr.message);
        listings = MOCK_BUY_NOW_LISTINGS.slice(0, 5);
        source = 'mock';
        console.log('[Floatr] Fallback to mock data:', listings.length, 'listings');
      }

      if (listings.length === 0) {
        setTestResult('No buy_now listings returned from CSFloat API.');
        setTesting(false);
        return;
      }

      console.log('[Floatr] Converting listings to deals...');
      const deals = listings.map(listingToDeal);
      console.log('[Floatr] Saving', deals.length, 'deals...');
      await saveTestDeals(deals);
      console.log('[Floatr] Deals saved successfully');

      const sourceLabel = source === 'mock' ? ' (mock fallback)' : '';
      setTestResult(`Loaded ${deals.length} buy_now listing${deals.length !== 1 ? 's' : ''}${sourceLabel}. Switch to Deals tab to view.`);
    } catch (err: any) {
      console.error('[Floatr] Unexpected error in handleTestApi:', err);
      setTestResult(`Error: ${err.message}`);
    }
    setTesting(false);
  };

  const handleLoadMockOnly = async () => {
    console.log('[Floatr] handleLoadMockOnly clicked');
    setTesting(true);
    setTestResult(null);
    try {
      const listings = MOCK_BUY_NOW_LISTINGS.slice(0, 5);
      const deals = listings.map(listingToDeal);
      await saveTestDeals(deals);
      setTestResult(`Loaded ${deals.length} mock deal cards. Switch to Deals tab to view.`);
    } catch (err: any) {
      console.error('[Floatr] Mock load error:', err);
      setTestResult(`Error: ${err.message}`);
    }
    setTesting(false);
  };

  if (!settings) {
    return <div className="p-8 text-center text-text-muted text-sm">Loading settings…</div>;
  }

  const sensitivity = (settings.sensitivity || 'balanced') as SensitivityLevel;

  return (
    <div className="space-y-4 animate-[fadeIn_0.25s_ease]">
      {/* Polling Control */}
      <Section title="Polling Control">
        <button
          onClick={toggleEnabled}
          className={`w-full py-2.5 rounded-md text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2 ${
            settings.enabled
              ? 'bg-gradient-to-r from-red-600 to-accent-red shadow-red-500/25 hover:shadow-red-500/40'
              : 'bg-gradient-to-r from-green-600 to-accent-green shadow-green-500/25 hover:shadow-green-500/40'
          }`}
        >
          {settings.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {settings.enabled ? 'Stop Scanning' : 'Start Scanning'}
        </button>
        <p className="text-[11px] text-text-muted mt-1.5">
          {settings.enabled
            ? `Active — checking for deals every ${settings.pollIntervalMinutes} minutes`
            : 'Paused — click to start finding deals'}
        </p>
      </Section>

      {/* Polling Config */}
      <Section title="Polling Configuration">
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Interval (minutes)"
            value={settings.pollIntervalMinutes}
            onChange={(v) => updateField('pollIntervalMinutes', v)}
            min={1}
            max={60}
          />
          <NumberField
            label="Max listings per poll"
            value={settings.maxListingsPerPoll}
            onChange={(v) => updateField('maxListingsPerPoll', v)}
            min={1}
            max={50}
          />
        </div>
        <p className="text-[10px] text-text-muted mt-1">30 is safe without an API key. 50 with a key.</p>
      </Section>

      {/* Watchlist */}
      <Section title="Watchlist">
        <label className="block text-xs font-semibold text-text-secondary mb-1">Items to watch (one per line)</label>
        <textarea
          value={Array.isArray(settings.watchlist) ? settings.watchlist.join('\n') : ''}
          onChange={(e) =>
            updateField(
              'watchlist',
              e.target.value.split('\n').map((s) => s.trim()).filter(Boolean)
            )
          }
          placeholder="AK-47 | Redline (Field-Tested)"
          className="w-full min-h-[60px] px-2.5 py-2 bg-bg-card border border-white/[0.06] rounded-md text-text-primary text-xs placeholder:text-text-muted focus:outline-none focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20 transition-all resize-y"
        />
        <p className="text-[10px] text-text-muted mt-1">Empty = scan all recent listings (firehose mode)</p>
      </Section>

      {/* API Key */}
      <Section title="API Key">
        <label className="block text-xs font-semibold text-text-secondary mb-1">
          CSFloat API Key <span className="text-text-muted font-normal">(optional)</span>
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={settings.apiKey}
            onChange={(e) => updateField('apiKey', e.target.value)}
            placeholder="cf_..."
            className="flex-1 px-2.5 py-2 bg-bg-card border border-white/[0.06] rounded-md text-text-primary text-xs placeholder:text-text-muted focus:outline-none focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20 transition-all"
          />
          <button
            onClick={() => chrome.tabs.create({ url: 'https://csfloat.com/profile' })}
            className="px-3 py-2 bg-gradient-to-br from-blue-600 to-accent-blue text-white rounded-md text-xs font-semibold shadow-lg shadow-accent-blue/25 hover:shadow-accent-blue/40 hover:-translate-y-0.5 transition-all flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" /> Open CSFloat
          </button>
        </div>
        <p className="text-[10px] text-text-muted mt-1">Without a key, polling works but is more rate-limited.</p>
      </Section>

      {/* Float Range */}
      <Section title="Float Range">
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Min Float"
            value={settings.minFloat}
            onChange={(v) => updateField('minFloat', v)}
            min={0}
            max={1}
            step={0.001}
          />
          <NumberField
            label="Max Float"
            value={settings.maxFloat}
            onChange={(v) => updateField('maxFloat', v)}
            min={0}
            max={1}
            step={0.001}
          />
        </div>
        <p className="text-[10px] text-text-muted mt-1">
          Only flags skins with float in this range. Default 0.00–0.15 catches FN/MW and good FT.
        </p>
      </Section>

      {/* Sensitivity */}
      <Section title="Deal Sensitivity">
        <div className="flex gap-1.5">
          {(Object.keys(SENSITIVITY_MAP) as SensitivityLevel[]).map((level) => (
            <button
              key={level}
              onClick={() => updateField('sensitivity', level)}
              className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all ${
                sensitivity === level
                  ? 'bg-accent-blue text-white shadow-lg shadow-accent-blue/25'
                  : 'bg-bg-card text-text-muted border border-white/[0.06] hover:text-text-secondary hover:border-white/[0.1]'
              }`}
            >
              {SENSITIVITY_MAP[level].label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-text-muted mt-2 leading-relaxed">
          <strong className="text-text-secondary">{SENSITIVITY_MAP[sensitivity].label}:</strong>{' '}
          {SENSITIVITY_MAP[sensitivity].desc}
        </p>
      </Section>

      {/* Actions */}
      <div className="space-y-2 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-accent-blue text-white rounded-md text-sm font-bold shadow-lg shadow-accent-blue/25 hover:shadow-accent-blue/40 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saved!' : 'Save Settings'}
        </button>

        <button
          onClick={handleTestApi}
          disabled={testing}
          className="w-full py-2 border border-accent-blue/30 text-accent-blue rounded-md text-xs font-semibold hover:bg-accent-blue hover:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <TestTube className="w-3.5 h-3.5" />
          {testing ? 'Testing…' : 'Test API (Buy Now, First 5)'}
        </button>

        <button
          onClick={handleLoadMockOnly}
          disabled={testing}
          className="w-full py-2 border border-white/[0.06] text-text-muted rounded-md text-xs font-semibold hover:text-text-secondary hover:border-white/10 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Database className="w-3.5 h-3.5" />
          {testing ? 'Loading…' : 'Load Mock Data Only'}
        </button>

        {testResult && (
          <div className={`text-xs text-center py-1.5 rounded-md ${testResult.startsWith('Error') ? 'text-accent-red bg-accent-red/10' : 'text-accent-green bg-accent-green/10'}`}>
            {testResult}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2.5 flex items-center gap-2">
        {title}
        <span className="flex-1 h-px bg-gradient-to-r from-white/[0.06] to-transparent" />
      </h3>
      {children}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-text-secondary mb-1">{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full px-2.5 py-2 bg-bg-card border border-white/[0.06] rounded-md text-text-primary text-xs focus:outline-none focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20 transition-all"
      />
    </div>
  );
}
