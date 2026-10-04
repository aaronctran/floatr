const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Execute the actual TypeScript modules with in-memory Chrome/network adapters.
function harness(overrides = {}) {
  let now = Date.now();
  class ClockDate extends Date { static now() { return now; } }
  const db = {};
  const sessionDb = overrides.sessionDb ?? {};
  const listeners = [];
  const requests = [];
  const alarms = new Map();
  const notifications = [];
  let alarmHandler;
  let messageHandler;
  const event = { addListener() {} };
  const chrome = {
    storage: {
      session: {
        async get(key) { return { [key]: structuredClone(sessionDb[key]) }; },
        async set(values) {
          const changes = {};
          for (const [key, value] of Object.entries(values)) {
            changes[key] = { oldValue: sessionDb[key], newValue: structuredClone(value) };
            sessionDb[key] = structuredClone(value);
          }
          listeners.forEach((listener) => listener(changes, 'session'));
        },
      },
      local: {
        async get(key) { return { [key]: structuredClone(db[key]) }; },
        async set(values) {
          await new Promise((resolve) => setImmediate(resolve));
          const changes = {};
          for (const [key, value] of Object.entries(values)) {
            changes[key] = { oldValue: db[key], newValue: structuredClone(value) };
            db[key] = structuredClone(value);
          }
          listeners.forEach((listener) => listener(changes, 'local'));
        },
      },
      onChanged: { addListener: (fn) => listeners.push(fn) },
    },
    runtime: {
      onInstalled: event,
      onStartup: event,
      onMessage: { addListener: (fn) => { messageHandler = fn; } },
      sendMessage: (message) => new Promise((resolve) => messageHandler(message, {}, resolve)),
    },
    alarms: {
      onAlarm: { addListener: (fn) => { alarmHandler = fn; } },
      async get(name) { return alarms.get(name); },
      async clear(name) { alarms.delete(name); },
      async create(name, info) { alarms.set(name, { name, ...info, scheduledTime: info.when ?? now + info.periodInMinutes * 60000 }); },
    },
    notifications: { onClicked: event, async create(id) { notifications.push(id); } },
    action: { async setBadgeText() {}, async setBadgeBackgroundColor() {} },
  };
  const cache = new Map();
  const context = vm.createContext({
    chrome, URL, AbortController, setTimeout, clearTimeout,
    console: { log() {}, warn() {}, error() {} },
    fetch: async (url) => {
      requests.push(new URL(url));
      return { ok: true, status: 200, text: async () => JSON.stringify({ data: [] }) };
    },
    ...overrides,
    Date: ClockDate,
    // Advance the pacing clock without delaying the regression suite in real time.
    setTimeout: (fn, delay) => delay === 2000
      ? setImmediate(() => { now += delay; fn(); })
      : (overrides.setTimeout ?? setTimeout)(fn, delay),
  });
  function load(relative) {
    const filename = path.resolve(relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const localRequire = (name) => {
      if (overrides.modules?.[name]) return overrides.modules[name];
      if (!name.startsWith('.')) return require(name);
      const target = path.resolve(path.dirname(filename), name);
      return load(fs.existsSync(target + '.ts') ? target + '.ts' : target + '.tsx');
    };
    vm.runInContext(`(function(require,module,exports){${source}\n})`, context, { filename })(localRequire, module, module.exports);
    return module.exports;
  }
  const fireAlarm = async () => {
    const alarm = alarms.get('floatr-poll');
    assert.ok(alarm, 'a recurring scan must be scheduled');
    now = Math.max(now, alarm.scheduledTime);
    alarm.scheduledTime += alarm.periodInMinutes * 60000;
    await alarmHandler(alarm);
  };
  return { db, sessionDb, chrome, context, requests, load, alarms, fireAlarm, notifications, advance: (ms) => { now += ms; }, now: () => now };
}
const plain = (value) => JSON.parse(JSON.stringify(value));
const listing = (id, name) => ({ id, price: 100, item: { market_hash_name: name, float_value: 0.02 } });

test('rapid autosaves preserve the final raw draft and merge start settings', async () => {
  const h = harness();
  const storage = h.load('src/services/storage.ts');
  const writes = ['m', 'm4a4 ', 'm4a4 poseidon fn\n'].map((text) => storage.setSettings({ watchlist: text.split('\n') }));
  writes.push(storage.setSettings({ enabled: true }));
  await Promise.all(writes);
  const saved = await storage.getSettings();
  assert.equal(saved.watchlist.join('\n'), 'm4a4 poseidon fn\n');
  assert.equal(saved.enabled, true);
});

test('scan, preview and saved cards all obey the watchlist; empty watchlist uses recent listings', async () => {
  const h = harness();
  const storage = h.load('src/services/storage.ts');
  h.load('src/background/background.ts');
  const wanted = listing('wanted', 'M4A4 | Poseidon (Factory New)');
  const other = listing('other', 'AK-47 | Redline (Field-Tested)');
  h.context.fetch = async (url) => {
    h.requests.push(new URL(url));
    return { ok: true, status: 200, text: async () => JSON.stringify([wanted, other]) };
  };
  await storage.setSettings({ watchlist: ['m4a4 poseidon fn'], enabled: true });
  const scan = await h.chrome.runtime.sendMessage({ action: 'poll-now' });
  assert.equal(scan.ok, true);
  assert.equal(scan.result.listingsChecked, 1);
  assert.equal(h.requests[0].searchParams.get('market_hash_name'), wanted.item.market_hash_name);
  const preview = await h.chrome.runtime.sendMessage({ action: 'preview-listings', limit: 5 });
  assert.deepEqual(plain(preview.listings.map((item) => item.id)), ['wanted']);
  h.db.dealLog.push({ id: 'old', marketHashName: other.item.market_hash_name });
  const cards = await h.chrome.runtime.sendMessage({ action: 'get-deals' });
  assert.deepEqual(plain(cards.deals.map((item) => item.id)), ['wanted']);
  await storage.setSettings({ watchlist: [' ', ''] });
  await h.chrome.runtime.sendMessage({ action: 'preview-listings' });
  assert.equal(h.requests.at(-1).searchParams.has('market_hash_name'), false);
});

test('empty bodies and API failures surface as scan errors, not successful empty scans', async () => {
  const h = harness();
  const storage = h.load('src/services/storage.ts');
  h.load('src/background/background.ts');
  await storage.setSettings({ watchlist: ['ak redline ft'], enabled: true });
  h.context.fetch = async () => ({ ok: true, status: 200, text: async () => '' });
  const result = await h.chrome.runtime.sendMessage({ action: 'poll-now' });
  assert.equal(result.ok, false);
  assert.match(result.error, /empty response body/);
});

test('wearless and canonical StatTrak names match only the requested variants', () => {
  const h = harness();
  const { matchesWatchlist } = h.load('src/services/watchlist.ts');
  assert.equal(matchesWatchlist('AK-47 | Redline (Minimal Wear)', ['ak redline']), true);
  assert.equal(matchesWatchlist('AK-47 | Redline (Minimal Wear)', ['ak redline ft']), false);
  assert.equal(matchesWatchlist('StatTrak™ AK-47 | Redline (Field-Tested)', ['st ak redline ft']), true);
  assert.equal(matchesWatchlist('StatTrak™ AK-47 | Redline (Field-Tested)', ['StatTrak™ AK-47 | Redline (Field-Tested)']), true);
  assert.equal(matchesWatchlist('AK-47 | Redline (Field-Tested)', ['unknown skin']), false);
});

test('settings draft survives remount and Start Scanning persists edits before polling', async () => {
  let states = [], index = 0, effects = [], mounted = false;
  const react = {
    useState(initial) {
      const slot = index++;
      if (!(slot in states)) states[slot] = initial;
      return [states[slot], (value) => { states[slot] = typeof value === 'function' ? value(states[slot]) : value; }];
    },
    useEffect(fn) { if (!mounted) effects.push(fn); },
    useCallback(fn) { return fn; },
  };
  const h = harness({ modules: { react } });
  const storage = h.load('src/services/storage.ts');
  const Component = h.load('src/popup/components/FiltersTab.tsx').default;
  const render = () => { index = 0; const tree = Component(); mounted = true; effects.splice(0).forEach((fn) => fn()); return tree; };
  const find = (node, predicate) => {
    if (!node || typeof node !== 'object') return;
    if (predicate(node)) return node;
    for (const child of [node.props?.children].flat(Infinity)) {
      const found = find(child, predicate);
      if (found) return found;
    }
  };
  render();
  await new Promise((resolve) => setImmediate(resolve));
  let tree = render();
  const draft = 'm4a4 poseidon fn\n';
  find(tree, (node) => node.type?.name === 'WatchlistInput').props.onChange(draft);
  await storage.getSettings();
  states = []; mounted = false; // Simulate leaving and returning to the form.
  render();
  await new Promise((resolve) => setImmediate(resolve));
  tree = render();
  assert.equal(find(tree, (node) => node.type?.name === 'WatchlistInput').props.value, draft);
  find(tree, (node) => node.type?.name === 'WatchlistInput').props.onChange('ak redline ft');
  tree = render();
  let settingsAtPoll;
  h.chrome.runtime.sendMessage = async () => {
    settingsAtPoll = structuredClone(h.db.settings);
    return { ok: true };
  };
  const start = find(tree, (node) => node.type === 'button' && node.props.children?.includes('Start Scanning'));
  await start.props.onClick();
  assert.equal(settingsAtPoll.enabled, true);
  assert.equal(settingsAtPoll.watchlist.join('\n'), 'ak redline ft');
});

test('API adapter accepts bare arrays and wrapped listings and rejects invalid shapes', async () => {
  const h = harness();
  const { fetchListings } = h.load('src/services/csfloatApi.ts');
  const wanted = listing('one', 'M4A4 | Poseidon (Factory New)');
  for (const payload of [[wanted], { data: [wanted], cursor: 'next' }]) {
    h.context.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify(payload) });
    assert.deepEqual(plain((await fetchListings({})).data), [wanted]);
  }
  h.context.fetch = async () => ({ ok: true, status: 200, text: async () => '{}' });
  await assert.rejects(fetchListings({}), /unexpected listings response/);
});

