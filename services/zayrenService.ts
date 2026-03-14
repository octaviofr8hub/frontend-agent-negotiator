const ZAYREN_BASE = process.env.NEXT_PUBLIC_ZAYREN_API_BASE_URL || "";
const ZAYREN_API_KEY = process.env.NEXT_PUBLIC_ZAYREN_API_KEY || "";

// ── Types ──────────────────────────────────────────────────

export interface LocationItem {
  location_id: number;
  city: string;
  state: string;
  country: string;
  accent_city: string;
  accent_state: string;
  accent_country: string;
  population: number;
}

export interface PriceResult {
  ai_price: number;
  distance: number;
}

export interface PriceQuery {
  trailer_type: string;
  month: number;
  pickup_city: string;
  pickup_state: string;
  pickup_country: string;
  dropoff_city: string;
  dropoff_state: string;
  dropoff_country: string;
  broker_id?: number;
  global_data?: boolean;
}

// ── API Calls ──────────────────────────────────────────────

// Locations — no auth needed, no extra headers (avoids CORS preflight)
export async function searchLocations(
  userInput: string,
  limit = 5,
): Promise<LocationItem[]> {
  const params = new URLSearchParams({
    user_input: userInput,
    limit: String(limit),
  });

  const res = await fetch(`${ZAYREN_BASE}/locations/search_location?${params}`);

  if (!res.ok) {
    throw new Error(`Location search failed (${res.status})`);
  }

  return res.json();
}

// Price — requires X-API-Key header
export async function getRoutePrice(query: PriceQuery): Promise<PriceResult> {
  const params = new URLSearchParams({
    trailer_type: query.trailer_type,
    month: String(query.month),
    pickup_city: query.pickup_city,
    pickup_state: query.pickup_state,
    pickup_country: query.pickup_country,
    dropoff_city: query.dropoff_city,
    dropoff_state: query.dropoff_state,
    dropoff_country: query.dropoff_country,
    broker_id: String(query.broker_id ?? 0),
    global_data: String(query.global_data ?? false),
  });

  const res = await fetch(`${ZAYREN_BASE}/price?${params}`, {
    headers: { "X-API-Key": ZAYREN_API_KEY },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Price query failed (${res.status})`);
  }

  return res.json();
}
