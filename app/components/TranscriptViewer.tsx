"use client";

import { useEffect, useRef, useState } from "react";
import { subscribeTranscript, getTranscriptMessages, type TranscriptMessage } from "@/services/backendService";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { MessageSquare, Bot, User, Radio, UserRoundPlus } from "lucide-react";

// Map backend roles to display roles
function mapRole(role: TranscriptMessage["role"]): "agent" | "carrier" | "tool" {
  if (role === "assistant") return "agent";
  if (role === "user") return "carrier";
  return "tool";
}

interface TranscriptViewerProps {
  callId: string | null;
  status: string;
  onStatusChange?: (status: string) => void;
  onDone?: () => void;
  onInterrupt?: () => void;
}

const TERMINAL_STATUSES = ["accepted", "rejected", "unavailable", "ended", "error"];
const SUPERVISED_STATUSES = ["supervised"];

export function TranscriptViewer({ callId, status, onStatusChange, onDone, onInterrupt }: TranscriptViewerProps) {
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  // Load messages + open SSE whenever callId changes
  useEffect(() => {
    if (!callId) {
      setMessages([]);
      setConnected(false);
      return;
    }

    setMessages([]);
    setConnected(false);

    let cancelled = false;

    getTranscriptMessages(callId).then((existing) => {
      if (cancelled) return;
      setMessages(existing);

      const lastId = existing.length > 0 ? existing[existing.length - 1].id : 0;

      const es = subscribeTranscript(
        callId,
        (msg) => {
          setMessages((prev) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
          );
        },
        (s) => { onStatusChange?.(s); },
        () => { setConnected(false); onDone?.(); },
        () => setConnected(false),
        () => { setConnected(true); },
        lastId,
      );

      esRef.current = es;
    });

    return () => {
      cancelled = true;
      esRef.current?.close();
      esRef.current = null;
    };
  }, [callId]);

  // Auto-scroll to newest message
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isTerminal = TERMINAL_STATUSES.includes(status);
  const isSupervised = SUPERVISED_STATUSES.includes(status);
  const canInterrupt = !!callId && !isTerminal && !isSupervised && !!onInterrupt;

  if (!callId) {
    return (
      <div className="flex flex-col items-center justify-center text-zinc-500 gap-3 py-16">
        <MessageSquare className="w-10 h-10" />
        <p className="text-sm">No active negotiation</p>
        <p className="text-xs text-zinc-600">Select a carrier and start a call to see the transcript</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Radio className={`w-4 h-4 ${connected && !isTerminal ? "text-[#B1CA1E] animate-pulse" : "text-zinc-500"}`} />
          <span className="text-sm font-medium text-zinc-300">
            {connected && !isTerminal ? "Live Transcript" : "Transcript"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {canInterrupt && onInterrupt && (
            <Button
              size="sm"
              variant="default"
              onClick={onInterrupt}
              className="text-xs"
            >
              <UserRoundPlus className="w-3 h-3" />
              Interrupt & Join
            </Button>
          )}
          <Badge variant={isTerminal ? (status === "accepted" ? "success" : "error") : "active"}>
            {status}
          </Badge>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 mt-3 max-h-[280px]">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
            <Radio className="w-6 h-6 animate-pulse text-[#B1CA1E]" />
            <p className="text-xs mt-2">Waiting for conversation to begin...</p>
          </div>
        ) : (
          <div className="space-y-3 pr-2">
            {messages.map((msg, i) => {
              const display = mapRole(msg.role);
              return (
                <div key={msg.id ?? i} className={`flex gap-3 ${display === "agent" ? "justify-start" : "justify-end"}`}>
                  {display === "agent" && (
                    <div className="w-7 h-7 rounded-full bg-[#B1CA1E]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="w-4 h-4 text-[#B1CA1E]" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      display === "agent"
                        ? "bg-zinc-800 text-zinc-200"
                        : display === "tool"
                        ? "bg-zinc-800/50 text-zinc-400 italic text-xs"
                        : "bg-[#2E4455] text-white"
                    }`}
                  >
                    <p className="text-[10px] font-medium mb-1 opacity-60 uppercase">
                      {display === "agent" ? "Agent" : display === "carrier" ? "Carrier" : msg.tool_name || "Tool"}
                    </p>
                    <p className="leading-relaxed">{msg.content}</p>
                    {msg.created_at && (
                      <p className="text-[9px] opacity-40 mt-1 text-right">
                        {new Date(msg.created_at).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                  {display === "carrier" && (
                    <div className="w-7 h-7 rounded-full bg-[#2E4455] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="w-4 h-4 text-zinc-300" />
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={scrollEndRef} />
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
