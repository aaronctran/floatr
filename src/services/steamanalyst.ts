const BASE_URL = 'https://api.steamanalyst.com/v2/prices';

export async function fetchSteamAnalystPrice(marketHashName: string, apiKey: string) {
  if (!apiKey) return null;

  const url = new URL(BASE_URL);
  url.searchParams.set('apikey', apiKey);
  url.searchParams.set('market_name', marketHashName);

  const res = await fetch(url.toString());

  if (res.status === 429) {
    throw new Error('SteamAnalyst daily rate limit (100 req/day on free tier) hit.');
  }
  if (!res.ok) {
    return null;
  }

  const data = await res.json();
  const item = Array.isArray(data) ? data[0] : data;
  if (!item) return null;

  return {
    avg7d: parseFloat(item.avg_price_7_days_raw ?? item.avg_price_7_days),
    avg30d: parseFloat(item.avg_price_30_days_raw ?? item.avg_price_30_days),
    currentPrice: parseFloat(item.current_price),
  };
}

export async function getSteamAnalystReferenceCents(
  marketHashName: string,
  apiKey: string,
  window: 'avg_price_7_days' | 'avg_price_30_days'
) {
  const data = await fetchSteamAnalystPrice(marketHashName, apiKey);
  if (!data) return null;
  const dollars = window === 'avg_price_7_days' ? data.avg7d : data.avg30d;
  if (!dollars || Number.isNaN(dollars)) return null;
  return Math.round(dollars * 100);
}
