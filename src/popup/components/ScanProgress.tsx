import { useChromeStorage } from '../../hooks/useChromeStorage';
import { RefreshCw } from 'lucide-react';
import type { ScanStatus, Settings } from '../../types';

export default function ScanProgress({ onScan, loading = false }: { onScan?: () => void; loading?: boolean }) {
  const [scan] = useChromeStorage<ScanStatus>('scanStatus', { running: false });
  const [settings] = useChromeStorage<Partial<Settings>>('settings', { enabled: false });
  const busy = loading || scan.running;
  if (onScan) return (
    <section className="mb-4 rounded-xl border border-accent-blue/25 bg-gradient-to-br from-accent-blue/[0.15] to-bg-card p-3.5" aria-label="Scan overview">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-text-primary">Your latest matches</h2>
        <span className={`inline-flex items-center gap-1.5 text-[11px] ${scan.error ? 'text-accent-red' : busy || settings.enabled ? 'text-accent-green' : 'text-text-muted'}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
          {scan.error ? 'Scan failed' : busy ? 'Scanning…' : settings.enabled ? 'Watching' : 'Paused'}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="min-w-0 text-[11px] text-text-muted" aria-live="polite">
          <p>{busy ? 'Checking matching listings…' : scan.lastCompletedAt
            ? `Updated ${new Date(scan.lastCompletedAt).toLocaleTimeString()} · ${scan.listingsChecked ?? 0} checked`
            : 'Waiting for the first scan.'}</p>
          {settings.enabled && scan.nextScanAt && !busy && <p className="mt-0.5">Next scan around {new Date(scan.nextScanAt).toLocaleTimeString()}</p>}
        </div>
        <button type="button" onClick={onScan} disabled={busy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent-blue px-3 py-2 text-xs font-medium text-on-accent transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card">
          <RefreshCw aria-hidden="true" className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
          {busy ? 'Scanning…' : 'Scan now'}
        </button>
      </div>
      {scan.error && <p className="mt-2 text-[11px] text-accent-red" role="alert">Scan failed: {scan.error} Previous results retained.</p>}
    </section>
  );
  return (
    <div className="text-[11px] text-text-muted my-2" aria-live="polite">
      <p>
        {scan.running ? 'Scanning…' : scan.lastCompletedAt
          ? `Last updated ${new Date(scan.lastCompletedAt).toLocaleTimeString()} · ${scan.listingsChecked ?? 0} listings checked`
          : 'Waiting for the first scan.'}
      </p>
      {scan.nextScanAt && <p>Next scan around {new Date(scan.nextScanAt).toLocaleTimeString()}</p>}
      {scan.error && <p className="text-accent-red">Scan failed: {scan.error} Previous results retained.</p>}
    </div>
  );
}
