# Skin filter catalog

Import from `skins.ts`. The generated snapshot contains weapon/finish combinations
from [ByMykel/CSGO-API](https://github.com/ByMykel/CSGO-API), including knives and
gloves. It is community data, not a guarantee that an item has active CSFloat listings.

```ts
import { findSkinDefinitions, toCSFloatSkinFilter, WEAPON_DEF_INDEX } from './skins';

WEAPON_DEF_INDEX['M4A4']; // 16
const candidates = findSkinDefinitions('M4A4 | Poseidon');
const filters = candidates.map(toCSFloatSkinFilter);
// [{ def_index: 16, paint_index: 449 }]
```

Pass each filter to `fetchListings`, together with `type`, `category`, sorting,
price bounds, or float bounds as needed. The watchlist uses the catalog for
autocomplete, canonical names, and valid wear queries. Name lookup here accepts canonical base names without wear;
it does not perform fuzzy matching or expand weapon aliases.

`SKINS_BY_WEAPON[16]` returns all catalog finishes for M4A4. `SKINS_BY_NAME` uses
lowercase, whitespace-normalized names without the star symbol. Use the lookup
helper instead of constructing its keys manually.

Keep multiple results: a Doppler name can represent several paint indexes/phases.
Catalog StatTrak/Souvenir flags indicate availability, not a selected filter.
Vanilla knives have null paint indexes and use a name filter instead; that fallback
targets the catalog's normal base name. A StatTrak vanilla query needs its own exact
market name. Missing catalog float bounds remain null.

Refresh from the public source:

```sh
node scripts/update-skin-catalog.mjs
```

Or supply a downloaded `skins.json` path as the first argument for an offline
refresh. Review the generated diff and run `npm run build` after updating.
