// Relative path — proxied through Next.js (/api/backend) to avoid CORS
const BACKEND_BASE = "/api/backend";

// ── Types matching backend schemas ────────────────────────

export interface Negotiation {
  call_id: string;
  status: string;
  carrier_name?: string;
  carrier_phone?: string;   // backend field name
  phone_number?: string;   // alias kept for UI compat
  created_at?: string;
  updated_at?: string;
  ended_at?: string;
  call_sid?: string;
  load_date?: string;
  ai_price?: string | number;
  distance?: string | number;
  trailer_type?: string;
  pickup_city?: string;
  pickup_state?: string;
  dropoff_city?: string;
  dropoff_state?: string;
  [key: string]: unknown;
}

// Matches backend TranscriptMessageRead
export interface TranscriptMessage {
  id: number;
  negotiation_id: number;
  // backend roles: "user" | "assistant" | "tool"
  role: "user" | "assistant" | "tool";
  content: string;
  tool_name?: string | null;
  created_at?: string | null;
}

// Matches backend TranscriptStreamConnected
export interface TranscriptStreamConnected {
  call_id: string;
  status: string;
  last_message_id: number;
}

// ── Dispatch types ────────────────────────────────────────

export interface DispatchPayload {
  trailer_type: string;
  date: string;           // "YYYY-MM-DD"
  distance: number;
  ai_price: number;
  pickup_city: string;
  pickup_state: string;
  pickup_country: string;
  dropoff_city: string;
  dropoff_state: string;
  dropoff_country: string;
  carrier_name: string;
  carrier_main_email: string;
  carrier_main_phone: string;
}

export interface DispatchResponse {
  room_name: string;
  room_sid: string;
  dispatch_id: string;
}

export async function dispatchNegotiation(payload: DispatchPayload): Promise<DispatchResponse> {
  const res = await fetch(`${BACKEND_BASE}/negotiation/dispatch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.detail || `Dispatch failed (${res.status})`);
  }
  return res.json();
}

// ── Interrupt types ───────────────────────────────────────

export interface InterruptResponse {
  token: string;
  room_name: string;
  livekit_url: string;
  participant_identity: string;
}

export async function interruptNegotiation(callId: string): Promise<InterruptResponse> {
  const res = await fetch(`${BACKEND_BASE}/negotiation/${encodeURIComponent(callId)}/interrupt`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.detail || `Interrupt failed (${res.status})`);
  }
  return res.json();
}

export async function getNegotiations(limit = 20): Promise<Negotiation[]> {
  const res = await fetch(`${BACKEND_BASE}/negotiations?limit=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch negotiations");
  const data = await res.json();
  // guard: backend might wrap array in an object
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.negotiations)) return data.negotiations;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export async function getActiveNegotiation(): Promise<Negotiation | null> {
  const res = await fetch(`${BACKEND_BASE}/negotiations/active`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch active negotiation");
  const data = await res.json();
  // backend returns an array of active negotiations — take the first one
  if (Array.isArray(data)) return data.length > 0 ? data[0] : null;
  return data ?? null;
}

export async function getNegotiation(callId: string): Promise<Negotiation> {
  const res = await fetch(`${BACKEND_BASE}/transcript/${encodeURIComponent(callId)}`);
  if (!res.ok) throw new Error("Negotiation not found");
  return res.json();
}

/** Fetch all existing transcript messages for a call (REST snapshot). */
export async function getTranscriptMessages(callId: string): Promise<TranscriptMessage[]> {
  const res = await fetch(`${BACKEND_BASE}/transcript/${encodeURIComponent(callId)}`);
  if (!res.ok) return [];
  const data = await res.json();
  // Try every shape the backend might use
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.messages)) return data.messages;
  if (Array.isArray(data?.transcript)) return data.transcript;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

/**
 * Subscribe to real-time transcript via SSE.
 * URL: /transcript/{callId}/stream
 * Events emitted by backend:
 *   - "connected" → TranscriptStreamConnected (first frame)
 *   - (default/message) → TranscriptMessageRead (new message)
 *   - "status" → NegotiationStatusEvent (status change)
 *   - "done" → terminal, stream closes
 *   - "error" → error payload
 */
export function subscribeTranscript(
  callId: string,
  onMessage: (msg: TranscriptMessage) => void,
  onStatusChange?: (status: string) => void,
  onDone?: () => void,
  onError?: (err: Event) => void,
  onConnected?: (data: TranscriptStreamConnected) => void,
  sinceId = 0,
): EventSource {
  const url = `${BACKEND_BASE}/transcript/${encodeURIComponent(callId)}/stream?since_id=${sinceId}`;
  const es = new EventSource(url);

  // Connection confirmation event
  es.addEventListener("connected", (e) => {
    try {
      const data: TranscriptStreamConnected = JSON.parse(e.data);
      onConnected?.(data);
      onStatusChange?.(data.status);
    } catch {
      // skip
    }
  });

  // Default event (no event: field) — new transcript message
  es.onmessage = (e) => {
    try {
      const data: TranscriptMessage = JSON.parse(e.data);
      onMessage(data);
    } catch {
      // skip malformed
    }
  };

  // Status change event
  es.addEventListener("status", (e) => {
    try {
      const data = JSON.parse(e.data);
      onStatusChange?.(data.status ?? data);
    } catch {
      // skip
    }
  });

  // Terminal event
  es.addEventListener("done", (e) => {
    try {
      const data = JSON.parse(e.data);
      onStatusChange?.(data.status);
    } catch {
      // skip
    }
    es.close();
    onDone?.();
  });

  // Error event from backend (room not found, etc.)
  es.addEventListener("error", (e) => {
    try {
      const me = e as MessageEvent;
      if (me.data) {
        JSON.parse(me.data);
      }
    } catch {
      // skip
    }
    es.close();
    onError?.(e);
  });

  es.onerror = (err) => {
    onError?.(err);
    es.close();
  };

  return es;
}

// ── Sentiment types ───────────────────────────────────────

export interface SentimentAnalysis {
  sentiment: "positive" | "neutral" | "negative";
  confidence: number;
  analyzed_at: string;
  message_count: number;
}

/**
 * Subscribe to real-time sentiment analysis via SSE.
 * URL: /sentiment/{callId}/stream
 * Events:
 *   - (default) → SentimentAnalysis JSON
 *   - "error"   → { detail: string }
 */
export function subscribeSentiment(
  callId: string,
  onSentiment: (data: SentimentAnalysis) => void,
  onError?: (err: Event) => void,
): EventSource {
  const url = `${BACKEND_BASE}/sentiment/${encodeURIComponent(callId)}/stream`;
  const es = new EventSource(url);

  es.onmessage = (e) => {
    try {
      const data: SentimentAnalysis = JSON.parse(e.data);
      onSentiment(data);
    } catch {
      // skip malformed
    }
  };

  es.addEventListener("error", (e) => {
    try {
      const me = e as MessageEvent;
      if (me.data) JSON.parse(me.data);
    } catch {
      // skip
    }
    es.close();
    onError?.(e);
  });

  es.onerror = (err) => {
    onError?.(err);
    es.close();
  };

  return es;
}
