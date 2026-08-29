import type { Deal } from '../types';

/**
 * Convert a raw CSFloat API listing into a Deal object.
 * No scoring — used for API testing / debug mode.
 */
export function listingToDeal(listing: any): Deal {
  const item = listing.item || {};
  const priceCents = typeof listing.price === 'number' ? listing.price : 0;

  return {
    id: String(listing.id || `mock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    timestamp: Date.now(),
    marketHashName: item.market_hash_name || 'Unknown Item',
    priceCents,
    priceDisplay: `$${(priceCents / 100).toFixed(2)}`,
    floatValue: item.float_value ?? null,
    stickers:
      item.stickers?.map((s: any) => ({
        name: s?.name || 'Unknown Sticker',
        price: s?.scm?.price ?? null,
      })) || [],
    stickerValueCents: (item.stickers || []).reduce((sum: number, s: any) => {
      const p = s?.scm?.price;
      return sum + (typeof p === 'number' ? p : 0);
    }, 0),
    reasons: [{ type: 'api_test', detail: 'Loaded from CSFloat API (buy_now, no scoring)' }],
    item,
  };
}

/**
 * Realistic mock listings that match the CSFloat API response shape.
 * Used as a fallback when the API requires auth.
 */
export const MOCK_BUY_NOW_LISTINGS: any[] = [
  {
    id: 'mock-001',
    price: 15499,
    item: {
      market_hash_name: 'AK-47 | Redline (Field-Tested)',
      float_value: 0.152341,
      paint_seed: 142,
      wear_name: 'Field-Tested',
      rarity: 'Classified',
      icon_url: '-9a81dlWLwJ2UUGcV_',
      has_screenshot: true,
      stickers: [
        {
          name: 'Sticker | FaZe Clan | Katowice 2019',
          scm: { price: 245 },
        },
        {
          name: 'Sticker | rain (Gold) | Berlin 2019',
          scm: { price: 890 },
        },
      ],
    },
  },
  {
    id: 'mock-002',
    price: 32000,
    item: {
      market_hash_name: 'M4A4 | Asiimov (Battle-Scarred)',
      float_value: 0.489012,
      paint_seed: 777,
      wear_name: 'Battle-Scarred',
      rarity: 'Covert',
      icon_url: '-9a81dlWLwJ2UUGcV_',
      has_screenshot: true,
      stickers: [],
    },
  },
  {
    id: 'mock-003',
    price: 8750,
    item: {
      market_hash_name: 'StatTrak™ Glock-18 | Water Elemental (Minimal Wear)',
      float_value: 0.089123,
      paint_seed: 333,
      wear_name: 'Minimal Wear',
      rarity: 'Classified',
      icon_url: '-9a81dlWLwJ2UUGcV_',
      has_screenshot: false,
      stickers: [
        {
          name: 'Sticker | Cloud9 (Holo) | Krakow 2017',
          scm: { price: 1250 },
        },
      ],
    },
  },
  {
    id: 'mock-004',
    price: 42100,
    item: {
      market_hash_name: 'AWP | Dragon Lore (Field-Tested)',
      float_value: 0.281234,
      paint_seed: 55,
      wear_name: 'Field-Tested',
      rarity: 'Covert',
      icon_url: '-9a81dlWLwJ2UUGcV_',
      has_screenshot: true,
      stickers: [
        {
          name: 'Sticker | Titan (Holo) | Katowice 2014',
          scm: { price: 450000 },
        },
        {
          name: 'Sticker | Crown (Foil)',
          scm: { price: 32000 },
        },
      ],
    },
  },
  {
    id: 'mock-005',
    price: 5200,
    item: {
      market_hash_name: 'Souvenir USP-S | Royal Blue (Minimal Wear)',
      float_value: 0.098765,
      paint_seed: 12,
      wear_name: 'Minimal Wear',
      rarity: 'Industrial Grade',
      icon_url: '-9a81dlWLwJ2UUGcV_',
      has_screenshot: false,
      stickers: [
        {
          name: 'Sticker | Gold ESL One Cologne 2014',
          scm: { price: 1500 },
        },
        {
          name: 'Sticker | Ninjas in Pyjamas (Gold) | Cologne 2014',
          scm: { price: 950 },
        },
        {
          name: 'Sticker | Team LDLC.com (Gold) | Cologne 2014',
          scm: { price: 800 },
        },
      ],
    },
  },
];