test('recurring alarms refresh prices, add new deals, remove stale cards, and do not renotify old deals', async () => {
  const h = harness();
  const storage = h.load('src/services/storage.ts');
  await storage.setSettings({ enabled: true, pollIntervalMinutes: 3 });
  h.load('src/background/background.ts');
  let data = [listing('old', 'M4A4 | Poseidon (Factory New)')];
  h.context.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ data }) });
  await h.chrome.runtime.sendMessage({ action: 'poll-now' });
  assert.equal(h.alarms.get('floatr-poll').periodInMinutes, 3);
  data = [{ ...data[0], price: 250 }, listing('new', 'M4A4 | Poseidon (Factory New)')];
  await h.fireAlarm();
  assert.deepEqual(h.db.dealLog.map((deal) => [deal.id, deal.priceCents]), [['old', 250], ['new', 100]]);
  assert.deepEqual(h.notifications, ['old', 'new']);
  assert.equal(h.db.scanStatus.listingsChecked, 2);
  assert.ok(h.db.scanStatus.lastCompletedAt);
  assert.equal(h.db.scanStatus.nextScanAt, h.alarms.get('floatr-poll').scheduledTime);
  // An already-seen listing is reassessed and removed when it no longer qualifies.
  data = [{ ...data[0], item: { ...data[0].item, float_value: 0.9 } }];
  await h.fireAlarm();
  assert.deepEqual(h.db.dealLog, []);
  data = [];
  await h.fireAlarm();
  assert.equal(h.db.scanStatus.dealsFound, 0);
  assert.equal(h.db.scanStatus.listingsChecked, 0);
});

