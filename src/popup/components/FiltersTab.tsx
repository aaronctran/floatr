import { useState, useEffect, useCallback } from 'react';
import { Save, Play, Pause } from 'lucide-react';
import type { Settings, SensitivityLevel } from '../../types';
import { getSettings, setSettings } from '../../services/storage';
import { normalizeWatchlist } from '../../services/watchlist';
import ScanProgress from './ScanProgress';
import WatchlistInput from './WatchlistInput';
import FloatRangeInput from './FloatRangeInput';
import StickerFilter from './StickerFilter';
import SectionHelp from './SectionHelp';
import { useScanningState } from '../../hooks/useScanningState';

const SENSITIVITY_MAP: Record<SensitivityLevel, { label: string; stickerRatio: number; desc: string }> = {
  strict: { label: 'Strict', stickerRatio: 0.70, desc: 'Fewer deals, higher quality — stickers worth ≥70% of price' },
  balanced: { label: 'Balanced', stickerRatio: 0.50, desc: 'Flags stickers worth ≥50% of the listing price' },
  loose: { label: 'Loose', stickerRatio: 0.30, desc: 'More deals, more noise — stickers worth ≥30% of price' },
};

export default function FiltersTab() {
  const [settings, setLocalSettings] = useState<Settings | null>(null);
  useScanningState(setLocalSettings);
  const [watchlistDraft, setWatchlistDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    getSettings().then((s) => {
      setLocalSettings(s);
      setWatchlistDraft(Array.isArray(s.watchlist) ? s.watchlist.join('\n') : '');
    });
  }, []);

  // Parse raw textarea text into normalized market_hash_name entries.
  // Fuzzy: "ak redline ft" → "AK-47 | Redline (Field-Tested)".
  // Unrecognized lines pass through unchanged.
  const parseWatchlist = (text: string) =>
    normalizeWatchlist(text.split('\n').map((s) => s.trim()).filter(Boolean)).map((r) => r.normalized);

  // Lines the fuzzy matcher rewrote, for the "Auto-corrected" preview.
  const watchCorrections =
    watchlistDraft === null
      ? []
      : normalizeWatchlist(watchlistDraft.split('\n').map((s) => s.trim()).filter(Boolean))
          .filter((r) => r.original !== r.normalized);

  // Save raw text so spaces and blank lines survive typing and remounts.
  const changeWatchlist = (text: string) => {
    setWatchlistDraft(text);
    const watchlist = text.split('\n');
    updateField('watchlist', watchlist);
    void setSettings({ watchlist }).catch((err) => setStatusMessage(`Error: ${err.message}`));
  };

  const updateField = useCallback((field: keyof Settings, value: any) => {
    setLocalSettings((prev) => (prev ? { ...prev, [field]: value } : null));
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const sens = SENSITIVITY_MAP[settings.sensitivity || 'balanced'];
    const { enabled: _enabled, apiKey: _apiKey, ...editableSettings } = settings;
    const newSettings: Partial<Settings> = {
      ...editableSettings,
      watchlist: parseWatchlist(watchlistDraft ?? ''),
      stickerRatioThreshold: sens.stickerRatio,
      pollIntervalMinutes: Math.max(1, Math.min(60, settings.pollIntervalMinutes)),
      maxListingsPerPoll: Math.max(1, Math.min(50, settings.maxListingsPerPoll)),
      minFloat: Math.max(0, Math.min(1, settings.minFloat)),
      maxFloat: Math.max(0, Math.min(1, settings.maxFloat)),
    };
    try {
      await setSettings(newSettings);
      setStatusMessage('Settings saved!');
      setTimeout(() => setStatusMessage(null), 2000);
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const { apiKey: _apiKey, ...filterSettings } = settings;
      const next = await setSettings({
        ...filterSettings,
        watchlist: (watchlistDraft ?? '').split('\n'),
        enabled: !settings.enabled,
        stickerRatioThreshold: SENSITIVITY_MAP[settings.sensitivity || 'balanced'].stickerRatio,
      });
      setLocalSettings(next);
      if (next.enabled) {
        const response = await chrome.runtime.sendMessage({ action: 'poll-now' });
        if (!response.ok) throw new Error(response.error || 'Scan failed');
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return <div className="p-8 text-center text-text-muted text-sm">Loading settings…</div>;
  }

  const sensitivity = (settings.sensitivity || 'balanced') as SensitivityLevel;

  return (
    <div className="space-y-4 animate-[fadeIn_0.25s_ease]">
      {/* Polling Control */}
      <Section title="Polling Control" help="Start or stop scanning for deals. Requests are paced two seconds apart. A rate limit stops scanning; restart after the cooldown. Starting scanning also applies your current filter settings.">
        <ScanProgress />
        <button
          onClick={toggleEnabled}
          disabled={saving}
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
            ? `Active · every ${settings.pollIntervalMinutes} min`
            : 'Scanning paused'}
        </p>
      </Section>

      {/* Polling Config */}
      <Section title="Polling Configuration" help="Choose how often to scan and how many listings to review per poll. Presets change the interval only. Suggested batch: 30 without an API key; up to 50 with a key. Use Customize for exact values, then Save Filters to apply.">
        <div role="group" aria-label="Scan interval presets" className="grid grid-cols-3 gap-2">
          {([{ label: 'Frequent', minutes: 1 }, { label: 'Standard', minutes: 3 }, { label: 'Relaxed', minutes: 10 }] as const).map((preset) => (
            <button key={preset.minutes} type="button" aria-pressed={settings.pollIntervalMinutes === preset.minutes}
              onClick={() => updateField('pollIntervalMinutes', preset.minutes)}
              className={`rounded-md border px-2 py-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary ${settings.pollIntervalMinutes === preset.minutes
                ? 'bg-accent-blue text-on-accent border-accent-blue'
                : 'bg-bg-card text-text-secondary border-ui-border/10 hover:border-accent-blue/40 hover:bg-accent-blue/5'}`}>
              {preset.label}
              <span className="block mt-1 text-[11px] font-normal">Every {preset.minutes} min</span>
            </button>
          ))}
        </div>
        <details className="mt-3">
          <summary className="text-xs text-accent-blue cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue rounded-sm">Customize interval and batch size</summary>
          <div className="grid grid-cols-2 gap-2 mt-3">
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
        </details>
        <div className="mt-3 rounded-md border border-ui-border/10 bg-bg-card p-3">
          <p className="text-xs font-medium text-text-primary" aria-live="polite">
            Every {settings.pollIntervalMinutes} {settings.pollIntervalMinutes === 1 ? 'minute' : 'minutes'} · up to {settings.maxListingsPerPoll} listings per poll
          </p>
        </div>
      </Section>

      {/* Watchlist */}
      <Section title="Watchlist" help="Enter one skin per line using a full name (Weapon | Skin (Wear)) or shorthand such as ak redline ft. Use ↑/↓ and Enter to select suggestions; Shift+Enter adds a line. Without a wear suffix, all available wears are scanned, subject to Float Range filters. Edit changes a skin; Pause excludes it until resumed. Changes save automatically. Pausing all skins stops matches; an empty watchlist scans all recent listings.">
        <p className="text-[11px] text-text-muted mb-1">Auto-saves</p>
        <label className="block text-xs font-semibold text-text-secondary mb-1">Items to watch (one per line)</label>
        <WatchlistInput
          value={watchlistDraft ?? ''}
          onChange={changeWatchlist}
        />
        {!watchlistDraft?.trim() && <p className="text-[11px] text-text-muted mt-1">Empty watchlist scans all recent listings.</p>}
        {watchCorrections.length > 0 && (
          <p className="text-[10px] text-accent-green mt-1">
            Auto-corrected: {watchCorrections.map((r) => r.normalized).join(' · ')}
          </p>
        )}
      </Section>

      <Section title="Applied Stickers" help="Choose listings with stickers, without stickers, or both. Saves automatically and applies to deals and notifications.">
        <StickerFilter value={settings.stickerFilter ?? 'all'} onChange={(value) => {
          updateField('stickerFilter', value);
          void setSettings({ stickerFilter: value }).catch((err) => setStatusMessage(err.message));
        }} />
        <p className="text-[11px] text-text-muted mt-1">Auto-saves</p>
      </Section>
      {/* Float Range */}
      <Section title="Float Range" help="Wear buttons apply across the watchlist. Select multiple wear conditions; unselected wears stay excluded. Drag the upper handle for minimum float and the lower handle for maximum, or enter exact bounds. Save Filters to apply.">
        <FloatRangeInput min={settings.minFloat} max={settings.maxFloat} selectedWears={settings.selectedWears}
          onChange={(range) => setLocalSettings((current) => current ? { ...current, ...range } : current)} />
      </Section>

      {/* Sensitivity */}
      <Section title="Deal Sensitivity" help="Sensitivity compares sticker value with the listing price. Strict requires at least 70%, Balanced 50%, and Loose 30%. Strict flags fewer deals; Loose may include more noise. Save Filters to apply.">
        <div className="flex gap-1.5">
          {(Object.keys(SENSITIVITY_MAP) as SensitivityLevel[]).map((level) => (
            <button
              key={level}
              onClick={() => updateField('sensitivity', level)}
              className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all ${
                sensitivity === level
                  ? 'bg-accent-blue text-on-accent shadow-lg shadow-accent-blue/10'
                  : 'bg-bg-card text-text-muted border border-ui-border/[0.06] hover:text-text-secondary hover:border-ui-border/[0.1]'
              }`}
            >
              {SENSITIVITY_MAP[level].label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-text-muted mt-2 leading-relaxed">
          Stickers ≥{Math.round(SENSITIVITY_MAP[sensitivity].stickerRatio * 100)}% of listing price
        </p>
      </Section>

      {/* Actions */}
      <div className="space-y-2 pt-2">
        <p className="text-[11px] text-text-muted">Save polling, float, and sensitivity settings.</p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2.5 bg-gradient-to-r from-accent-blue to-accent-blue text-on-accent rounded-md text-sm font-bold shadow-lg shadow-accent-blue/10 hover:shadow-accent-blue/40 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving…' : 'Save Filters'}
        </button>

        {statusMessage && (
          <div className={`text-xs text-center py-1.5 rounded-md ${statusMessage.startsWith('Error') ? 'text-accent-red bg-accent-red/10' : 'text-accent-green bg-accent-green/10'}`}>
            {statusMessage}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, help, children }: { title: string; help?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2">
        <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{title}</h3>
        <span className="flex-1 h-px bg-gradient-to-r from-ui-border/[0.06] to-transparent" />
        {help && <SectionHelp label={title}>{help}</SectionHelp>}
      </div>
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
        className="w-full px-2.5 py-2 bg-bg-card border border-ui-border/[0.06] rounded-md text-text-primary text-xs focus:outline-none focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20 transition-all"
      />
    </div>
  );
}
