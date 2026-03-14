// Relative path — proxied through Next.js (/api/worker) to avoid CORS
const WORKER_BASE = "/api/worker";

// ── Types ──────────────────────────────────────────────────

/** Matches backend NegotiationPayload exactly */
export interface DispatchPayload {
  // Load details
  trailer_type: string;
  date: string;           // "YYYY-MM-DD"
  distance: number;
  ai_price: number;
  // Origin
  pickup_city: string;
  pickup_state: string;
  pickup_country: string;
  // Destination
  dropoff_city: string;
  dropoff_state: string;
  dropoff_country: string;
  // Carrier contact
  carrier_name: string;
  carrier_main_email: string;
  carrier_main_phone: string;
}

export interface DispatchResponse {
  call_id: string;
  call_sid: string;
  status: string;
  phone_number: string;
}

// ── API Calls ──────────────────────────────────────────────

export async function dispatchCall(payload: DispatchPayload): Promise<DispatchResponse> {
  const res = await fetch(`${WORKER_BASE}/dispatch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Dispatch failed (${res.status})`);
  }
  return res.json();
}
