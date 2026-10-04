import { SKIN_CATALOG } from './skinCatalog.generated';
export { SKIN_CATALOG } from './skinCatalog.generated';

export interface SkinDefinition {
  readonly name: string;
  readonly weapon: string;
  readonly defIndex: number;
  /** Null means the catalog supplies no paint index (e.g. vanilla knives). */
  readonly paintIndex: number | null;
  readonly phase: string | null;
  readonly minFloat: number | null;
  readonly maxFloat: number | null;
  readonly wears: readonly string[];
  readonly stattrak: boolean;
  readonly souvenir: boolean;
}

const normalizeName = (name: string) => name.toLowerCase().replace(/★/g, '').replace(/\s+/g, ' ').trim();

/** Canonical weapon name -> CSFloat def_index. */
export const WEAPON_DEF_INDEX: Readonly<Record<string, number>> = Object.freeze(
  Object.fromEntries(SKIN_CATALOG.map((skin) => [skin.weapon, skin.defIndex]))
);

const byName: Record<string, SkinDefinition[]> = {};
const byWeapon: Record<number, SkinDefinition[]> = {};
for (const skin of SKIN_CATALOG) {
  (byName[normalizeName(skin.name)] ??= []).push(skin);
  (byWeapon[skin.defIndex] ??= []).push(skin);
}

/** Names can map to multiple finishes, notably Doppler phases. */
export const SKINS_BY_NAME: Readonly<Record<string, readonly SkinDefinition[]>> = Object.freeze(byName);
export const SKINS_BY_WEAPON: Readonly<Record<number, readonly SkinDefinition[]>> = Object.freeze(byWeapon);

/** Case-insensitive canonical base name, e.g. "M4A4 | Poseidon" (no wear). */
export function findSkinDefinitions(name: string): readonly SkinDefinition[] {
  return SKINS_BY_NAME[normalizeName(name)] ?? [];
}

/** Build one query per chosen variant; category/wear/price are separate filters. */
export function toCSFloatSkinFilter(skin: SkinDefinition): {
  def_index: number;
  paint_index?: number;
  market_hash_name?: string;
} {
  // Omitting the paint filter alone would match every finish on a vanilla knife.
  return skin.paintIndex === null
    ? { def_index: skin.defIndex, market_hash_name: skin.name }
    : { def_index: skin.defIndex, paint_index: skin.paintIndex };
}
