import type { Deal, Settings } from '../types';
import { matchesSelectedWear } from './floatRange';
import { matchesWatchlist } from './watchlist';
import { getDealLog, getDismissedDeals, getSettings, type DismissedDeals } from './storage';

export function isDealVisible(deal: Deal, settings: Settings, dismissed: DismissedDeals) {
  const hasStickers = (deal.item?.stickers ?? deal.stickers ?? []).length > 0;
  return !dismissed.ids.includes(deal.id) &&
    matchesSelectedWear(deal.floatValue ?? deal.item?.float_value, settings.selectedWears) &&
    matchesWatchlist(deal.marketHashName, settings.watchlist) &&
    (settings.stickerFilter !== 'with' || hasStickers) &&
    (settings.stickerFilter !== 'without' || !hasStickers);
}

export async function getVisibleDeals() {
  const [deals, settings, dismissed] = await Promise.all([getDealLog(), getSettings(), getDismissedDeals()]);
  return deals.filter((deal) => isDealVisible(deal, settings, dismissed));
}
