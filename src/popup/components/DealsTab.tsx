import { useState, useEffect, useCallback } from 'react';
import { Inbox, AlertCircle, Undo2 } from 'lucide-react';
import type { Deal } from '../../types';
import SkinDealGroup from './SkinDealGroup';
import { getSettings } from '../../services/storage';
import ScanProgress from './ScanProgress';
import { groupDealsBySkin } from '../../services/dealGroups';
import SectionHelp from './SectionHelp';

export default function DealsTab() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissedCount, setDismissedCount] = useState(0);

  const loadDeals = useCallback(async () => {
    try {
      await getSettings(); // Wait for pending watchlist autosaves before messaging the worker.
      const response = await chrome.runtime.sendMessage({ action: 'get-deals' });
      if (response.error) throw new Error(response.error);
      setDeals(response.deals || []);
      setDismissedCount(response.dismissedCount ?? 0);
    } catch (e) {
      console.error('[Floatr] Failed to load deals:', e);
      setDeals([]);
    }
  }, []);

  useEffect(() => {
    loadDeals();

    // Auto-refresh when scans or settings change
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      const scanCompleted = changes.scanStatus?.newValue?.lastCompletedAt !== changes.scanStatus?.oldValue?.lastCompletedAt;
      if (changes.dealLog || changes.settings || changes.dismissedDeals || scanCompleted) {
        loadDeals();
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [loadDeals]);

  const dismiss = async (target: { id?: string; reset?: boolean }) => {
    try {
      const response = await chrome.runtime.sendMessage({ action: target.reset ? 'restore-dismissed-deals' : 'dismiss-deal', ...target });
      if (!response.ok) throw new Error(response.error || 'Could not hide deal');
      await loadDeals();
    } catch (err: any) { setError(err.message); }
  };

  const handlePollNow = async () => {
    setLoading(true);
    setError(null);
    try {
      await getSettings();
      const res = await chrome.runtime.sendMessage({ action: 'poll-now' });
      if (!res.ok) throw new Error(res.error || 'Scan failed');
      console.log('[Floatr] Manual poll:', res);
      await loadDeals();
    } catch (e: any) {
      console.error('[Floatr] Manual poll failed:', e);
      setError(e.message || 'Scan failed');
    }
    setLoading(false);
  };

  const handleClearDeals = async () => {
    try {
      await chrome.runtime.sendMessage({ action: 'clear-deals' });
      setDeals([]);
    } catch (e) {
      console.error('[Floatr] Failed to clear deals:', e);
    }
  };

  const groups = groupDealsBySkin(deals);
  const dealCount = groups.reduce((count, group) => count + group.deals.length, 0);

  return (
    <div className="animate-[fadeIn_0.25s_ease]">
      <ScanProgress onScan={handlePollNow} loading={loading} />
      {/* Actions */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-text-primary">{dealCount} deals</span>
          <span className="text-[11px] text-text-muted">· {groups.length} skins</span>
          <SectionHelp label="deals">
            Adjust your search and sticker preferences in Filters. Best deals appear first: qualifying matches, sticker value-to-price ratio, then lowest price. Select a skin to expand. Hidden deals stay hidden until the browser session ends.
          </SectionHelp>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {dismissedCount > 0 && <button onClick={() => void dismiss({ reset: true })} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-accent-blue hover:bg-accent-blue/10"><Undo2 className="h-3 w-3" aria-hidden="true" />Restore ({dismissedCount})</button>}
          {deals.length > 0 && (
            <button
              onClick={handleClearDeals}
              className="px-2.5 py-1 text-[11px] text-text-muted hover:text-accent-red border border-ui-border/[0.06] hover:border-accent-red/30 rounded-md transition-all"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-3 p-2.5 bg-accent-red/10 border border-accent-red/20 rounded-md flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-accent-red flex-shrink-0 mt-0.5" />
          <div className="text-[11px] text-accent-red leading-relaxed">{error}</div>
        </div>
      )}

      {/* Deal List */}
      {dealCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-text-muted">
          <Inbox className="w-8 h-8 mb-2 opacity-60" />
          <p className="text-sm">No deals found yet.</p>
          <p className="text-[11px] mt-1">Start scanning in Filters to find matching deals.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {groups.map((group) => (
            <SkinDealGroup key={group.name} name={group.name} deals={group.deals} onDismiss={dismiss} />
          ))}
        </div>
      )}
    </div>
  );
}
