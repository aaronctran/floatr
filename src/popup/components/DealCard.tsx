import { useState } from 'react';
import { ExternalLink, X, ChevronDown, ChevronUp } from 'lucide-react';
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
  if (!floatValue) return '—';
  if (floatValue < 0.01) return 'Top 1%';
  if (floatValue < 0.05) return 'Top 5%';
  if (floatValue < 0.10) return 'Top 10%';
  if (floatValue < 0.15) return 'Top 15%';
  return 'Average';
}

export default function DealCard({ deal, onDismiss }: Props) {
  const [expanded, setExpanded] = useState(false);

  const item = deal.item || {};
  const name = deal.marketHashName || 'Unknown Item';
  const isSt = name.includes('StatTrak™');
  const isSv = name.includes('Souvenir');
  const cleanName = name.replace('StatTrak™ ', '').replace('Souvenir ', '');
  const rarityClass = getRarityClass(item.rarity);

  const iconUrl = item.icon_url
    ? `https://steamcommunity-a.akamaihd.net/economy/image/${encodeURIComponent(item.icon_url)}`
    : null;

  const stickers = deal.stickers || [];

  return (
    <div
      className={`bg-bg-card border border-ui-border/[0.06] rounded-xl overflow-hidden transition-all hover:shadow-lg hover:shadow-black/30 hover:border-ui-border/10 hover:-translate-y-0.5 ${
        isSt ? 'border-l-[3px] border-l-amber-500' : isSv ? 'border-l-[3px] border-l-yellow-400' : ''
      }`}
    >
      {/* Summary */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 p-2.5 text-left"
      >
        {/* Thumbnail */}
        <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-[#1a2235] to-bg-secondary flex items-center justify-center flex-shrink-0 border border-ui-border/[0.06] overflow-hidden">
          {iconUrl ? (
            <img src={iconUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <span className="text-[9px] text-accent-blue font-semibold">[img]</span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-xs truncate tracking-tight">
            {isSt && <span className="text-amber-400 font-bold text-[10px] mr-0.5">ST</span>}
            {isSv && <span className="text-yellow-400 font-bold text-[10px] mr-0.5">SV</span>}
            <span className={rarityClass}>{cleanName}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-sm font-bold text-accent-blue tracking-tight">
              {deal.priceDisplay || '$0.00'}
            </span>
          </div>
          <div className="flex gap-1 mt-1 flex-wrap items-center">
            {deal.reasons.map((r, i) => (
              <span
                key={i}
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold tracking-wide ${
                  r.type === 'sticker_arbitrage'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : r.type === 'rare_float'
                    ? 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20'
                    : 'bg-ui-overlay/5 text-text-muted border border-ui-border/10'
                }`}
              >
                {r.type === 'sticker_arbitrage' ? 'sticker arb' : r.type === 'rare_float' ? 'float match' : 'API test'}
              </span>
            ))}
            {deal.stickerValueCents > 0 && (
              <span className="text-[10px] text-amber-400 font-bold">
                ${(deal.stickerValueCents / 100).toFixed(2)} stickers
              </span>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="text-right text-[11px] text-text-muted flex-shrink-0 leading-relaxed">
          <div>Float: {deal.floatValue ? deal.floatValue.toFixed(4) : '—'}</div>
          <div className="mt-0.5">
            {expanded ? <ChevronUp className="w-3 h-3 mx-auto" /> : <ChevronDown className="w-3 h-3 mx-auto" />}
          </div>
        </div>
      </button>

      <button
        onClick={() => void onDismiss({ id: deal.id })}
        aria-label={`Hide listing ${deal.id} for this session`}
        className="mx-2.5 mb-2.5 px-2 py-1 text-[11px] text-text-muted hover:text-accent-red border border-ui-border/10 rounded-md flex items-center gap-1"
      >
        <X className="w-3 h-3" /> Hide this deal for session
      </button>

      {/* Detail */}
      {expanded && (
        <div className="border-t border-ui-border/[0.06] p-3 animate-[slideDown_0.2s_ease]">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-1.5 mb-2.5">
            <StatBox label="Float" value={deal.floatValue?.toFixed(6) || '—'} />
            <StatBox label="Pattern" value={item.paint_seed || '—'} />
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
