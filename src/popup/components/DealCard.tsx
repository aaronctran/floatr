import { useId, useRef, useState } from 'react';
import { ExternalLink, X, ChevronDown, ChevronUp, Sparkles, Crosshair } from 'lucide-react';
import type { Deal } from '../../types';

interface Props {
  deal: Deal;
  onDismiss: (target: { id?: string }) => Promise<void>;
}

const RARITY_MAP: Record<string, string> = {
  'Consumer Grade': 'rarity-consumer',
  'Industrial Grade': 'rarity-industrial',
  'Mil-Spec Grade': 'rarity-milspec',
  Restricted: 'rarity-restricted',
  Classified: 'rarity-classified',
  Covert: 'rarity-covert',
  Contraband: 'rarity-contraband',
};

function getRarityClass(rarity?: string) {
  return RARITY_MAP[rarity || ''] || '';
}

function getFloatRarityText(floatValue: number | null) {
  if (floatValue === null) return '—';
  if (floatValue < 0.01) return 'Top 1%';
  if (floatValue < 0.05) return 'Top 5%';
  if (floatValue < 0.10) return 'Top 10%';
  if (floatValue < 0.15) return 'Top 15%';
  return 'Average';
}

export default function DealCard({ deal, onDismiss }: Props) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const confirmationId = useId();
  const hideButton = useRef<HTMLButtonElement>(null);
  const [confirmingHide, setConfirmingHide] = useState(false);
  const [hiding, setHiding] = useState(false);
  const [hideError, setHideError] = useState<string | null>(null);
  const keepDeal = () => {
    setConfirmingHide(false);
    setHideError(null);
    hideButton.current?.focus();
  };
  const confirmHide = async () => {
    if (hiding) return;
    setHiding(true);
    setHideError(null);
    try {
      await onDismiss({ id: deal.id });
      setConfirmingHide(false);
    } catch (error) {
      setHideError(error instanceof Error ? error.message : 'Could not hide this deal. Try again.');
    } finally {
      setHiding(false);
    }
  };

  const item = deal.item || {};
  const name = deal.marketHashName || 'Unknown Item';
  const isSt = name.includes('StatTrak™');
  const isSv = name.includes('Souvenir');
  const cleanName = name.replace('StatTrak™ ', '').replace('Souvenir ', '');
  const separator = cleanName.indexOf(' | ');
  const weaponName = separator >= 0 ? cleanName.slice(0, separator) : 'Skin';
  const skinName = (separator >= 0 ? cleanName.slice(separator + 3) : cleanName).replace(/ \([^)]*\)$/, '');
  const rarityClass = getRarityClass(item.rarity);

  const iconUrl = item.icon_url
    ? `https://steamcommunity-a.akamaihd.net/economy/image/${encodeURIComponent(item.icon_url)}`
    : null;

  const stickers = deal.stickers || [];
  const hasFloatMatch = deal.reasons.some((reason) => reason.type === 'rare_float');
  const matchSignals = [...deal.reasons].sort((a, b) => {
    const order = { sticker_arbitrage: 0, rare_float: 1, api_test: 2 };
    return (order[a.type] ?? 2) - (order[b.type] ?? 2);
  });

  return (
    <div
      className={`bg-bg-card border border-ui-border/10 border-l-[3px] rounded-xl overflow-hidden transition-all hover:shadow-lg hover:border-ui-border/20 ${
        isSt || isSv ? 'border-l-accent-amber' : 'border-l-accent-blue'
      }`}
      style={hasFloatMatch ? { borderLeftColor: 'rgb(var(--float-banner, 37 99 235))' } : undefined}
    >
      {/* Match signals */}
      <div className="border-b border-ui-border/10">
        {matchSignals.map((reason, index) => (
          <div key={index} className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[11px] font-semibold ${reason.type === 'sticker_arbitrage' ? 'bg-accent-amber/10' : reason.type === 'rare_float' ? '' : 'bg-ui-overlay/5 text-text-secondary'}`}
            style={reason.type === 'sticker_arbitrage' ? { color: 'light-dark(#92400e, #fbbf24)' } : reason.type === 'rare_float' ? {
              color: 'rgb(var(--float-banner-foreground, 255 255 255))', backgroundColor: 'rgb(var(--float-banner, 37 99 235))',
            } : undefined}>
            <span className="inline-flex items-center gap-1.5">
              {reason.type === 'sticker_arbitrage' ? <Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> : reason.type === 'rare_float' ? <Crosshair className="w-3.5 h-3.5" aria-hidden="true" /> : null}
              {reason.type === 'sticker_arbitrage' ? 'Sticker value' : reason.type === 'rare_float' ? 'Float match' : 'API test'}
            </span>
            <span className={`tabular-nums shrink-0 ${reason.type === 'rare_float' ? 'font-mono' : ''}`}>
              {reason.type === 'sticker_arbitrage' && deal.priceCents > 0
                ? `${Math.round(deal.stickerValueCents / deal.priceCents * 100)}% of price`
                : reason.type === 'rare_float' ? deal.floatValue?.toFixed(6) ?? '—' : ''}
            </span>
          </div>
        ))}
      </div>
      <div className="p-3">
        <div className="flex items-start gap-2.5">
          <div className="w-14 h-14 shrink-0 rounded-lg bg-bg-secondary border border-ui-border/10 overflow-hidden flex items-center justify-center">
            {iconUrl ? <img src={iconUrl} alt={cleanName} className="w-full h-full object-contain" loading="lazy" />
              : <span className="text-[10px] text-text-muted">No image</span>}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-text-muted">{weaponName}{item.wear_name ? ` · ${item.wear_name}` : ''}</p>
            <h3 className={`text-sm font-semibold leading-snug break-words ${rarityClass}`}>
              {isSt && <span className="text-accent-amber mr-1">ST</span>}
              {isSv && <span className="text-accent-amber mr-1">SV</span>}
              {skinName}
            </h3>
            <div className="mt-1 text-xl font-bold tracking-tight text-text-primary tabular-nums">{deal.priceDisplay || '$0.00'}</div>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-2 my-3 text-[10px] text-text-muted">
          <div><dt>Float</dt><dd className="mt-0.5 text-xs font-semibold text-text-primary tabular-nums">{deal.floatValue?.toFixed(6) ?? '—'}</dd></div>
          <div><dt>Sticker value</dt><dd className="mt-0.5 text-xs font-semibold text-text-primary tabular-nums">{deal.stickerValueCents > 0 ? `$${(deal.stickerValueCents / 100).toFixed(2)}` : '—'}</dd></div>
          <div><dt>Pattern</dt><dd className="mt-0.5 text-xs font-semibold text-text-primary tabular-nums">{item.paint_seed ?? '—'}</dd></div>
        </dl>
        <div className="flex items-center gap-1.5">
          <a href={`https://csfloat.com/item/${deal.id}`} target="_blank" rel="noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-accent-blue px-2 py-2 text-[11px] font-semibold text-on-accent hover:bg-accent-blue-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue">
            <ExternalLink className="w-3 h-3" aria-hidden="true" />View listing
          </a>
          <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls={detailsId}
            className="inline-flex items-center justify-center gap-1 rounded-md border border-ui-border/15 px-2 py-2 text-[11px] text-text-secondary hover:bg-ui-overlay/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue">
            Details {expanded ? <ChevronUp className="w-3 h-3" aria-hidden="true" /> : <ChevronDown className="w-3 h-3" aria-hidden="true" />}
          </button>
          <button ref={hideButton} type="button" disabled={hiding} onClick={() => { setConfirmingHide(true); setHideError(null); }} aria-label={`Hide listing ${deal.id} for this session`}
            aria-expanded={confirmingHide} aria-controls={confirmationId}
            title="Hide for this session"
            className="inline-flex items-center justify-center rounded-md border border-ui-border/15 p-2 text-text-muted transition-colors hover:text-accent-red hover:bg-accent-red/10 hover:border-accent-red/40 focus-visible:text-accent-red focus-visible:bg-accent-red/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red active:text-accent-red active:bg-accent-red/20">
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
      {confirmingHide && (
        <div id={confirmationId} role="group" aria-labelledby={`${confirmationId}-title`}
          className="border-t border-ui-border/15 bg-bg-card p-3"
          onKeyDown={(event) => { if (event.key === 'Escape' && !hiding) { event.stopPropagation(); keepDeal(); } }}>
          <h4 id={`${confirmationId}-title`} className="text-xs font-semibold text-text-primary">Hide this deal?</h4>
          <p className="text-[11px] text-text-secondary mt-1 break-words">{cleanName} · {deal.priceDisplay}</p>
          <p className="text-[11px] text-text-muted mt-1">Hidden for this browser session. Restore it from Deals.</p>
          <div className="flex flex-wrap justify-end gap-2 mt-3">
            <button type="button" autoFocus disabled={hiding} onClick={keepDeal}
              className="inline-flex items-center justify-center rounded-md border border-accent-green/40 bg-accent-green/15 px-3 py-2 text-xs font-semibold transition-colors hover:bg-accent-green/25 active:bg-accent-green/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-green disabled:opacity-50"
              style={{ color: 'light-dark(#166534, #4ade80)' }}>Keep deal</button>
            <button type="button" disabled={hiding} onClick={() => void confirmHide()}
              className="inline-flex items-center justify-center rounded-md bg-accent-red px-3 py-2 text-xs font-semibold text-white transition-colors hover:brightness-110 active:brightness-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red disabled:opacity-50">
              {hiding ? 'Hiding…' : 'Hide deal'}
            </button>
          </div>
          {hideError && <p role="alert" className="mt-2 text-xs text-accent-red">{hideError}</p>}
        </div>
      )}
      {/* Detail */}
      {expanded && (
        <div id={detailsId} className="border-t border-ui-border/[0.06] p-3 animate-[slideDown_0.2s_ease]">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-1.5 mb-2.5">
            <StatBox label="Float" value={deal.floatValue?.toFixed(6) || '—'} />
            <StatBox label="Pattern" value={item.paint_seed ?? '—'} />
            <StatBox label="Wear" value={item.wear_name || '—'} />
            <StatBox label="Float Rarity" value={getFloatRarityText(deal.floatValue)} good />
          </div>

          {/* Screenshot */}
          {item.has_screenshot && (
            <div className="mb-2.5">
              <h4 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Screenshot</h4>
              <a
                href={`https://csfloat.com/item/${deal.id}`}
                target="_blank"
                rel="noreferrer"
                className="block no-underline"
              >
                <div className="bg-bg-secondary border border-ui-border/[0.06] rounded-md py-5 text-center text-accent-blue text-xs font-semibold hover:border-accent-blue hover:bg-accent-blue/5 transition-all">
                  Click to view CSFloat screenshot →
                </div>
              </a>
            </div>
          )}

          {/* Stickers */}
          <div className="mb-2.5">
            <h4 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
              Applied Stickers ({stickers.length})
            </h4>
            {stickers.length === 0 ? (
              <p className="text-[11px] text-text-muted py-2">No stickers applied.</p>
            ) : (
              <div>
                {stickers.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 py-1 text-[11px] text-text-secondary border-b border-ui-border/[0.04] last:border-0"
                  >
                    <span className="flex-1 min-w-0 truncate">{s.name || 'Unknown'}</span>
                    <span className="font-semibold text-text-primary flex-shrink-0">
                      ${((s.price || 0) / 100).toFixed(2)}
                    </span>
                  </div>
                ))}
                {deal.stickerValueCents > 0 && (
                  <div className="mt-1.5 pt-1.5 border-t-2 border-ui-border/[0.06] font-bold text-xs flex justify-between text-text-primary">
                    <span>Total sticker value</span>
                    <span>${(deal.stickerValueCents / 100).toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-1.5">
            <a
              href={`https://csfloat.com/item/${deal.id}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 py-2 bg-gradient-to-r from-accent-blue to-accent-blue text-on-accent rounded-md text-[11px] font-semibold text-center shadow-lg shadow-accent-blue/10 hover:shadow-accent-blue/40 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-1"
            >
              <ExternalLink className="w-3 h-3" /> Open on CSFloat
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="bg-bg-secondary border border-ui-border/[0.06] rounded-md px-2.5 py-2">
      <div className="text-[9px] text-text-muted uppercase tracking-widest font-semibold">{label}</div>
      <div className={`text-sm font-bold mt-0.5 ${good ? 'text-accent-green' : 'text-text-primary'}`}>{value}</div>
    </div>
  );
}