test('alarm repair preserves deadlines, honors changed intervals through 60 minutes, and stops when disabled', async () => {
  const h = harness();
  const storage = h.load('src/services/storage.ts');
  const { syncPollingAlarm } = h.load('src/services/pollingSchedule.ts');
  await storage.setSettings({ enabled: true, pollIntervalMinutes: 3 });
  await syncPollingAlarm();
  const deadline = h.alarms.get('floatr-poll').scheduledTime;
  await syncPollingAlarm();
  assert.equal(h.alarms.get('floatr-poll').scheduledTime, deadline);
  h.alarms.clear(); // Simulate loss of the alarm between worker starts.
  await syncPollingAlarm();
  assert.equal(h.alarms.get('floatr-poll').periodInMinutes, 3);
  await storage.setSettings({ pollIntervalMinutes: 60 });
  await syncPollingAlarm();
  assert.equal(h.alarms.get('floatr-poll').periodInMinutes, 60);
  await storage.setSettings({ enabled: false });
  await syncPollingAlarm();
  assert.equal(h.alarms.size, 0);
  assert.equal(h.db.scanStatus.nextScanAt, null);
});

test('scheduled failures preserve the last successful snapshot and retry on the configured interval', async () => {
  const h = harness();
  const storage = h.load('src/services/storage.ts');
  await storage.setSettings({ enabled: true, pollIntervalMinutes: 3 });
  h.load('src/background/background.ts');
  const data = [listing('kept', 'M4A4 | Poseidon (Factory New)')];
  h.context.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify(data) });
  await h.chrome.runtime.sendMessage({ action: 'poll-now' });
  const completed = h.db.scanStatus.lastCompletedAt;
  h.context.fetch = async () => ({ ok: false, status: 403, text: async () => 'Authentication failed' });
  for (let i = 0; i < 3; i++) await h.fireAlarm();
  assert.equal(h.db.dealLog[0].id, 'kept');
  assert.equal(h.db.scanStatus.lastCompletedAt, completed);
  assert.equal(h.db.scanStatus.running, false);
  assert.match(h.db.scanStatus.error, /403/);
  assert.equal(h.alarms.get('floatr-poll').periodInMinutes, 3);
});

test('manual and scheduled scans share in-flight work; stopping discards pending results', async () => {
  const h = harness();
  const storage = h.load('src/services/storage.ts');
  await storage.setSettings({ enabled: true });
  h.load('src/background/background.ts');
  let release, started, calls = 0;
  const pending = new Promise((resolve) => { release = resolve; });
  const fetched = new Promise((resolve) => { started = resolve; });
  h.context.fetch = async () => {
    calls++;
    started();
    await pending;
    return { ok: true, status: 200, text: async () => JSON.stringify([listing('late', 'M4A4 | Poseidon (Factory New)')]) };
  };
  const manual = h.chrome.runtime.sendMessage({ action: 'poll-now' });
  await fetched;
  const scheduled = h.fireAlarm();
  await storage.setSettings({ enabled: false });
  release();
  await Promise.all([manual, scheduled]);
  assert.equal(calls, 1);
  assert.equal(h.db.dealLog, undefined);
  assert.equal(h.db.scanStatus.running, false);
});

test('catalog autocomplete supports aliases, valid wears and canonical punctuation', () => {
  const h = harness();
  const watch = h.load('src/services/watchlist.ts');
  assert.ok(watch.suggestWatchSkins('ak redl').includes('AK-47 | Redline'));
  assert.ok(watch.suggestWatchSkins('m4a4 pose').includes('M4A4 | Poseidon'));
  assert.equal(watch.suggestWatchSkins('kara doppler').filter((name) => name === '★ Karambit | Doppler').length, 1);
  assert.equal(watch.suggestWatchSkins('nonsense').length, 0);
  assert.ok(watch.suggestWatchSkins('st ak redl ft').includes('StatTrak™ AK-47 | Redline (Field-Tested)'));
  assert.equal(watch.normalizeWatchItem('awp neo noir ft').normalized, 'AWP | Neo-Noir (Field-Tested)');
  assert.equal(watch.expandWatchQueries('ak redline').includes('AK-47 | Redline (Factory New)'), false);
  assert.equal(watch.expandWatchQueries('★ Karambit')[0], '★ Karambit');
  assert.equal(watch.replaceWatchlistLine('ak red\nawp asiimov', 6, 'AK-47 | Redline').text, 'AK-47 | Redline\nawp asiimov');
  assert.equal(watch.replaceWatchlistLine('\nawp asiimov', 0, 'AK-47 | Redline').text, 'AK-47 | Redline\nawp asiimov');
});

