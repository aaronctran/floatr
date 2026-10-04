import type { Deal } from '../types';

/** Consolidate wear and StatTrak/Souvenir variants under their weapon + finish. */
export function skinGroupName(name: string): string {
  return name.replace(/\s*\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)\s*$/i, '')
    .replace(/StatTrak™\s*|Souvenir\s*/gi, '').trim();
}

/** Rank using saved deal signals; this is not an estimate of market profit. */
export function compareDeals(a: Deal, b: Deal): number {
  const rank = (deal: Deal) => {
    const reasons = deal.reasons ?? [];
    const qualifies = reasons.some((reason) => reason.type === 'sticker_arbitrage' || reason.type === 'rare_float');
    const stickerRatio = Math.max(0, ...reasons.filter((reason) => reason.type === 'sticker_arbitrage')
      .map((reason) => typeof reason.stickerRatio === 'number' && Number.isFinite(reason.stickerRatio) ? reason.stickerRatio : 0));
    return { qualifies: Number(qualifies), stickerRatio };
  };
  const left = rank(a), right = rank(b);
  const price = (deal: Deal) => Number.isFinite(deal.priceCents) && deal.priceCents >= 0 ? deal.priceCents : Number.MAX_VALUE;
  const float = (deal: Deal) => typeof deal.floatValue === 'number' && Number.isFinite(deal.floatValue) ? deal.floatValue : Number.MAX_VALUE;
  return right.qualifies - left.qualifies || right.stickerRatio - left.stickerRatio ||
    price(a) - price(b) || float(a) - float(b) || a.id.localeCompare(b.id);
}

export function groupDealsBySkin(deals: Deal[]) {
  const groups = new Map<string, { name: string; deals: Deal[] }>();
  const seen = new Set<string>();
  for (const deal of deals) {
    if (seen.has(deal.id)) continue;
    seen.add(deal.id);
    const name = skinGroupName(deal.marketHashName);
    const key = name.toLowerCase();
    if (!groups.has(key)) groups.set(key, { name, deals: [] });
    groups.get(key)!.deals.push(deal);
  }
  return [...groups.values()].map((group) => ({
    ...group, deals: group.deals.sort(compareDeals),
  })).sort((a, b) => compareDeals(a.deals[0], b.deals[0]) || a.name.localeCompare(b.name));
}
