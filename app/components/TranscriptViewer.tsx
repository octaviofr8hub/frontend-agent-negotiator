"use client";

import { useEffect, useRef, useState } from "react";
import { subscribeTranscript, type TranscriptMessage } from "@/services/api";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { Badge } from "@/app/components/ui/badge";
import { MessageSquare, Bot, User, Radio } from "lucide-react";

interface TranscriptViewerProps {
  callId: string | null;
  status: string;
}

export function TranscriptViewer({ callId, status }: TranscriptViewerProps) {
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!callId) {
      setMessages([]);
      return;
    }

    setMessages([]);
    setConnected(true);

    const es = subscribeTranscript(
      callId,
      (msg) => {
        setMessages((prev) => [...prev, msg]);
      },
      () => {
        setConnected(false);
      },
      () => {
        setConnected(false);
      }
    );

    esRef.current = es;

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [callId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const terminalStatuses = ["accepted", "rejected", "unavailable", "ended", "error"];
  const isTerminal = terminalStatuses.includes(status);

  if (!callId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-3 py-16">
        <MessageSquare className="w-10 h-10" />
        <p className="text-sm">No active negotiation</p>
        <p className="text-xs text-zinc-600">Select a carrier and start a call to see the transcript</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Radio className={`w-4 h-4 ${connected && !isTerminal ? "text-[#B1CA1E] animate-pulse" : "text-zinc-500"}`} />
          <span className="text-sm font-medium text-zinc-300">
            {connected && !isTerminal ? "Live Transcript" : "Transcript"}
          </span>
        </div>
        <Badge variant={isTerminal ? (status === "accepted" ? "success" : "error") : "active"}>
          {status}
        </Badge>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 mt-3 max-h-[500px]">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
            <Radio className="w-6 h-6 animate-pulse text-[#B1CA1E]" />
            <p className="text-xs mt-2">Waiting for conversation to begin...</p>
          </div>
        ) : (
          <div className="space-y-3 pr-2">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "agent" ? "justify-start" : "justify-end"}`}>
                {msg.role === "agent" && (
                  <div className="w-7 h-7 rounded-full bg-[#B1CA1E]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-[#B1CA1E]" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === "agent"
                      ? "bg-zinc-800 text-zinc-200"
                      : msg.role === "system"
                      ? "bg-zinc-800/50 text-zinc-400 italic text-xs"
                      : "bg-[#2E4455] text-white"
                  }`}
                >
                  <p className="text-[10px] font-medium mb-1 opacity-60 uppercase">
                    {msg.role === "agent" ? "Agent" : msg.role === "carrier" ? "Carrier" : "System"}
                  </p>
                  <p className="leading-relaxed">{msg.content}</p>
                  {msg.timestamp && (
                    <p className="text-[9px] opacity-40 mt-1 text-right">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </p>
                  )}
                </div>
                {msg.role === "carrier" && (
                  <div className="w-7 h-7 rounded-full bg-[#2E4455] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-4 h-4 text-zinc-300" />
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
