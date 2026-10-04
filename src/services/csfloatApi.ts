import { recordRateLimit, withRequestPacing } from './requestPacing';

const BASE_URL = 'https://csfloat.com/api/v1/listings';

interface FetchListingsParams {
  [key: string]: string | number | undefined;
}

export async function fetchListings(params: FetchListingsParams, apiKey?: string) {
  return withRequestPacing(() => performRequest(params, apiKey));
}

async function performRequest(params: FetchListingsParams, apiKey?: string) {
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
    if (res.status === 429) {
      throw await recordRateLimit(res.headers?.get('Retry-After'));
    }
    if (!res.ok) {
      throw new Error(`CSFloat API error ${res.status}: ${await res.text()}`);
    }
    const body = await res.text();
    if (!body.trim()) throw new Error('CSFloat returned an empty response body.');
    const payload = JSON.parse(body);
    if (Array.isArray(payload)) return { data: payload };
    if (Array.isArray(payload?.data)) return payload as { data: any[]; cursor?: string };
    throw new Error('CSFloat returned an unexpected listings response.');
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('CSFloat API request timed out after 15s.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchRecentListings(
  { limit, minPrice, maxPrice }: { limit?: number; minPrice?: number; maxPrice?: number },
  apiKey?: string
) {
  return fetchListings(
    {
      sort_by: 'most_recent',
      type: 'buy_now',
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
      type: 'buy_now',
      limit,
    },
    apiKey
  );
}
