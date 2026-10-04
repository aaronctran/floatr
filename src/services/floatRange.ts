import type { Settings } from '../types';

export const WEAR_PRESETS = [
  { short: 'FN', name: 'Factory New', min: 0, max: 0.07, color: '#34d399' },
  { short: 'MW', name: 'Minimal Wear', min: 0.07, max: 0.15, color: '#a3e635' },
  { short: 'FT', name: 'Field-Tested', min: 0.15, max: 0.38, color: '#facc15' },
  { short: 'WW', name: 'Well-Worn', min: 0.38, max: 0.45, color: '#fb923c' },
  { short: 'BS', name: 'Battle-Scarred', min: 0.45, max: 1, color: '#f87171' },
];

export function matchesSelectedWear(value: unknown, selected: Settings['selectedWears']) {
  if (selected === undefined) return true; // Preserve existing saved settings.
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  return WEAR_PRESETS.some((wear) => selected.includes(wear.short) && value >= wear.min &&
    (value < wear.max || wear.short === 'BS' && value === 1));
}
