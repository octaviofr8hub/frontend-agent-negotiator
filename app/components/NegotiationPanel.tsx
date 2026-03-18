"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  dispatchNegotiation,
  getNegotiations,
  getActiveNegotiation,
  type Negotiation,
  type DispatchPayload,
} from "@/services/backendService";
import {
  getRoutePrice,
  type LocationItem,
  type PriceResult,
} from "@/services/zayrenService";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { TranscriptViewer } from "@/app/components/TranscriptViewer";
import { NegotiationHistory } from "@/app/components/NegotiationHistory";
import { LocationPicker } from "@/app/components/LocationPicker";
import { MonthPickerPopover } from "@/app/components/MonthPickerPopover";
import { TrailerTypeSelect } from "@/app/components/TrailerTypeSelect";
import {
  Phone,
  PhoneOff,
  Loader2,
  AlertCircle,
  Truck,
  DollarSign,
  MapPin,
  PhoneCall,
  Route,
  Calculator,
  X,
} from "lucide-react";

// ── Hardcoded carriers ────────────────────────────────────
// Only the first one (you) has a phone number available
const HARDCODED_CARRIERS = [
  {
    name: "Transportes Zayren MX",
    phone: "+525520935477",
    available: true,
  },
  {
    name: "Logística Rápida SA de CV",
    phone: null,
    available: false,
  },
  {
    name: "Carga Express del Norte",
    phone: null,
    available: false,
  },
];

function statusBadgeVariant(status: string) {
  switch (status) {
    case "accepted":
      return "success" as const;
    case "rejected":
    case "error":
      return "error" as const;
    case "in_progress":
    case "ringing":
      return "active" as const;
    case "unavailable":
      return "warning" as const;
    default:
      return "default" as const;
  }
}

