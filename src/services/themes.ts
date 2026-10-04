export const THEMES = [
  { id: 'original', name: 'Original Blue', bg: '#090d14', card: '#141a28', accent: '#3b82f6', ink: '#ffffff', text: '#f0f4f8', muted: '#94a3b8', light: false },
  { id: 'silver', name: 'Smoke Silver', bg: '#1c1c1e', card: '#2b2b2f', accent: '#d4d4d8', ink: '#202024', text: '#f4f4f5', muted: '#b0b0b8', light: false },
  { id: 'slate', name: 'Cool Slate', bg: '#20252b', card: '#2c333c', accent: '#afc2d4', ink: '#202a33', text: '#f0f3f6', muted: '#b0bac6', light: false },
  { id: 'stone', name: 'Warm Stone', bg: '#282623', card: '#36332f', accent: '#d2c5b5', ink: '#2a241e', text: '#f5f1eb', muted: '#bdb5ab', light: false },
  { id: 'mint', name: 'Obsidian Mint', bg: '#101715', card: '#1a2521', accent: '#6ee7b7', ink: '#10251c', text: '#edf7f1', muted: '#a0b8aa', light: false },
  { id: 'violet', name: 'Graphite Violet', bg: '#17151d', card: '#24212e', accent: '#c4b5fd', ink: '#21163d', text: '#f4f0fc', muted: '#b3abc3', light: false },
  { id: 'ocean', name: 'Deep Ocean', bg: '#0c1924', card: '#162b3b', accent: '#67e8f9', ink: '#092934', text: '#edf8fc', muted: '#a0b9c8', light: false },
  { id: 'porcelain', name: 'Warm Porcelain', bg: '#f5f2ec', card: '#ffffff', accent: '#9c4323', ink: '#ffffff', text: '#29251f', muted: '#6e6459', light: true },
];

export function applyTheme(id: unknown) {
  const theme = THEMES.find((entry) => entry.id === id) ?? THEMES[0];
  const colors = { 'bg-primary': theme.bg, 'bg-secondary': theme.card, 'bg-card': theme.card,
    'text-primary': theme.text, 'text-secondary': theme.muted, 'text-muted': theme.muted,
    'accent-blue': theme.accent, 'accent-blue-hover': theme.accent, 'on-accent': theme.ink,
    'ui-border': theme.light ? '#29251f' : '#ffffff', 'ui-overlay': theme.light ? '#29251f' : '#ffffff',
    'accent-green': theme.light ? '#15803d' : '#22c55e', 'accent-red': theme.light ? '#b91c1c' : '#ef4444',
    'accent-amber': theme.light ? '#92400e' : '#f59e0b' };
  for (const [key, hex] of Object.entries(colors)) {
    document.documentElement.style.setProperty(`--${key}`, hex.slice(1).match(/../g)!.map((value) => parseInt(value, 16)).join(' '));
  }
  document.documentElement.style.colorScheme = theme.light ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme.id;
}

export async function initializeTheme() {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.uiTheme) applyTheme(changes.uiTheme.newValue);
  });
  const { uiTheme } = await chrome.storage.local.get('uiTheme');
  applyTheme(uiTheme);
}
