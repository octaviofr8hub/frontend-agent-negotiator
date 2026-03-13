const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types ──────────────────────────────────────────────────

export interface DispatchPayload {
  carrier_main_phone: string;
  carrier_name?: string;
  load_id?: string;
  origin?: string;
  destination?: string;
  rate?: number;
  target_rate?: number;
  [key: string]: unknown;
}

export interface DispatchResponse {
  call_id: string;
  call_sid: string;
  status: string;
  phone_number: string;
}

export interface Negotiation {
  call_id: string;
  status: string;
  carrier_name?: string;
  phone_number?: string;
  created_at?: string;
  updated_at?: string;
  call_sid?: string;
  dial_info?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface TranscriptMessage {
  role: "agent" | "carrier" | "system";
  content: string;
  timestamp?: string;
}

export interface TranscriptResponse {
  call_id: string;
  status: string;
  messages: TranscriptMessage[];
}

// ── API calls ──────────────────────────────────────────────

export async function dispatchCall(payload: DispatchPayload): Promise<DispatchResponse> {
  const res = await fetch(`${API_BASE}/dispatch`, {
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

export async function getNegotiations(limit = 50): Promise<Negotiation[]> {
  const res = await fetch(`${API_BASE}/negotiations?limit=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch negotiations");
  return res.json();
}

export async function getActiveNegotiation(): Promise<{ active: boolean } & Partial<Negotiation>> {
  const res = await fetch(`${API_BASE}/negotiations/active`);
  if (!res.ok) throw new Error("Failed to fetch active negotiation");
  return res.json();
}

export async function getNegotiation(callId: string): Promise<Negotiation> {
  const res = await fetch(`${API_BASE}/negotiations/${encodeURIComponent(callId)}`);
  if (!res.ok) throw new Error("Negotiation not found");
  return res.json();
}

export async function getTranscript(callId: string): Promise<TranscriptResponse> {
  const res = await fetch(`${API_BASE}/negotiations/${encodeURIComponent(callId)}/transcript`);
  if (!res.ok) throw new Error("Transcript not found");
  return res.json();
}

/**
 * Subscribe to real-time transcript via SSE.
 * Returns an EventSource — caller is responsible for closing it.
 */
export function subscribeTranscript(
  callId: string,
  onMessage: (msg: TranscriptMessage) => void,
  onEnd?: () => void,
  onError?: (err: Event) => void,
): EventSource {
  const url = `${API_BASE}/negotiations/${encodeURIComponent(callId)}/stream`;
  const es = new EventSource(url);

  es.addEventListener("transcript", (e) => {
    try {
      const data: TranscriptMessage = JSON.parse(e.data);
      onMessage(data);
    } catch {
      // skip malformed
    }
  });

  es.addEventListener("end", () => {
    es.close();
    onEnd?.();
  });

  es.onerror = (e) => {
    onError?.(e);
    es.close();
  };

  return es;
}

export async function healthCheck(): Promise<{ status: string; version: string }> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error("Backend unreachable");
  return res.json();
}
