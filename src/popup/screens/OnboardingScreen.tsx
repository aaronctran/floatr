import { useState } from 'react';
import { Target, ExternalLink, ArrowRight } from 'lucide-react';
import { setSettings } from '../../services/storage';

interface Props {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    if (apiKey.trim()) {
      await setSettings({ apiKey: apiKey.trim() });
    }
    await chrome.storage.local.set({ onboarded: true });
    setSaving(false);
    onComplete();
  };

  return (
    <div className="w-[420px] min-h-[540px] bg-bg-primary p-6 flex flex-col animate-[fadeIn_0.3s_ease]">
      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-500 to-amber-500 flex items-center justify-center mb-4 shadow-lg shadow-pink-500/20 mx-auto">
        <Target className="w-7 h-7 text-white" />
      </div>
      <h2 className="text-lg font-bold text-text-primary mb-1 text-center">
        Welcome to Floatr
      </h2>
      <p className="text-xs text-text-muted mb-3 text-center leading-relaxed">
        Scans CSFloat listings and alerts you when skins are underpriced.
      </p>
      <p className="text-[11px] text-text-muted mb-4 text-center leading-relaxed">
        <strong className="text-text-secondary">Optional:</strong> Add your CSFloat API key for faster polling.
        Without it, the extension works fine but polls more gently.
      </p>

      <div className="bg-bg-card border border-white/[0.06] rounded-xl p-3.5 mb-4 text-[11px] text-text-muted leading-relaxed">
        <strong className="text-text-primary text-xs">How to get your API key:</strong>
        <ol className="list-decimal ml-4 mt-1.5 space-y-0.5">
          <li>
            Go to{' '}
            <a
              href="https://csfloat.com/profile"
              target="_blank"
              rel="noreferrer"
              className="text-accent-blue font-medium inline-flex items-center gap-0.5"
            >
              csfloat.com/profile <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </li>
          <li>
            Click the <strong className="text-text-primary">Developers</strong> tab
          </li>
          <li>
            Click <strong className="text-text-primary">New Key</strong>
          </li>
          <li>
            Copy the key (starts with <code className="bg-white/[0.06] px-1 rounded text-[10px]">cf_</code>) and paste it below
          </li>
        </ol>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Paste your cf_... API key here"
          className="flex-1 px-3 py-2 bg-bg-card border border-white/[0.06] rounded-md text-text-primary text-xs placeholder:text-text-muted focus:outline-none focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20 transition-all"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-gradient-to-br from-blue-600 to-accent-blue text-white rounded-md text-xs font-semibold shadow-lg shadow-accent-blue/25 hover:shadow-accent-blue/40 hover:-translate-y-0.5 transition-all disabled:opacity-50"
        >
          Save
        </button>
      </div>

      <button
        onClick={handleSave}
        className="mx-auto px-4 py-2 text-xs text-text-muted hover:text-text-secondary hover:bg-white/[0.03] rounded-md transition-all flex items-center gap-1"
      >
        Skip for now <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
}
