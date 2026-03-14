"use client";

import type { Negotiation } from "@/services/backendService";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { History, Clock } from "lucide-react";

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

interface NegotiationHistoryProps {
  history: Negotiation[];
  selectedId: string | null;
  onSelect: (callId: string) => void;
}

export function NegotiationHistory({ history, selectedId, onSelect }: NegotiationHistoryProps) {
  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4 text-zinc-500" />
            History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-500 text-center py-4">No negotiations yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <History className="w-4 h-4 text-[#B1CA1E]" />
          History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-2">
            {history.map((nego) => (
              <button
                key={nego.call_id}
                onClick={() => onSelect(nego.call_id)}
                className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors cursor-pointer ${
                  selectedId === nego.call_id
                    ? "border-[#B1CA1E]/50 bg-[#B1CA1E]/5"
                    : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-white truncate">
                    {nego.carrier_name || nego.call_id}
                  </p>
                  <Badge variant={statusBadgeVariant(nego.status)} className="ml-2">
                    {nego.status}
                  </Badge>
                </div>
                {nego.created_at && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-zinc-500">
                    <Clock className="w-3 h-3" />
                    {new Date(nego.created_at).toLocaleString()}
                  </div>
                )}
              </button>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
