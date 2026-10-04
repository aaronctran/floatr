import type { Settings } from '../types';
import { matchesSelectedWear } from './floatRange';

const WEAR_RANGES = [
  { name: 'Factory New', min: 0.0, max: 0.07 },
  { name: 'Minimal Wear', min: 0.07, max: 0.15 },
  { name: 'Field-Tested', min: 0.15, max: 0.38 },
  { name: 'Well-Worn', min: 0.38, max: 0.45 },
  { name: 'Battle-Scarred', min: 0.45, max: 1.0 },
];

function getWearRange(floatValue: number) {
  return WEAR_RANGES.find((r) => floatValue >= r.min && floatValue <= r.max) || null;
}

export function computeFloatRarity(floatValue: number): number {
  if (typeof floatValue !== 'number') return 0;
  const range = getWearRange(floatValue);
  if (!range || range.max === range.min) return 0;
  const percentileFromLow = (floatValue - range.min) / (range.max - range.min);
  return 1 - percentileFromLow;
}

export function computeStickerValueCents(item: { stickers?: Array<{ reference?: { price?: number } }> }): number {
  if (!Array.isArray(item.stickers) || item.stickers.length === 0) return 0;
  return item.stickers.reduce((sum, sticker) => {
    const price = sticker?.reference?.price;
    return sum + (typeof price === 'number' ? price : 0);
  }, 0);
}

export function evaluateListing(listing: any, { settings }: { settings: Settings }) {
  const item = listing.item;
  const priceCents = listing.price;
  const reasons: Array<{ type: string; [key: string]: any }> = [];

  // 1. Sticker arbitrage
  const stickerValueCents = computeStickerValueCents(item);
  const stickerRatio =
    priceCents > 0 ? (stickerValueCents * settings.stickerRealizationRate) / priceCents : 0;
  if (stickerValueCents > 0 && stickerRatio >= settings.stickerRatioThreshold) {
    reasons.push({
      type: 'sticker_arbitrage',
      stickerValueCents,
      stickerRatio,
      detail: `Stickers alone are conservatively worth ~$${(
        (stickerValueCents * settings.stickerRealizationRate) /
        100
      ).toFixed(2)} against a $${(priceCents / 100).toFixed(2)} listing.`,
    });
  }

  // 2. Float range (user-defined minFloat/maxFloat)
  const fv = item.float_value;
  if (typeof fv === 'number' && fv >= settings.minFloat && fv <= settings.maxFloat) {
    reasons.push({
      type: 'rare_float',
      floatValue: fv,
      detail: `Float ${fv.toFixed(6)} is within your range (${settings.minFloat} – ${settings.maxFloat}).`,
    });
  }

  return {
    listingId: listing.id,
    marketHashName: item.market_hash_name,
    priceCents,
    stickerValueCents,
    stickerRatio,
    floatValue: fv,
    isDeal: reasons.length > 0 && matchesSelectedWear(fv, settings.selectedWears),
    reasons,
  };
}