test('every watched skin is queried and later skins are not truncated from stored deals', async () => {
  const h = harness();
  const storage = h.load('src/services/storage.ts');
  const catalog = h.load('src/constants/skins.ts').SKIN_CATALOG;
  const names = [...new Set(catalog.filter((skin) => skin.wears.includes('Factory New')).map((skin) => `${skin.name} (Factory New)`))].slice(0, 12);
  await storage.setSettings({ enabled: true, watchlist: [...names, names[0]], maxListingsPerPoll: 10 });
  h.load('src/background/background.ts');
  const queried = [];
  h.context.fetch = async (url) => {
    const name = new URL(url).searchParams.get('market_hash_name');
    queried.push(name);
    return { ok: true, status: 200, text: async () => JSON.stringify({ data: Array.from({ length: 6 }, (_, i) => listing(`${name}-${i}`, name)) }) };
  };
  const response = await h.chrome.runtime.sendMessage({ action: 'poll-now' });
  assert.equal(response.ok, true);
  assert.deepEqual(queried, names);
  assert.equal(h.db.dealLog.length, 72);
  assert.equal(h.load('src/services/dealGroups.ts').groupDealsBySkin(h.db.dealLog).length, 12);
});

test('watchlist additions during an in-flight scan queue a follow-up covering both skins', { timeout: 5000 }, async () => {
  let debounce;
  const token = {};
  const h = harness({
    setTimeout: (fn, delay) => delay === 1000 ? (debounce = fn, token) : setTimeout(fn, delay),
    clearTimeout: (id) => id === token ? (debounce = undefined) : clearTimeout(id),
  });
  const storage = h.load('src/services/storage.ts');
  await storage.setSettings({ enabled: true, watchlist: ['m4a4 poseidon fn'] });
  h.load('src/background/background.ts');
  let release, started;
  const pending = new Promise((resolve) => { release = resolve; });
  const fetched = new Promise((resolve) => { started = resolve; });
  const queried = [];
  h.context.fetch = async (url) => {
    const name = new URL(url).searchParams.get('market_hash_name');
    queried.push(name);
    if (queried.length === 1) { started(); await pending; }
    return { ok: true, status: 200, text: async () => JSON.stringify([listing(name, name)]) };
  };
  const initial = h.chrome.runtime.sendMessage({ action: 'poll-now' });
  await fetched;
  await storage.setSettings({ watchlist: ['m4a4 poseidon fn', 'ak redline ft'] });
  assert.equal(typeof debounce, 'function');
  const finished = new Promise((resolve) => h.chrome.storage.onChanged.addListener((changes) => {
    if (changes.scanStatus?.newValue?.dealsFound === 2) resolve();
  }));
  debounce();
  release();
  await initial;
  await finished;
  assert.deepEqual(h.db.dealLog.map((deal) => deal.marketHashName), ['M4A4 | Poseidon (Factory New)', 'AK-47 | Redline (Field-Tested)']);
  assert.equal(queried.length, 3);
  // An idle scanner also refreshes without waiting for the next recurring alarm.
  await storage.setSettings({ watchlist: ['m4a4 poseidon fn', 'ak redline ft', 'awp asiimov ft'] });
  const refreshed = new Promise((resolve) => h.chrome.storage.onChanged.addListener((changes) => {
    if (changes.scanStatus?.newValue?.dealsFound === 3) resolve();
  }));
  debounce();
  await refreshed;
  assert.equal(h.db.dealLog.length, 3);
  assert.ok(queried.includes('AWP | Asiimov (Field-Tested)'));
});

test('deal groups consolidate variants, deduplicate previews, and sort by price', () => {
  const h = harness();
  const { groupDealsBySkin } = h.load('src/services/dealGroups.ts');
  const deal = (id, name, priceCents) => ({ id, marketHashName: name, priceCents });
  const groups = groupDealsBySkin([
    deal('a', 'AK-47 | Redline (Field-Tested)', 200),
    deal('b', 'StatTrak™ AK-47 | Redline (Minimal Wear)', 100),
    deal('a', 'AK-47 | Redline (Field-Tested)', 200),
    deal('c', 'M4A4 | Poseidon (Factory New)', 300),
  ]);
  assert.deepEqual(plain(groups.map((group) => [group.name, group.deals.map((item) => item.id)])), [
    ['AK-47 | Redline', ['b', 'a']], ['M4A4 | Poseidon', ['c']],
  ]);
});

test('groups and their listings rank by strongest saved deal signals rather than name or price alone', () => {
  const h = harness();
  const { groupDealsBySkin, compareDeals } = h.load('src/services/dealGroups.ts');
  const deal = (id, name, priceCents, reasons) => ({ id, marketHashName: name, priceCents, reasons });
  const sticker = (ratio) => [{ type: 'sticker_arbitrage', stickerRatio: ratio }];
  const groups = groupDealsBySkin([
    deal('cheap', 'AK-47 | Redline (Field-Tested)', 100, sticker(0.5)),
    deal('strong', 'M4A4 | Poseidon (Factory New)', 1000, sticker(0.9)),
    deal('stronger', 'M4A4 | Poseidon (Minimal Wear)', 2000, sticker(1.2)),
    deal('preview', 'AWP | Asiimov (Field-Tested)', 1, [{ type: 'api_test' }]),
  ]);
  assert.deepEqual(plain(groups.map((group) => group.name)), ['M4A4 | Poseidon', 'AK-47 | Redline', 'AWP | Asiimov']);
  assert.deepEqual(plain(groups[0].deals.map((item) => item.id)), ['stronger', 'strong']);
  assert.ok(compareDeals(deal('a', 'A', 100, sticker(0.7)), deal('b', 'B', 200, sticker(0.7))) < 0);
  const floatOnly = deal('float', 'A', 100, [{ type: 'rare_float' }]);
  assert.ok(compareDeals(floatOnly, deal('preview', 'B', 1, [{ type: 'api_test' }])) < 0);
  assert.ok(Number.isFinite(compareDeals(deal('a', 'A', NaN, sticker(NaN)), deal('b', 'B', Infinity, sticker(Infinity)))));
});

