import { useState, useEffect, useCallback } from 'react';
import { ExternalLink, Save, Play, Pause } from 'lucide-react';
import type { Settings, SensitivityLevel } from '../types';
import { getSettings, setSettings } from '../services/storage';

const SENSITIVITY_MAP: Record<SensitivityLevel, { label: string; stickerRatio: number; desc: string }> = {
  strict: { label: 'Strict', stickerRatio: 0.70, desc: 'Fewer deals, higher quality (discount ≥30%, stickers ≥70%)' },
  balanced: { label: 'Balanced', stickerRatio: 0.50, desc: 'Catches deals ≥20% below reference, stickers worth ≥50% of price, and top 10% rare floats.' },
  loose: { label: 'Loose', stickerRatio: 0.30, desc: 'More deals, more noise (discount ≥10%, stickers ≥30%)' },
};

export default function OptionsApp() {
  const [settings, setLocalSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings().then(setLocalSettings);
  }, []);

  const updateField = useCallback((field: keyof Settings, value: any) => {
    setLocalSettings((prev) => (prev ? { ...prev, [field]: value } : null));
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const sens = SENSITIVITY_MAP[(settings.sensitivity || 'balanced') as SensitivityLevel];
    await setSettings({
      ...settings,
      stickerRatioThreshold: sens.stickerRatio,
      pollIntervalMinutes: Math.max(1, Math.min(60, settings.pollIntervalMinutes)),
      maxListingsPerPoll: Math.max(1, Math.min(50, settings.maxListingsPerPoll)),
    });
    setSaving(false);
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

  if (!settings) {
    return <div className="p-8 text-center text-text-muted">Loading…</div>;
  }

  const sensitivity = (settings.sensitivity || 'balanced') as SensitivityLevel;

  return (
    <div className="min-h-screen bg-bg-primary py-10 px-4">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-extrabold bg-gradient-to-r from-accent-blue to-purple-500 bg-clip-text text-transparent tracking-tight">
            Floatr Settings
          </h1>
          <p className="text-[13px] text-text-muted mt-1">Configure how Floatr scans CSFloat for deals</p>
        </div>

        <div className="space-y-4">
          {/* Polling Control */}
          <Card title="Polling Control">
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
          </Card>

          {/* Polling Config */}
          <Card title="Polling Configuration">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Interval (minutes)</label>
                <input
                  type="number"
                  value={settings.pollIntervalMinutes}
                  min={1}
                  max={60}
                  onChange={(e) => updateField('pollIntervalMinutes', parseInt(e.target.value) || 3)}
                  className="w-full px-3 py-2 bg-bg-card border border-white/[0.06] rounded-md text-text-primary text-sm focus:outline-none focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Max listings per poll</label>
                <input
                  type="number"
                  value={settings.maxListingsPerPoll}
                  min={1}
                  max={50}
                  onChange={(e) => updateField('maxListingsPerPoll', parseInt(e.target.value) || 30)}
                  className="w-full px-3 py-2 bg-bg-card border border-white/[0.06] rounded-md text-text-primary text-sm focus:outline-none focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20 transition-all"
                />
              </div>
            </div>
            <p className="text-[10px] text-text-muted mt-1.5">30 is safe without an API key. 50 with a key.</p>
          </Card>

          {/* Watchlist */}
          <Card title="Watchlist">
            <label className="block text-xs font-semibold text-text-secondary mb-1">Items to watch (one per line)</label>
            <textarea
              value={Array.isArray(settings.watchlist) ? settings.watchlist.join('\n') : ''}
              onChange={(e) => updateField('watchlist', e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))}
              placeholder="AK-47 | Redline (Field-Tested)"
              className="w-full min-h-[60px] px-3 py-2 bg-bg-card border border-white/[0.06] rounded-md text-text-primary text-sm focus:outline-none focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20 transition-all resize-y"
            />
            <p className="text-[10px] text-text-muted mt-1">Empty = scan all recent listings (firehose mode)</p>
          </Card>

          {/* API Key */}
          <Card title="API Key">
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              CSFloat API Key <span className="text-text-muted font-normal">(optional)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.apiKey}
                onChange={(e) => updateField('apiKey', e.target.value)}
                placeholder="cf_..."
                className="flex-1 px-3 py-2 bg-bg-card border border-white/[0.06] rounded-md text-text-primary text-sm focus:outline-none focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20 transition-all"
              />
              <button
                onClick={() => chrome.tabs.create({ url: 'https://csfloat.com/profile' })}
                className="px-4 py-2 bg-gradient-to-br from-blue-600 to-accent-blue text-white rounded-md text-xs font-semibold shadow-lg shadow-accent-blue/25 hover:shadow-accent-blue/40 hover:-translate-y-0.5 transition-all flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" /> Open CSFloat
              </button>
            </div>
            <p className="text-[10px] text-text-muted mt-1.5">Without a key, polling works but is more rate-limited.</p>
          </Card>

          {/* Deal Sensitivity */}
          <Card title="Deal Sensitivity">
            <div className="flex gap-2">
              {(Object.keys(SENSITIVITY_MAP) as SensitivityLevel[]).map((level) => (
                <button
                  key={level}
                  onClick={() => updateField('sensitivity', level)}
                  className={`flex-1 py-2.5 rounded-md text-sm font-semibold transition-all ${
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
          </Card>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-accent-blue text-white rounded-md text-sm font-bold shadow-lg shadow-accent-blue/25 hover:shadow-accent-blue/40 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saved!' : 'Save Settings'}
          </button>
        </div>

        <p className="text-center text-xs text-text-muted mt-6">
          Floatr v0.1.0 —{' '}
          <a href="https://csfloat.com" target="_blank" rel="noreferrer" className="text-accent-blue hover:underline">
            csfloat.com
          </a>
        </p>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-bg-card border border-white/[0.06] rounded-xl p-5">
      <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
        {title}
        <span className="flex-1 h-px bg-gradient-to-r from-white/[0.06] to-transparent" />
      </h3>
      {children}
    </div>
  );
}
