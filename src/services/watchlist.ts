// watchlist.ts — fuzzy matcher for watchlist entries.
// Converts shorthand like "ak redline ft" or "st m4 asiimov mw" into the
// exact CSFloat market_hash_name format:
//   "AK-47 | Redline (Field-Tested)"
//   "StatTrak™ M4A1-S | Asiimov (Minimal Wear)"
//   "★ Karambit | Doppler (Factory New)"
// Anything it can't confidently resolve is passed through unchanged.

import { SKIN_CATALOG } from '../constants/skins';

export interface WatchItemResult {
  original: string;
  normalized: string;
  recognized: boolean;
  /** Canonical wear when one was specified, else null (matches all wears). */
  wear: string | null;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[™★]/g, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const catalogByName = new Map(SKIN_CATALOG.map((skin) => [norm(skin.name), skin]));

// --- Wear aliases -----------------------------------------------------------
const WEAR_ALIASES: Record<string, string> = {
  fn: 'Factory New',
  'factory new': 'Factory New',
  mw: 'Minimal Wear',
  'minimal wear': 'Minimal Wear',
  ft: 'Field-Tested',
  'field tested': 'Field-Tested',
  ww: 'Well-Worn',
  'well worn': 'Well-Worn',
  bs: 'Battle-Scarred',
  'battle scarred': 'Battle-Scarred',
};
const WEAR_LOOKUP: Record<string, string> = Object.fromEntries(
  Object.entries(WEAR_ALIASES).map(([k, v]) => [norm(k), v])
);

// --- Weapon / knife aliases (keyed by normalized alias) ---------------------
const WEAPON_ALIASES: Record<string, string> = {
  // Rifles
  ak: 'AK-47',
  ak47: 'AK-47',
  'ak 47': 'AK-47',
  m4a4: 'M4A4',
  m4: 'M4A1-S',
  m4a1: 'M4A1-S',
  m4a1s: 'M4A1-S',
  'm4a1 s': 'M4A1-S',
  awp: 'AWP',
  famas: 'FAMAS',
  galil: 'Galil AR',
  galilar: 'Galil AR',
  'galil ar': 'Galil AR',
  aug: 'AUG',
  sg: 'SG 553',
  sg553: 'SG 553',
  'sg 553': 'SG 553',
  ssg: 'SSG 08',
  ssg08: 'SSG 08',
  'ssg 08': 'SSG 08',
  scar: 'SCAR-20',
  scar20: 'SCAR-20',
  'scar 20': 'SCAR-20',
  g3: 'G3SG1',
  g3sg1: 'G3SG1',
  // Pistols
  usp: 'USP-S',
  usps: 'USP-S',
  'usp s': 'USP-S',
  glock: 'Glock-18',
  glock18: 'Glock-18',
  'glock 18': 'Glock-18',
  p250: 'P250',
  p2000: 'P2000',
  deagle: 'Desert Eagle',
  'desert eagle': 'Desert Eagle',
  tec9: 'Tec-9',
  'tec 9': 'Tec-9',
  fiveseven: 'Five-SeveN',
  'five seven': 'Five-SeveN',
  cz: 'CZ75-Auto',
  cz75: 'CZ75-Auto',
  'cz 75': 'CZ75-Auto',
  'cz75 auto': 'CZ75-Auto',
  duals: 'Dual Berettas',
  'dual berettas': 'Dual Berettas',
  // SMGs
  p90: 'P90',
  mp9: 'MP9',
  mac10: 'MAC-10',
  'mac 10': 'MAC-10',
  ump: 'UMP-45',
  ump45: 'UMP-45',
  'ump 45': 'UMP-45',
  mp7: 'MP7',
  'mp 7': 'MP7',
  mp5: 'MP5-SD',
  mp5sd: 'MP5-SD',
  'mp5 sd': 'MP5-SD',
  bizon: 'PP-Bizon',
  ppbizon: 'PP-Bizon',
  'pp bizon': 'PP-Bizon',
  // Heavy
  nova: 'Nova',
  xm: 'XM1014',
  xm1014: 'XM1014',
  mag7: 'MAG-7',
  'mag 7': 'MAG-7',
  'sawed off': 'Sawed-Off',
  sawedoff: 'Sawed-Off',
  m249: 'M249',
  negev: 'Negev',
  // Knives (canonical names get the ★ prefix)
  karambit: 'Karambit',
  kara: 'Karambit',
  bayonet: 'Bayonet',
  bayo: 'Bayonet',
  m9: 'M9 Bayonet',
  'm9 bayonet': 'M9 Bayonet',
  butterfly: 'Butterfly Knife',
  'butterfly knife': 'Butterfly Knife',
  bfk: 'Butterfly Knife',
  flip: 'Flip Knife',
  'flip knife': 'Flip Knife',
  gut: 'Gut Knife',
  'gut knife': 'Gut Knife',
  huntsman: 'Huntsman Knife',
  'huntsman knife': 'Huntsman Knife',
  bowie: 'Bowie Knife',
  'bowie knife': 'Bowie Knife',
  falchion: 'Falchion Knife',
  'falchion knife': 'Falchion Knife',
  shadow: 'Shadow Daggers',
  shadowdaggers: 'Shadow Daggers',
  'shadow daggers': 'Shadow Daggers',
  navaja: 'Navaja Knife',
  stiletto: 'Stiletto Knife',
  talon: 'Talon Knife',
  ursus: 'Ursus Knife',
  survival: 'Survival Knife',
  nomad: 'Nomad Knife',
  skeleton: 'Skeleton Knife',
  classic: 'Classic Knife',
  paracord: 'Paracord Knife',
};

const KNIFE_NAMES = new Set([
  'Karambit', 'Bayonet', 'M9 Bayonet', 'Butterfly Knife', 'Flip Knife',
  'Gut Knife', 'Huntsman Knife', 'Bowie Knife', 'Falchion Knife',
  'Shadow Daggers', 'Navaja Knife', 'Stiletto Knife', 'Talon Knife',
  'Ursus Knife', 'Survival Knife', 'Nomad Knife', 'Skeleton Knife',
  'Classic Knife', 'Paracord Knife',
]);

// Longest-first so "m9 bayonet" beats "m9" and "galil ar" beats "galil".
const ALIAS_ENTRIES: Array<[string, string]> = Object.entries(WEAPON_ALIASES)
  .map(([alias, canon]) => [norm(alias), canon] as [string, string])
  .sort((a, b) => b[0].length - a[0].length);

function matchWeapon(text: string): { weapon: string; rest: string } | null {
  const t = norm(text);
  for (const [alias, canon] of ALIAS_ENTRIES) {
    if (t === alias) return { weapon: canon, rest: '' };
    if (t.startsWith(alias + ' ')) {
      return { weapon: canon, rest: text.trim().slice(alias.length).trim() };
    }
  }
  return null;
}

function extractWear(text: string): { rest: string; wear: string | null } {
  // "(factory new)" / "(FT)" suffix
  const paren = text.match(/\(([^)]*)\)\s*$/);
  if (paren) {
    const w = WEAR_LOOKUP[norm(paren[1])];
    if (w) return { rest: text.slice(0, paren.index).trim(), wear: w };
  }
  // bare trailing " ft" / " FN"
  const bare = text.match(/\s+(fn|mw|ft|ww|bs)\s*$/i);
  if (bare) {
    const w = WEAR_LOOKUP[norm(bare[1])];
    if (w) return { rest: text.slice(0, bare.index).trim(), wear: w };
  }
  return { rest: text, wear: null };
}