test('autocomplete keyboard and click selection replace only the active line', () => {
  let states = [], index = 0;
  const react = {
    useId: () => 'suggestions',
    useState(initial) {
      const slot = index++;
      if (!(slot in states)) states[slot] = initial;
      return [states[slot], (value) => { states[slot] = typeof value === 'function' ? value(states[slot]) : value; }];
    },
    useRef(initial) { return react.useState({ current: initial })[0]; },
  };
  const h = harness({ modules: { react }, requestAnimationFrame: (fn) => fn() });
  const Input = h.load('src/popup/components/WatchlistInput.tsx').default;
  let value = 'ak red\nawp asiimov';
  const render = () => { index = 0; return Input({ value, onChange: (text) => { value = text; } }); };
  const nodes = (node) => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
  let tree = render();
  const textarea = () => nodes(tree).find((node) => node.type === 'textarea');
  textarea().props.onChange({ target: { value, selectionStart: 6 } });
  tree = render();
  const options = nodes(tree).filter((node) => node.props?.role === 'option');
  assert.ok(options.length > 1);
  let prevented = false;
  textarea().props.onKeyDown({ key: 'ArrowDown', preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  tree = render();
  textarea().props.onKeyDown({ key: 'Enter', preventDefault() {} });
  assert.equal(value, options[1].props.children + '\nawp asiimov');
  tree = render();
  assert.equal(textarea().props['aria-expanded'], false);

  // Click a suggestion while editing the second line.
  value = value.split('\n')[0] + '\nm4a4 pose';
  textarea().props.onChange({ target: { value, selectionStart: value.length } });
  tree = render();
  const option = nodes(tree).find((node) => node.props?.role === 'option');
  option.props.onClick();
  assert.equal(value, options[1].props.children + '\nM4A4 | Poseidon');
  tree = render();
  const boxes = () => nodes(tree).filter((node) => node.props?.type === 'checkbox');
  assert.equal(boxes().length, 2);
  boxes()[1].props.onChange();
  assert.equal(value, options[1].props.children + '\n! M4A4 | Poseidon');
  tree = render();
  assert.equal(boxes()[1].props.checked, false);
  boxes()[1].props.onChange();
  assert.equal(value, options[1].props.children + '\nM4A4 | Poseidon');
});

test('ignored watchlist entries survive normalization and exclude overlapping wears', () => {
  const h = harness();
  const watch = h.load('src/services/watchlist.ts');
  const saved = watch.normalizeWatchlist(['ak redline', '! ak redline ft']).map((entry) => entry.normalized);
  assert.equal(saved[1], '! AK-47 | Redline (Field-Tested)');
  assert.equal(watch.matchesWatchlist('AK-47 | Redline (Field-Tested)', saved), false);
  assert.equal(watch.matchesWatchlist('AK-47 | Redline (Minimal Wear)', saved), true);
  assert.equal(watch.matchesWatchlist('AK-47 | Redline (Minimal Wear)', ['! ak redline']), false);
  assert.equal(watch.matchesWatchlist('AK-47 | Redline (Minimal Wear)', []), true);
  assert.ok(watch.suggestWatchSkins('! ak red').every((name) => name.startsWith('! ')));
});

test('ignored skins are hidden immediately, skipped by requests, and restorable without firehose fallback', async () => {
  const h = harness();
  const storage = h.load('src/services/storage.ts');
  h.load('src/background/background.ts');
  const wanted = listing('wanted', 'M4A4 | Poseidon (Factory New)');
  const ignored = listing('ignored', 'AK-47 | Redline (Field-Tested)');
  h.context.fetch = async (url) => {
    h.requests.push(new URL(url));
    return { ok: true, status: 200, text: async () => JSON.stringify([wanted, ignored]) };
  };
  await storage.replaceDealLog([wanted, ignored].map((item) => ({ id: item.id, marketHashName: item.item.market_hash_name })));
  await storage.setSettings({ enabled: true, watchlist: ['m4a4 poseidon fn', '! ak redline ft'] });
  assert.deepEqual(plain((await h.chrome.runtime.sendMessage({ action: 'get-deals' })).deals.map((deal) => deal.id)), ['wanted']);
  await h.chrome.runtime.sendMessage({ action: 'poll-now' });
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].searchParams.get('market_hash_name'), wanted.item.market_hash_name);
  assert.deepEqual(h.notifications, ['wanted']);
  await storage.setSettings({ watchlist: ['! m4a4 poseidon fn', '! ak redline ft'] });
  await h.chrome.runtime.sendMessage({ action: 'poll-now' });
  assert.equal(h.requests.length, 1, 'all ignored must make no API requests');
  assert.deepEqual(plain(await storage.getDealLog()), []);
  const restored = h.load('src/services/watchlist.ts').toggleIgnoredWatchLine((await storage.getSettings()).watchlist.join('\n'), 1);
  await storage.setSettings({ watchlist: restored.split('\n') });
  await h.chrome.runtime.sendMessage({ action: 'poll-now' });
  assert.equal(h.requests.at(-1).searchParams.get('market_hash_name'), ignored.item.market_hash_name);
  assert.deepEqual(plain((await storage.getDealLog()).map((deal) => deal.id)), ['ignored']);
});

