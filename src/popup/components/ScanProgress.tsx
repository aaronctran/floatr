import { useChromeStorage } from '../../hooks/useChromeStorage';
import type { ScanStatus } from '../../types';

export default function ScanProgress() {
  const [scan] = useChromeStorage<ScanStatus>('scanStatus', { running: false });
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
