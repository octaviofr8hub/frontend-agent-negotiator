"use client";

import { useState, useEffect, useCallback } from "react";
import {
  dispatchCall,
  getActiveNegotiation,
  getNegotiations,
  type Negotiation,
  type DispatchPayload,
} from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { TranscriptViewer } from "@/app/components/TranscriptViewer";
import { NegotiationHistory } from "@/app/components/NegotiationHistory";
import {
  Phone,
  PhoneOff,
  Loader2,
  AlertCircle,
  Truck,
  DollarSign,
  MapPin,
  PhoneCall,
} from "lucide-react";

// Demo carrier data — in production this comes from your route pricing engine
const DEMO_CARRIERS = [
  { name: "FastFreight Logistics", phone: "+15551234567", rate: 2850, origin: "Dallas, TX", destination: "Chicago, IL" },
  { name: "Eagle Transport Co.", phone: "+15559876543", rate: 3100, origin: "Dallas, TX", destination: "Chicago, IL" },
  { name: "Summit Carriers Inc.", phone: "+15555551234", rate: 2700, origin: "Dallas, TX", destination: "Chicago, IL" },
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
  const [activeNego, setActiveNego] = useState<Negotiation | null>(null);
  const [history, setHistory] = useState<Negotiation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<string | null>(null);

  // Manual call form state
  const [manualPhone, setManualPhone] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualRate, setManualRate] = useState("");

  // Poll active negotiation
  const refreshActive = useCallback(async () => {
    try {
      const data = await getActiveNegotiation();
      if (data.active) {
        setActiveNego(data as Negotiation);
      } else {
        setActiveNego(null);
      }
    } catch {
      // backend might be down
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    try {
      const data = await getNegotiations(20);
      setHistory(data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    refreshActive();
    refreshHistory();
    const interval = setInterval(() => {
      refreshActive();
      refreshHistory();
    }, 5000);
    return () => clearInterval(interval);
  }, [refreshActive, refreshHistory]);

  const handleCall = async (carrier: typeof DEMO_CARRIERS[0]) => {
    if (activeNego) {
      setError("There is already an active negotiation. Wait for it to finish.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: DispatchPayload = {
        carrier_main_phone: carrier.phone,
        carrier_name: carrier.name,
        origin: carrier.origin,
        destination: carrier.destination,
        rate: carrier.rate,
        target_rate: Math.round(carrier.rate * 0.85),
      };

      const res = await dispatchCall(payload);
      setActiveNego({
        call_id: res.call_id,
        status: res.status,
        carrier_name: carrier.name,
        phone_number: res.phone_number,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to dispatch call");
    } finally {
      setLoading(false);
    }
  };

  const handleManualCall = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Auto-agregar + si no lo tiene
    let phone = manualPhone.trim();
    if (!phone.startsWith("+")) phone = "+" + phone;
    if (phone.length < 8) {
      setError("Número de teléfono demasiado corto.");
      return;
    }

    setLoading(true);

    try {
      const rate = manualRate ? parseInt(manualRate, 10) : undefined;
      const payload: DispatchPayload = {
        carrier_main_phone: phone,
        carrier_name: manualName.trim() || undefined,
        ...(rate ? { rate, target_rate: Math.round(rate * 0.85) } : {}),
      };

      const res = await dispatchCall(payload);
      setActiveNego({
        call_id: res.call_id,
        status: res.status,
        carrier_name: manualName.trim() || phone,
        phone_number: res.phone_number,
      });
      setManualPhone("");
      setManualName("");
      setManualRate("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al enviar la llamada";
      setError(`Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const viewCallId = selectedHistory || activeNego?.call_id || null;
  const viewStatus = selectedHistory
    ? history.find((n) => n.call_id === selectedHistory)?.status || "unknown"
    : activeNego?.status || "idle";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 h-full">
      {/* Left Panel — Carrier List + Call */}
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
                <Badge variant={statusBadgeVariant(activeNego.status)}>
                  {activeNego.status}
                </Badge>
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

        {/* Manual Call Form */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-[#B1CA1E]" />
              Call a Carrier
            </CardTitle>
            <CardDescription>Enter the carrier phone number to start a negotiation</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-zinc-600 mb-3 font-mono">
              Backend: {process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}
            </p>
            <form onSubmit={handleManualCall} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Phone Number <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="+525512345678"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  required
                  autoComplete="off"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#B1CA1E]/50 focus:border-[#B1CA1E]/50"
                />
                <p className="text-[10px] text-zinc-600 mt-1">Con o sin + (ej: 525512345678 o +525512345678)</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Carrier Name <span className="text-zinc-600">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. FastFreight Logistics"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#B1CA1E]/50 focus:border-[#B1CA1E]/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Rate (USD) <span className="text-zinc-600">(optional)</span>
                </label>
                <input
                  type="number"
                  placeholder="e.g. 2850"
                  value={manualRate}
                  onChange={(e) => setManualRate(e.target.value)}
                  min={0}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#B1CA1E]/50 focus:border-[#B1CA1E]/50"
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={loading || !manualPhone.trim()}
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Llamando...</>
                ) : (
                  <><Phone className="w-4 h-4" /> Iniciar Negociación</>
                )}
              </Button>
              {activeNego && (
                <p className="text-[11px] text-amber-400 text-center">
                  ⚠ Ya hay una llamada activa — el backend bloqueará si mandas otra
                </p>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Carrier List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#B1CA1E]" />
              Route Carriers
            </CardTitle>
            <CardDescription>Select a carrier to start a negotiation call</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {DEMO_CARRIERS.map((carrier, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 hover:border-zinc-700 transition-colors"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-white">{carrier.name}</p>
                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {carrier.origin} → {carrier.destination}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        ${carrier.rate}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={activeNego ? "ghost" : "default"}
                    disabled={!!activeNego || loading}
                    onClick={() => handleCall(carrier)}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : activeNego ? (
                      <PhoneOff className="w-4 h-4" />
                    ) : (
                      <Phone className="w-4 h-4" />
                    )}
                    {loading ? "Calling..." : activeNego ? "Busy" : "Call"}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Negotiation History */}
        <NegotiationHistory
          history={history}
          selectedId={selectedHistory}
          onSelect={(id) => setSelectedHistory(id === selectedHistory ? null : id)}
        />
      </div>

      {/* Right Panel — Live Transcript */}
      <div className="lg:col-span-2">
        <Card className="h-full min-h-[500px]">
          <CardHeader>
            <CardTitle className="text-base">Negotiation Transcript</CardTitle>
            <CardDescription>
              {viewCallId
                ? `Viewing: ${viewCallId}`
                : "Start a call to see the live conversation"}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[calc(100%-5rem)]">
            <TranscriptViewer callId={viewCallId} status={viewStatus} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