test('scan and preview API calls share a serial queue with two-second spacing', async () => {
  const h = harness();
  const api = h.load('src/services/csfloatApi.ts');
  const starts = [];
  let inFlight = 0, peak = 0;
  h.context.fetch = async () => {
    starts.push(h.now());
    peak = Math.max(peak, ++inFlight);
    return { ok: true, status: 200, text: async () => {
      await new Promise((resolve) => setImmediate(resolve));
      inFlight--;
      return '{"data":[]}';
    } };
  };
  await Promise.all([
    api.fetchRecentListings({ limit: 5 }),
    api.fetchWatchedItemListings('AK-47 | Redline (Field-Tested)', { limit: 20 }),
    api.fetchRecentListings({ limit: 1 }),
  ]);
  assert.equal(peak, 1);
  assert.equal(starts.length, 3);
  assert.ok(starts[1] - starts[0] >= 2000);
  assert.ok(starts[2] - starts[1] >= 2000);
});

test('Retry-After supports seconds and HTTP dates, with safe invalid-header fallback', () => {
  const h = harness();
  const { retryAfterTime } = h.load('src/services/requestPacing.ts');
  const now = h.now();
  assert.equal(retryAfterTime('120', now), now + 120000);
  const date = new Date(now + 600000).toUTCString();
  assert.equal(retryAfterTime(date, now), Date.parse(date));
  assert.equal(retryAfterTime('invalid', now), 0);
  assert.equal(retryAfterTime(null, now), 0);
});

test('429 stops scanning, clears the alarm and retains deals and cooldown until manual restart', async () => {
  const h = harness();
  const storage = h.load('src/services/storage.ts');
  await storage.setSettings({ enabled: true, watchlist: ['m4a4 poseidon fn', 'ak redline ft'], pollIntervalMinutes: 3 });
  h.db.dealLog = [{ id: 'previous', marketHashName: 'M4A4 | Poseidon (Factory New)' }];
  h.load('src/background/background.ts');
  let calls = 0;
  h.context.fetch = async () => {
    calls++;
    return { ok: false, status: 429, headers: { get: () => '600' } };
  };
  const first = await h.chrome.runtime.sendMessage({ action: 'poll-now' });
  assert.equal(first.ok, false);
  assert.equal(calls, 1);
  assert.equal(h.db.dealLog[0].id, 'previous');
  const cooldown = h.db.csfloatRequestState.cooldownUntil;
  assert.ok(cooldown >= h.now() + 600000);
  assert.equal(h.db.settings.enabled, false);
  assert.equal(h.alarms.has('floatr-poll'), false);
  assert.equal(h.db.scanStatus.nextScanAt, null);
  await h.chrome.runtime.sendMessage({ action: 'preview-listings' });
  await storage.setSettings({ enabled: true });
  await h.chrome.runtime.sendMessage({ action: 'poll-now' });
  assert.equal(h.db.settings.enabled, false, 'starting during cooldown must return to the stopped state');
  assert.equal(calls, 1, 'cooldown must block manual requests and previews');
  h.context.fetch = async (url) => {
    calls++;
    const name = new URL(url).searchParams.get('market_hash_name');
    return { ok: true, status: 200, text: async () => JSON.stringify([listing(name, name)]) };
  };
  h.advance(cooldown - h.now() + 1);
  assert.equal(h.db.settings.enabled, false, 'cooldown expiry must not restart scanning');
  await storage.setSettings({ enabled: true });
  await h.chrome.runtime.sendMessage({ action: 'poll-now' });
  assert.equal(calls, 3);
  assert.equal(h.db.dealLog.length, 2);
  assert.equal(h.db.csfloatRequestState.rateLimitCount, 0);
  assert.equal(h.db.scanStatus.error, null);
});

for (const componentPath of ['src/popup/components/FiltersTab.tsx']) {
  test(`${componentPath}: background stop changes the button without losing unsaved edits`, async () => {
    let states = [], index = 0, effects = [], mounted = false;
    const react = {
      useState(initial) {
        const slot = index++;
        if (!(slot in states)) states[slot] = initial;
        return [states[slot], (value) => { states[slot] = typeof value === 'function' ? value(states[slot]) : value; }];
      },
      useEffect(fn) { if (!mounted) effects.push(fn); },
      useCallback(fn) { return fn; },
    };
    const h = harness({ modules: { react } });
    const storage = h.load('src/services/storage.ts');
    await storage.setSettings({ enabled: true });
    const Component = h.load(componentPath).default;
    const render = () => { index = 0; const tree = Component(); mounted = true; effects.splice(0).forEach((fn) => fn()); return tree; };
    const nodes = (node) => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
    render();
    await new Promise((resolve) => setImmediate(resolve));
    let tree = render();
    assert.ok(nodes(tree).some((node) => node.type === 'button' && node.props.children?.includes('Stop Scanning')));
    nodes(tree).find((node) => node.type === 'button' && node.props.children === 'Strict').props.onClick();
    await storage.setSettings({ enabled: false });
    tree = render();
    assert.ok(nodes(tree).some((node) => node.type === 'button' && node.props.children?.includes('Start Scanning')));
    assert.equal(states[0].sensitivity, 'strict');
    await storage.setSettings({ apiKey: 'updated-in-settings-tab' });
    const save = nodes(tree).find((node) => node.type === 'button' && node.props.children?.includes('Save Filters'));
    await save.props.onClick();
    assert.equal(h.db.settings.enabled, false, 'saving edits must not restart a stopped scanner');
    assert.equal(h.db.settings.sensitivity, 'strict');
    assert.equal(h.db.settings.apiKey, 'updated-in-settings-tab', 'saving filters must not overwrite a separately saved API key');
  });
}

