"use client";

import { useEffect, useRef, useState } from "react";
import { subscribeSentiment, type SentimentAnalysis } from "@/services/backendService";
import { Badge } from "@/app/components/ui/badge";
import { Brain, TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";

interface SentimentPanelProps {
  callId: string | null;
  status: string;
}

const TERMINAL_STATUSES = ["accepted", "rejected", "unavailable", "ended", "error"];

const SENTIMENT_CONFIG = {
  positive: {
    label: "Positive",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10 border-emerald-400/30",
    barColor: "bg-emerald-400",
    icon: TrendingUp,
    description: "Engaged & receptive",
  },
  neutral: {
    label: "Neutral",
    color: "text-zinc-400",
    bg: "bg-zinc-400/10 border-zinc-400/30",
    barColor: "bg-zinc-400",
    icon: Minus,
    description: "Professional tone",
  },
  negative: {
    label: "Negative",
    color: "text-red-400",
    bg: "bg-red-400/10 border-red-400/30",
    barColor: "bg-red-400",
    icon: TrendingDown,
    description: "Frustrated or disinterested",
  },
} as const;

export function SentimentPanel({ callId, status }: SentimentPanelProps) {
  const [sentiment, setSentiment] = useState<SentimentAnalysis | null>(null);
  const [history, setHistory] = useState<SentimentAnalysis[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!callId) {
      setSentiment(null);
      setHistory([]);
      return;
    }

    setSentiment(null);
    setHistory([]);

    const es = subscribeSentiment(
      callId,
      (data) => {
        setSentiment(data);
        setHistory((prev) => [...prev.slice(-19), data]);
      },
      () => {
        // error — silently ignore
      },
    );

    esRef.current = es;

    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [callId]);

  // Close SSE when negotiation reaches terminal status
  useEffect(() => {
    if (TERMINAL_STATUSES.includes(status)) {
      esRef.current?.close();
      esRef.current = null;
    }
  }, [status]);

  const isTerminal = TERMINAL_STATUSES.includes(status);

  if (!callId) return null;

  const config = sentiment ? SENTIMENT_CONFIG[sentiment.sentiment] : null;
  const Icon = config?.icon ?? Activity;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-[#B1CA1E]" />
          <span className="text-sm font-medium text-zinc-300">Carrier Sentiment</span>
        </div>
        {!isTerminal && !sentiment && (
          <span className="text-xs text-zinc-500 animate-pulse">Analyzing...</span>
        )}
      </div>

      {/* Current sentiment */}
      {sentiment && config ? (
        <div className="space-y-3">
          {/* Main indicator */}
          <div className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${config.bg}`}>
            <Icon className={`w-5 h-5 ${config.color}`} />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className={`text-sm font-semibold ${config.color}`}>{config.label}</span>
                <Badge variant="default" className="text-[10px]">
                  {Math.round(sentiment.confidence * 100)}% confidence
                </Badge>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">{config.description}</p>
            </div>
          </div>

          {/* Confidence bar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Confidence</span>
              <span className="text-[10px] text-zinc-400">{sentiment.message_count} msgs analyzed</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${config.barColor}`}
                style={{ width: `${sentiment.confidence * 100}%` }}
              />
            </div>
          </div>

          {/* Mini history timeline */}
          {history.length > 1 && (
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Trend</span>
              <div className="flex items-end gap-0.5 mt-1 h-6">
                {history.map((h, i) => {
                  const heightPct = h.confidence * 100;
                  const barCfg = SENTIMENT_CONFIG[h.sentiment];
                  return (
                    <div
                      key={i}
                      className={`flex-1 rounded-sm transition-all duration-300 ${barCfg.barColor}`}
                      style={{ height: `${Math.max(heightPct, 15)}%`, opacity: 0.4 + (i / history.length) * 0.6 }}
                      title={`${barCfg.label} (${Math.round(h.confidence * 100)}%)`}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center py-4 text-zinc-500">
          <Activity className="w-5 h-5 animate-pulse text-[#B1CA1E]/50" />
          <span className="text-xs ml-2">
            {isTerminal ? "No sentiment data available" : "Waiting for conversation data..."}
          </span>
        </div>
      )}
    </div>
  );
}
