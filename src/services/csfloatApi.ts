const BASE_URL = 'https://csfloat.com/api/v1/listings';

interface FetchListingsParams {
  [key: string]: string | number | undefined;
}

export async function fetchListings(params: FetchListingsParams, apiKey?: string) {
  const url = new URL(BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = {};
  if (apiKey) headers['Authorization'] = apiKey;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url.toString(), { headers, signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.status === 429) {
      throw new Error('CSFloat rate limit hit (429) — try increasing the poll interval.');
    }
    if (!res.ok) {
      throw new Error(`CSFloat API error ${res.status}: ${await res.text()}`);
    }
    return res.json() as Promise<{ listings: any[] }>;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('CSFloat API request timed out after 15s.');
    }
    throw err;
  }
}

export async function fetchRecentListings(
  { limit, minPrice, maxPrice }: { limit?: number; minPrice?: number; maxPrice?: number },
  apiKey?: string
) {
  return fetchListings(
    {
      sort_by: 'most_recent',
      limit,
      min_price: minPrice,
      max_price: maxPrice,
    },
    apiKey
  );
}

export async function fetchBuyNowListings(
  { limit, minPrice, maxPrice }: { limit?: number; minPrice?: number; maxPrice?: number },
  apiKey?: string
) {
  return fetchListings(
    {
      type: 'buy_now',
      sort_by: 'most_recent',
      limit,
      min_price: minPrice,
      max_price: maxPrice,
    },
    apiKey
  );
}

export async function fetchWatchedItemListings(
  marketHashName: string,
  { limit }: { limit?: number },
  apiKey?: string
) {
  return fetchListings(
    {
      market_hash_name: marketHashName,
      sort_by: 'lowest_price',
      limit,
    },
    apiKey
  );
}