test('queued calls and restarted workers respect persisted cooldown; fallback increases on repeated 429s', async () => {
  const h = harness();
  const api = h.load('src/services/csfloatApi.ts');
  let calls = 0;
  h.context.fetch = async () => { calls++; return { ok: false, status: 429 }; };
  const results = await Promise.allSettled([api.fetchListings({}), api.fetchListings({})]);
  assert.equal(calls, 1);
  assert.ok(results.every((result) => result.status === 'rejected' && result.reason.name === 'CSFloatRateLimitError'));
  assert.equal(h.db.csfloatRequestState.cooldownUntil - h.now(), 60000);
  const restarted = harness();
  restarted.db.csfloatRequestState = structuredClone(h.db.csfloatRequestState);
  const restartedApi = restarted.load('src/services/csfloatApi.ts');
  await assert.rejects(restartedApi.fetchListings({}), { name: 'CSFloatRateLimitError' });
  assert.equal(restarted.requests.length, 0);
  h.advance(60001);
  await assert.rejects(api.fetchListings({}), { name: 'CSFloatRateLimitError' });
  assert.equal(calls, 2);
  assert.equal(h.db.csfloatRequestState.cooldownUntil - h.now(), 120000);
  h.advance(120001);
  h.context.fetch = async () => ({ ok: true, status: 200, text: async () => '[]' });
  await api.fetchListings({});
  assert.equal(h.db.csfloatRequestState.rateLimitCount, 0);
});

test('individual hides survive polls and worker restarts without hiding other listings of the same skin', async () => {
  const h = harness();
  const storage = h.load('src/services/storage.ts');
  h.load('src/background/background.ts');
  const a = listing('a', 'AK-47 | Redline (Field-Tested)');
  const b = listing('b', 'M4A4 | Poseidon (Factory New)');
  let payload = [a, b];
  h.context.fetch = async () => ({ ok: true, text: async () => JSON.stringify(payload) });
  await storage.setSettings({ enabled: true });
  await h.chrome.runtime.sendMessage({ action: 'poll-now' });
  await Promise.all([
    h.chrome.runtime.sendMessage({ action: 'dismiss-deal', id: 'a' }),
    h.chrome.runtime.sendMessage({ action: 'dismiss-deal', id: 'b' }),
  ]);
  payload.push(listing('same-skin', 'M4A4 | Poseidon (Factory New)'));
  h.sessionDb.dismissedDeals.skins = ['m4a4 | poseidon']; // Older group hides must no longer apply.
  await h.chrome.runtime.sendMessage({ action: 'poll-now' });
  assert.deepEqual(plain((await h.chrome.runtime.sendMessage({ action: 'get-deals' })).deals.map((deal) => deal.id)), ['same-skin']);
  assert.deepEqual(h.notifications, ['a', 'b', 'same-skin']);
  const restarted = harness({ sessionDb: h.sessionDb });
  Object.assign(restarted.db, structuredClone(h.db));
  restarted.load('src/background/background.ts');
  assert.deepEqual(plain((await restarted.chrome.runtime.sendMessage({ action: 'get-deals' })).deals.map((deal) => deal.id)), ['same-skin']);
  const fresh = harness();
  Object.assign(fresh.db, structuredClone(h.db));
  fresh.load('src/background/background.ts');
  assert.equal((await fresh.chrome.runtime.sendMessage({ action: 'get-deals' })).deals.length, 3);
  await h.chrome.runtime.sendMessage({ action: 'restore-dismissed-deals' });
  assert.equal((await h.chrome.runtime.sendMessage({ action: 'get-deals' })).deals.length, 3);
});

test('sticker filter uses presence rather than valuation, updates saved deals and gates notifications', async () => {
  const h = harness();
  const storage = h.load('src/services/storage.ts');
  h.load('src/background/background.ts');
  const withSticker = listing('with', 'AK-47 | Redline (Field-Tested)');
  withSticker.item.stickers = [{ name: 'Unpriced sticker' }];
  const withoutSticker = listing('without', 'M4A4 | Poseidon (Factory New)');
  withoutSticker.item.stickers = [];
  const absent = listing('absent', 'AWP | Asiimov (Field-Tested)');
  h.context.fetch = async () => ({ ok: true, text: async () => JSON.stringify([withSticker, withoutSticker, absent]) });
  await storage.setSettings({ enabled: true, stickerFilter: 'without' });
  await h.chrome.runtime.sendMessage({ action: 'poll-now' });
  const ids = async () => plain((await h.chrome.runtime.sendMessage({ action: 'get-deals' })).deals.map((deal) => deal.id));
  assert.deepEqual(await ids(), ['without', 'absent']);
  assert.deepEqual(h.notifications, ['without', 'absent']);
  await storage.setSettings({ stickerFilter: 'with' });
  assert.deepEqual(await ids(), ['with']);
  await h.chrome.runtime.sendMessage({ action: 'poll-now' });
  assert.deepEqual(h.notifications, ['without', 'absent', 'with']);
  await storage.setSettings({ stickerFilter: 'all' });
  assert.equal((await ids()).length, 3);
});

