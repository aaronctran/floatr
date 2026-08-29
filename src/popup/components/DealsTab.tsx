import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Inbox } from 'lucide-react';
import type { Deal } from '../../types';
import DealCard from '../components/DealCard';

export default function DealsTab() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);

  const loadDeals = useCallback(async () => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'get-deals' });
      setDeals(response.deals || []);
    } catch (e) {
      console.error('[Floatr] Failed to load deals:', e);
      setDeals([]);
    }
  }, []);

  useEffect(() => {
    loadDeals();

    // Auto-refresh when deals are updated from other tabs / test buttons
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes.dealLog) {
        loadDeals();
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [loadDeals]);

  const handlePollNow = async () => {
    setLoading(true);
    try {
      const res = await chrome.runtime.sendMessage({ action: 'poll-now' });
      console.log('[Floatr] Manual poll:', res);
      await loadDeals();
    } catch (e) {
      console.error('[Floatr] Manual poll failed:', e);
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

  return (
    <div className="animate-[fadeIn_0.25s_ease]">
      {/* Actions */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-text-muted">
          {deals.length > 0 ? `${deals.length} deal${deals.length !== 1 ? 's' : ''}` : 'No deals yet'}
        </span>
        <div className="flex gap-1.5">
          {deals.length > 0 && (
            <button
              onClick={handleClearDeals}
              className="px-2.5 py-1 text-[11px] text-text-muted hover:text-accent-red border border-white/[0.06] hover:border-accent-red/30 rounded-md transition-all"
            >
              Clear
            </button>
          )}
          <button
            onClick={handlePollNow}
            disabled={loading}
            className="px-2.5 py-1 text-[11px] text-accent-blue hover:text-white border border-accent-blue/30 hover:bg-accent-blue rounded-md transition-all flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Polling…' : 'Poll Now'}
          </button>
        </div>
      </div>

      {/* Deal List */}
      {deals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-text-muted">
          <Inbox className="w-8 h-8 mb-2 opacity-60" />
          <p className="text-sm">No deals found yet.</p>
          <p className="text-[11px] mt-1">Deals appear here when the background scanner finds them.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      )}
    </div>
  );
}