export function NegotiationPanel() {
  // ── State ────────────────────────────────────────────────
  const [activeNego, setActiveNego] = useState<Negotiation | null>(null);
  const [history, setHistory] = useState<Negotiation[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<string | null>(null);

  // Route form state
  const [pickup, setPickup] = useState<LocationItem | null>(null);
  const [dropoff, setDropoff] = useState<LocationItem | null>(null);
  const [trailerType, setTrailerType] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Calculated route result
  const [routeResult, setRouteResult] = useState<PriceResult | null>(null);

  // Track whether we've done the initial load — after that, only dispatch/SSE manage activeNego
  const initialLoadDone = useRef(false);

  // ── Load history & active negotiation on mount ───────────
  const refreshData = useCallback(async () => {
    try {
      const [negotiations, active] = await Promise.all([
        getNegotiations(20),
        getActiveNegotiation(),
      ]);
      setHistory(negotiations);
      // Restore activeNego from backend only on first page load.
      // After that, dispatch and SSE manage the state — polling must not
      // override it or stale "ringing" entries will block the call button.
      if (!initialLoadDone.current) {
        initialLoadDone.current = true;
        const LIVE_STATUSES = ["ringing", "in_progress", "initiated"];
        if (active && active.call_id && LIVE_STATUSES.includes(active.status ?? "")) {
          // Skip calls stuck in ringing for more than 30 min — they're stale ghosts
          const createdAt = active.created_at ? new Date(active.created_at).getTime() : 0;
          const ageMinutes = (Date.now() - createdAt) / 60_000;
          if (ageMinutes < 30) {
            setActiveNego({
              call_id: active.call_id,
              status: active.status ?? "unknown",
              carrier_name: active.carrier_name,
              phone_number: active.carrier_phone ?? active.phone_number,
            });
          }
        }
      }
    } catch {
      // silently ignore — backend may not be running
      initialLoadDone.current = true;
    }
  }, []);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 10_000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // ── Calculate route ──────────────────────────────────────
  const handleCalculateRoute = async () => {
    if (!pickup || !dropoff || !trailerType || !selectedDate) {
      setError("Fill all route fields: pickup, dropoff, trailer type, and date.");
      return;
    }

    setCalculating(true);
    setError(null);
    setRouteResult(null);

    try {
      const result = await getRoutePrice({
        trailer_type: trailerType,
        month: selectedDate.getMonth() + 1,
        pickup_city: pickup.city,
        pickup_state: pickup.state,
        pickup_country: pickup.country,
        dropoff_city: dropoff.city,
        dropoff_state: dropoff.state,
        dropoff_country: dropoff.country,
      });
      setRouteResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to calculate route");
    } finally {
      setCalculating(false);
    }
  };

  // ── Call carrier ─────────────────────────────────────────
  const handleCall = async (carrier: (typeof HARDCODED_CARRIERS)[0]) => {
    if (!carrier.available || !carrier.phone) {
      setError("This carrier has no phone number available.");
      return;
    }
    if (activeNego) {
      setError("There is already an active negotiation. Wait for it to finish.");
      return;
    }
    if (!routeResult || !pickup || !dropoff) {
      setError("Calculate a route first before calling.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Format date as YYYY-MM-DD (backend expects ISO date string)
      const year = selectedDate!.getFullYear();
      const month = String(selectedDate!.getMonth() + 1).padStart(2, "0");
      const dateStr = `${year}-${month}-01`;

      const payload: DispatchPayload = {
        trailer_type: trailerType,
        date: dateStr,
        distance: routeResult.distance,
        ai_price: routeResult.ai_price,
        pickup_city: pickup.city,
        pickup_state: pickup.state,
        pickup_country: pickup.country,
        dropoff_city: dropoff.city,
        dropoff_state: dropoff.state,
        dropoff_country: dropoff.country,
        carrier_name: carrier.name,
        carrier_main_email: "",
        carrier_main_phone: carrier.phone,
      };

      const res = await dispatchNegotiation(payload);
      // room_name is the call_id for the SSE stream
      setActiveNego({
        call_id: res.room_name,
        status: "ringing",
        carrier_name: carrier.name,
        phone_number: carrier.phone,
      });
      // refresh history so the new negotiation shows up
      setTimeout(refreshData, 2_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to dispatch call");
    } finally {
      setLoading(false);
    }
  };

  const viewCallId = selectedHistory || activeNego?.call_id || null;
  const viewStatus = selectedHistory
    ? history.find((n) => n.call_id === selectedHistory)?.status || "unknown"
    : activeNego?.status || "idle";

  const routeComplete = !!(pickup && dropoff && trailerType && selectedDate);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 h-full">
      {/* ─── Left Panel ─────────────────────────────────── */}
      <div className="lg:col-span-1 space-y-5">
        {/* Active Status */}
        {activeNego && (
          <Card className="border-[#B1CA1E]/30">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#B1CA1E]" />
                  Active Call
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={statusBadgeVariant(activeNego.status)}>
                    {activeNego.status}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => setActiveNego(null)}
                    className="text-zinc-500 hover:text-zinc-300 transition-colors"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm">
                <p className="text-zinc-300">{activeNego.carrier_name || "Unknown Carrier"}</p>
                <p className="text-zinc-500 text-xs font-mono">{activeNego.phone_number}</p>
                <p className="text-zinc-600 text-xs">ID: {activeNego.call_id}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-900/30 border border-red-800/50 px-4 py-3 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Route Calculator */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Route className="w-4 h-4 text-[#B1CA1E]" />
              Route Calculator
            </CardTitle>
            <CardDescription>Calculate pricing for your route</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Pickup</label>
                <LocationPicker label="Select pickup" value={pickup} onChange={setPickup} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Dropoff</label>
                <LocationPicker label="Select dropoff" value={dropoff} onChange={setDropoff} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Trailer Type</label>
                <TrailerTypeSelect value={trailerType} onChange={setTrailerType} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Date</label>
                <MonthPickerPopover value={selectedDate} onChange={setSelectedDate} />
              </div>

              <Button
                type="button"
                variant="primary"
                className="w-full"
                disabled={calculating || !routeComplete}
                onClick={handleCalculateRoute}
              >
                {calculating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Calculating...</>
                ) : (
                  <><Calculator className="w-4 h-4" /> Calculate Route</>
                )}
              </Button>
            </div>

            {/* Route result */}
            {routeResult && (
              <div className="mt-4 rounded-lg border border-[#B1CA1E]/30 bg-[#B1CA1E]/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">AI Price</span>
                  <span className="text-sm font-bold text-[#B1CA1E]">
                    ${routeResult.ai_price.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Distance</span>
                  <span className="text-sm font-medium text-zinc-300">
                    {routeResult.distance.toLocaleString()} km
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Carrier List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#B1CA1E]" />
              Available Carriers
            </CardTitle>
            <CardDescription>
              {routeResult
                ? "Select a carrier to negotiate"
                : "Calculate a route first to enable calls"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {HARDCODED_CARRIERS.map((carrier, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 transition-colors ${
                    carrier.available
                      ? "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                      : "border-zinc-800/50 bg-zinc-900/30 opacity-60"
                  }`}
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-white">{carrier.name}</p>
                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                      {carrier.available ? (
                        <span className="flex items-center gap-1">
                          <PhoneCall className="w-3 h-3 text-[#B1CA1E]" />
                          Available
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <PhoneOff className="w-3 h-3" />
                          No phone available
                        </span>
                      )}
                      {routeResult && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          ${routeResult.ai_price.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={!carrier.available || !routeResult || activeNego ? "ghost" : "default"}
                    disabled={!carrier.available || !routeResult || !!activeNego || loading}
                    onClick={() => handleCall(carrier)}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : !carrier.available ? (
                      <PhoneOff className="w-4 h-4" />
                    ) : activeNego ? (
                      <PhoneOff className="w-4 h-4" />
                    ) : (
                      <Phone className="w-4 h-4" />
                    )}
                    {loading ? "Calling..." : !carrier.available ? "N/A" : activeNego ? "Busy" : "Call"}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* History */}
        <NegotiationHistory
          history={history}
          selectedId={selectedHistory}
          onSelect={(id) => setSelectedHistory(id === selectedHistory ? null : id)}
        />
      </div>

      {/* ─── Right Panel — Live Transcript ──────────────── */}
      <div className="lg:col-span-2">
        <Card className="h-full min-h-[500px]">
          <CardHeader>
            <CardTitle className="text-base">Negotiation Transcript</CardTitle>
            <CardDescription>
              {viewCallId
                ? `Viewing: ${viewCallId}`
                : "Calculate a route and call a carrier to see the live conversation"}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[calc(100%-5rem)]">
            <TranscriptViewer
              callId={viewCallId}
              status={viewStatus}
              onStatusChange={(s) => {
                if (activeNego && !selectedHistory) {
                  setActiveNego((prev) => prev ? { ...prev, status: s } : prev);
                }
              }}
              onDone={() => {
                if (!selectedHistory) {
                  setActiveNego(null);
                  setTimeout(refreshData, 1_000);
                }
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
