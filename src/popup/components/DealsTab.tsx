import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Inbox, Eye, AlertCircle } from 'lucide-react';
import type { Deal } from '../../types';
import DealCard from '../components/DealCard';

export default function DealsTab() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [previewDeals, setPreviewDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
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

  const handlePreview = async () => {
    setPreviewLoading(true);
    setError(null);
    try {
      const response = await chrome.runtime.sendMessage({ action: 'preview-listings', limit: 5 });

      if (!response.ok) {
        throw new Error(response.error || 'Failed to fetch listings');
      }

      const listings = response.listings || [];
      console.log('[Floatr] Preview fetched', listings.length, 'listings');

      if (listings.length === 0) {
        setError('No buy_now listings returned from CSFloat API.');
        setPreviewLoading(false);
        return;
      }

      const mapped: Deal[] = listings.map((l: any) => ({
        id: l.id,
        timestamp: Date.now(),
        marketHashName: l.item?.market_hash_name || 'Unknown',
        priceCents: l.price,
        priceDisplay: `$${(l.price / 100).toFixed(2)}`,
        floatValue: l.item?.float_value ?? null,
        stickers: (l.item?.stickers || []).map((s: any) => ({
          name: s?.name,
          price: s?.reference?.price ?? null,
        })),
        stickerValueCents: (l.item?.stickers || []).reduce((sum: number, s: any) => sum + (s?.reference?.price || 0), 0),
        reasons: [{ type: 'api_test' as const, detail: 'Preview from buy_now listings' }],
        item: l.item,
      }));

      setPreviewDeals(mapped);
    } catch (e: any) {
      console.error('[Floatr] Preview failed:', e);
      setError(e.message || 'Failed to fetch preview listings');
    }
    setPreviewLoading(false);
  };

  const allDeals = [...deals, ...previewDeals];

  return (
    <div className="animate-[fadeIn_0.25s_ease]">
      {/* Actions */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-text-muted">
          {allDeals.length > 0 ? `${allDeals.length} deal${allDeals.length !== 1 ? 's' : ''}` : 'No deals yet'}
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
            onClick={handlePreview}
            disabled={previewLoading}
            className="px-2.5 py-1 text-[11px] text-accent-amber hover:text-white border border-amber-500/30 hover:bg-amber-500 rounded-md transition-all flex items-center gap-1 disabled:opacity-50"
          >
            <Eye className={`w-3 h-3 ${previewLoading ? 'animate-pulse' : ''}`} />
            {previewLoading ? 'Loading…' : 'Preview 5'}
          </button>
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

      {/* Error */}
      {error && (
        <div className="mb-3 p-2.5 bg-accent-red/10 border border-accent-red/20 rounded-md flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-accent-red flex-shrink-0 mt-0.5" />
          <div className="text-[11px] text-accent-red leading-relaxed">{error}</div>
        </div>
      )}

      {/* Deal List */}
      {allDeals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-text-muted">
          <Inbox className="w-8 h-8 mb-2 opacity-60" />
          <p className="text-sm">No deals found yet.</p>
          <p className="text-[11px] mt-1">Click Preview 5 to fetch live buy_now listings.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {allDeals.map((deal) => (
            <DealCard key={`${deal.id}-${deal.timestamp}`} deal={deal} />
          ))}
        </div>
      )}
    </div>
  );
}