function titleCase(s: string): string {
  return s
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export function normalizeWatchItem(input: string): WatchItemResult {
  const original = input.trim();
  if (!original) return { original, normalized: original, recognized: false, wear: null };
  if (isIgnoredWatchItem(original)) {
    const result = normalizeWatchItem(original.slice(1).trim());
    return { ...result, original, normalized: `! ${result.normalized}` };
  }

  let text = original.replace(/★/g, ' ').trim();

  const souvenir = /^souvenir\s+/i.test(text);
  if (souvenir) text = text.replace(/^souvenir\s+/i, '');
  // StatTrak prefix: "st", "stattrak", "statrak"
  let stattrak = false;
  const stMatch = text.match(/^(st|stattrak|statrak)™?[.\s]+/i);
  if (stMatch) {
    stattrak = true;
    text = text.slice(stMatch[0].length).trim();
  }

  // Wear suffix
  const { rest, wear } = extractWear(text);

  const exact = catalogByName.get(norm(rest));
  if (exact) {
    const prefix = stattrak ? 'StatTrak™ ' : souvenir ? 'Souvenir ' : '';
    const name = exact.name.startsWith('★ ') ? `★ ${prefix}${exact.name.slice(2)}` : `${prefix}${exact.name}`;
    return { original, normalized: `${name}${wear ? ` (${wear})` : ''}`, recognized: true, wear };
  }

  // Split "weapon | skin" if a pipe is present
  let weaponPart = rest;
  let skinPart = '';
  if (rest.includes('|')) {
    const [left, ...right] = rest.split('|');
    weaponPart = left.trim();
    skinPart = right.join('|').trim();
  }

  const match = matchWeapon(weaponPart);
  if (!match) {
    // Unknown weapon — pass through unchanged rather than guessing.
    return { original, normalized: original, recognized: false, wear: null };
  }

  const skin = skinPart || match.rest;
  if (!skin) {
    // Weapon recognized but no skin given — not a valid market_hash_name.
    return { original, normalized: original, recognized: false, wear: null };
  }

  const canonical = catalogByName.get(norm(`${match.weapon} | ${skin}`));
  if (canonical) {
    return { ...normalizeWatchItem(`${stattrak ? 'st ' : souvenir ? 'Souvenir ' : ''}${canonical.name}${wear ? ` (${wear})` : ''}`), original };
  }

  const star = KNIFE_NAMES.has(match.weapon) ? '★ ' : '';
  const st = stattrak ? 'StatTrak™ ' : souvenir ? 'Souvenir ' : '';
  const wearSuffix = wear ? ` (${wear})` : '';
  return {
    original,
    normalized: `${star}${st}${match.weapon} | ${titleCase(norm(skin))}${wearSuffix}`,
    recognized: true,
    wear,
  };
}

export function normalizeWatchlist(items: string[]): WatchItemResult[] {
  return items.map(normalizeWatchItem);
}

// All wear tiers, best to worst — used to expand wear-less watchlist entries.
export const WEAR_TIERS = [
  'Factory New',
  'Minimal Wear',
  'Field-Tested',
  'Well-Worn',
  'Battle-Scarred',
] as const;

// Expand a watchlist entry into the market_hash_name queries to run:
// - recognized WITH wear    → single query (e.g. "AK-47 | Redline (Field-Tested)")
// - recognized WITHOUT wear → one query per wear tier (matches all wears)
// - unrecognized            → single pass-through query (unchanged behavior)
export function expandWatchQueries(input: string): string[] {
  const result = normalizeWatchItem(input);
  if (!result.recognized || result.wear) {
    return [result.normalized];
  }
  const base = result.normalized.replace(/StatTrak™\s*|Souvenir\s*/gi, '');
  const skin = catalogByName.get(norm(base));
  if (skin && !skin.wears.length) return [result.normalized];
  return (skin?.wears ?? WEAR_TIERS).map((wear) => `${result.normalized} (${wear})`);
}

/** Catalog suggestions for the active line, supporting existing weapon aliases. */
export function suggestWatchSkins(input: string, limit = 8): string[] {
  if (isIgnoredWatchItem(input)) {
    return suggestWatchSkins(input.trim().slice(1).trim(), limit).map((name) => `! ${name}`);
  }
  const stattrak = /^(?:★\s*)?(st|stattrak|statrak)™?[.\s]+/i.test(input.trim());
  const souvenir = /^souvenir\s+/i.test(input.trim());
  const text = input.trim().replace(/★/g, '').trim().replace(/^(st|stattrak|statrak)™?[.\s]+|^souvenir\s+/i, '');
  const { rest, wear } = extractWear(text);
  if (!rest.trim()) return [];
  const weapon = matchWeapon(rest.replace(/\|/g, ' '));
  const search = weapon ? `${weapon.weapon} ${weapon.rest}` : rest;
  const tokens = norm(search).replace(/\|/g, ' ').split(/\s+/).filter(Boolean);
  const candidates = SKIN_CATALOG.filter((skin) =>
    (!weapon || skin.weapon === weapon.weapon) &&
    (!stattrak || skin.stattrak) && (!souvenir || skin.souvenir) &&
    (!wear || skin.wears.includes(wear)) &&
    tokens.every((token) => norm(skin.name).includes(token))
  );
  return [...new Set(candidates.map((skin) => {
    const prefix = stattrak ? 'StatTrak™ ' : souvenir ? 'Souvenir ' : '';
    const name = skin.name.startsWith('★ ') ? `★ ${prefix}${skin.name.slice(2)}` : `${prefix}${skin.name}`;
    return `${name}${wear ? ` (${wear})` : ''}`;
  }))].sort().slice(0, limit);
}

export function replaceWatchlistLine(text: string, caret: number, suggestion: string) {
  const start = caret === 0 ? 0 : text.lastIndexOf('\n', caret - 1) + 1;
  const newline = text.indexOf('\n', caret);
  const end = newline === -1 ? text.length : newline;
  return { text: text.slice(0, start) + suggestion + text.slice(end), caret: start + suggestion.length };
}

export function activeWatchlist(items: string[]): string[] {
  return items.map((item) => item.trim()).filter((item) => item && !isIgnoredWatchItem(item));
}

/** Ignored entries remain in the saved draft, prefixed with !. */
export function isIgnoredWatchItem(item: string): boolean {
  return item.trimStart().startsWith('!');
}

export function toggleIgnoredWatchLine(text: string, index: number): string {
  return text.split('\n').map((line, i) => i !== index || !line.trim() ? line :
    isIgnoredWatchItem(line) ? line.replace(/^(\s*)!\s*/, '$1') : line.replace(/^(\s*)/, '$1! ')
  ).join('\n');
}

/** Verify server results and filter historical cards using the same watch queries. */
export function matchesWatchlist(marketHashName: string | undefined, items: string[]): boolean {
  const names = activeWatchlist(items);
  if (!items.some((item) => item.trim())) return true;
  if (!marketHashName) return false;
  const key = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim();
  const excluded = items.filter(isIgnoredWatchItem).map((item) => item.trim().slice(1).trim()).filter(Boolean);
  if (excluded.some((name) => expandWatchQueries(name).some((query) => key(query) === key(marketHashName)))) return false;
  return names.some((name) => expandWatchQueries(name).some((query) => key(query) === key(marketHashName)));
}
