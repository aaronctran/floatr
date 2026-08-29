export interface Sticker {
  name: string;
  price: number | null;
  icon_url?: string;
}

export interface DealReason {
  type: 'sticker_arbitrage' | 'rare_float' | 'api_test';
  detail?: string;
  [key: string]: any;
}

export interface Deal {
  id: string;
  timestamp: number;
  marketHashName: string;
  priceCents: number;
  priceDisplay: string;
  floatValue: number | null;
  stickers: Sticker[];
  stickerValueCents: number;
  reasons: DealReason[];
  item: Record<string, any>;
}

export type SensitivityLevel = 'strict' | 'balanced' | 'loose';

export interface Settings {
  enabled: boolean;
  apiKey: string;
  pollIntervalMinutes: number;
  maxListingsPerPoll: number;
  watchlist: string[];
  stickerRatioThreshold: number;
  stickerRealizationRate: number;
  minFloat: number;
  maxFloat: number;
  sensitivity?: SensitivityLevel;
}

export interface SensitivityConfig {
  label: string;
  stickerRatio: number;
  desc: string;
}