test('wear presets and float sliders update both bounds and prevent inverted ranges', () => {
  const h = harness();
  const Input = h.load('src/popup/components/FloatRangeInput.tsx').default;
  let range = { minFloat: 0, maxFloat: 0.15, selectedWears: [] };
  const render = () => Input({ min: range.minFloat, max: range.maxFloat, selectedWears: range.selectedWears, onChange: (next) => { range = next; } });
  const nodes = (node) => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
  let tree = render();
  const presets = nodes(tree).filter((node) => node.type === 'button');
  assert.equal(presets.length, 5);
  presets[2].props.onClick();
  assert.deepEqual(plain(range), { minFloat: 0.15, maxFloat: 0.38, selectedWears: ['FT'] });
  tree = render();
  assert.equal(nodes(tree).find((node) => node.props?.['aria-label'] === 'Field-Tested (FT)').props['aria-pressed'], true);
  const bound = (label) => nodes(tree).find((node) => node.props?.['aria-label'] === label);
  bound('Minimum float').props.onChange({ target: { valueAsNumber: 0.2 } });
  tree = render();
  assert.equal(nodes(tree).filter((node) => node.props?.['aria-pressed'] === true).length, 1);
  assert.equal(bound('Minimum float').props['aria-valuetext'], '0.2000');
  bound('Maximum float').props.onChange({ target: { valueAsNumber: 0.1 } });
  assert.deepEqual(plain(range), { minFloat: 0.2, maxFloat: 0.2, selectedWears: ['FT'] });
  tree = render();
  bound('Maximum float exact value').props.onChange({ target: { valueAsNumber: 0.234567 } });
  assert.equal(range.maxFloat, 0.234567);
  tree = render();
  bound('Minimum float exact value').props.onChange({ target: { valueAsNumber: NaN } });
  assert.equal(range.minFloat, 0.2);
  tree = render();
  nodes(tree).find((node) => node.props?.['aria-label'] === 'Factory New (FN)').props.onClick();
  assert.deepEqual(plain(range), { minFloat: 0, maxFloat: 0.38, selectedWears: ['FT', 'FN'] });
  tree = render();
  nodes(tree).find((node) => node.props?.['aria-label'] === 'Field-Tested (FT)').props.onClick();
  assert.deepEqual(plain(range), { minFloat: 0, maxFloat: 0.07, selectedWears: ['FN'] });
});

test('saved multiple wear conditions exclude gaps and boundary values belong to one condition', async () => {
  const h = harness();
  const storage = h.load('src/services/storage.ts');
  const settings = await storage.setSettings({ selectedWears: ['FN', 'FT'], minFloat: 0, maxFloat: 0.38 });
  assert.deepEqual(plain((await storage.getSettings()).selectedWears), ['FN', 'FT']);
  const { evaluateListing } = h.load('src/services/scoring.ts');
  const { isDealVisible } = h.load('src/services/dealVisibility.ts');
  for (const [value, expected] of [[0.02, true], [0.07, false], [0.1, false], [0.15, true], [0.3, true], [0.38, false]]) {
    const item = listing(String(value), 'AK-47 | Redline');
    item.item.float_value = value;
    item.item.stickers = [{ reference: { price: 100000 } }];
    assert.equal(evaluateListing(item, { settings }).isDeal, expected);
    assert.equal(isDealVisible({ id: item.id, marketHashName: item.item.market_hash_name, floatValue: value, item: item.item }, settings, { ids: [] }), expected);
  }
  const { matchesSelectedWear } = h.load('src/services/floatRange.ts');
  assert.equal(matchesSelectedWear(1, ['BS']), true);
  assert.equal(matchesSelectedWear(0.02, []), false);
  assert.equal(matchesSelectedWear(0.02, undefined), true);
});

test('all theme palettes apply tokens and saved appearance does not mutate scan settings', async () => {
  const properties = {};
  const document = { documentElement: { style: { setProperty: (key, value) => { properties[key] = value; } }, dataset: {} } };
  const h = harness({ document });
  const { THEMES, initializeTheme, applyTheme } = h.load('src/services/themes.ts');
  const storage = h.load('src/services/storage.ts');
  await storage.setSettings({ enabled: true, apiKey: 'keep', watchlist: ['ak redline'] });
  const before = JSON.stringify(h.db.settings);
  h.db.uiTheme = 'slate';
  await initializeTheme();
  assert.equal(document.documentElement.dataset.theme, 'slate');
  for (const theme of THEMES) {
    await h.chrome.storage.local.set({ uiTheme: theme.id });
    assert.equal(document.documentElement.dataset.theme, theme.id);
    assert.equal(document.documentElement.style.colorScheme, theme.light ? 'light' : 'dark');
    assert.equal(properties['--accent-blue'], theme.accent.slice(1).match(/../g).map((hex) => parseInt(hex, 16)).join(' '));
  }
  assert.equal(JSON.stringify(h.db.settings), before);
  applyTheme('unknown');
  assert.equal(document.documentElement.dataset.theme, 'original');
});
