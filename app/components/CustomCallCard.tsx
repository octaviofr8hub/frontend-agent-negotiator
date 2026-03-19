"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Phone, Loader2, PhoneMissed, DollarSign, MapPin, Truck } from "lucide-react";
import type { PriceResult } from "@/services/zayrenService";
import type { Negotiation } from "@/services/backendService";

interface CustomCallCardProps {
  routeResult: PriceResult | null;
  activeNego: Negotiation | null;
  loading: boolean;
  pickupLabel?: string;
  dropoffLabel?: string;
  onCall: (name: string, phone: string, email: string) => void;
}

export function CustomCallCard({
  routeResult,
  activeNego,
  loading,
  pickupLabel,
  dropoffLabel,
  onCall,
}: CustomCallCardProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);

  const phoneValid = /^\+?[0-9\s\-().]{7,20}$/.test(phone.trim());
  const canCall = !!routeResult && !activeNego && !loading && phone.trim().length > 0 && phoneValid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!canCall) return;
    onCall(name.trim() || phone.trim(), phone.trim(), email.trim());
  };

  return (
    <Card className="border-zinc-700/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <PhoneMissed className="w-4 h-4 text-[#B1CA1E]" />
          Llamar a Número Personalizado
        </CardTitle>
        <CardDescription>
          {routeResult
            ? "Marca cualquier número con los datos de la ruta calculada"
            : "Calcula una ruta primero para habilitar las llamadas"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Route summary pill */}
        {routeResult && (
          <div className="flex flex-wrap gap-2 mb-4">
            {pickupLabel && dropoffLabel && (
              <div className="flex items-center gap-1.5 rounded-full bg-zinc-800 border border-zinc-700 px-3 py-1 text-xs text-zinc-300">
                <MapPin className="w-3 h-3 text-[#B1CA1E]" />
                {pickupLabel} → {dropoffLabel}
              </div>
            )}
            <div className="flex items-center gap-1.5 rounded-full bg-zinc-800 border border-zinc-700 px-3 py-1 text-xs text-zinc-300">
              <DollarSign className="w-3 h-3 text-[#B1CA1E]" />
              ${routeResult.ai_price.toLocaleString()} USD
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-zinc-800 border border-zinc-700 px-3 py-1 text-xs text-zinc-300">
              <Truck className="w-3 h-3 text-zinc-400" />
              {routeResult.distance.toLocaleString()} km
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Phone — primary field */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Número de teléfono <span className="text-red-400">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+52 671 100 0000"
              autoComplete="tel"
              className={`w-full rounded-lg bg-zinc-900 border px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:ring-1 transition-colors ${
                touched && !phoneValid && phone.length > 0
                  ? "border-red-700 focus:ring-red-600"
                  : "border-zinc-700 focus:border-[#B1CA1E]/60 focus:ring-[#B1CA1E]/30"
              }`}
            />
            {touched && phone.trim().length > 0 && !phoneValid && (
              <p className="mt-1 text-[10px] text-red-400">
                Ingresa un número válido con código de país (ej. +52 671 …)
              </p>
            )}
          </div>

          {/* Carrier name — optional */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Nombre del carrier <span className="text-zinc-600">(opcional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Transportes Norte SA"
              className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-[#B1CA1E]/60 focus:ring-1 focus:ring-[#B1CA1E]/30 transition-colors"
            />
          </div>

          {/* Email — optional */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Correo electrónico <span className="text-zinc-600">(opcional)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="carrier@empresa.com"
              autoComplete="email"
              className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-[#B1CA1E]/60 focus:ring-1 focus:ring-[#B1CA1E]/30 transition-colors"
            />
          </div>

          <Button
            type="submit"
            variant={canCall ? "primary" : "ghost"}
            className="w-full"
            disabled={!canCall || loading}
            onClick={() => setTouched(true)}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Llamando...
              </>
            ) : activeNego ? (
              <>
                <Phone className="w-4 h-4" />
                Ocupado — hay una llamada activa
              </>
            ) : !routeResult ? (
              <>
                <Phone className="w-4 h-4" />
                Calcula una ruta primero
              </>
            ) : (
              <>
                <Phone className="w-4 h-4" />
                Llamar
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
