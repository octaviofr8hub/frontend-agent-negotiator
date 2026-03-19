"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Room, RoomEvent, Track, RemoteParticipant } from "livekit-client";
import { Button } from "@/app/components/ui/button";
import {
  Mic,
  MicOff,
  PhoneOff,
  Loader2,
  Headphones,
  Radio,
  User,
} from "lucide-react";

interface LiveKitControlsProps {
  token: string;
  roomName: string;
  livekitUrl: string;
  participantIdentity: string;
  onDisconnect?: () => void;
}

/* ── Audio-level helper (Web Audio API) ─────────────────── */

function useAudioLevel(track: MediaStreamTrack | null) {
  const [level, setLevel] = useState(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!track) {
      setLevel(0);
      return;
    }

    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.6;

    const stream = new MediaStream([track]);
    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);

    ctxRef.current = ctx;
    analyserRef.current = analyser;
    sourceRef.current = source;

    const buf = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(buf);
      // Average the frequency bins to get a single 0-1 value
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i];
      const avg = sum / buf.length / 255;
      setLevel(avg);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      source.disconnect();
      ctx.close().catch(() => {});
    };
  }, [track]);

  return level;
}

/* ── Voice visualizer bars ──────────────────────────────── */

function VoiceBars({ level, color, barCount = 5 }: { level: number; color: string; barCount?: number }) {
  const mid = Math.floor(barCount / 2);

  return (
    <div className="flex items-center justify-center gap-[3px] h-8">
      {Array.from({ length: barCount }).map((_, i) => {
        // Bars grow from center outward
        const distFromCenter = Math.abs(i - mid);
        const factor = Math.max(0, 1 - distFromCenter * 0.25);
        const h = Math.max(6, level * factor * 32);
        return (
          <div
            key={i}
            className="rounded-full transition-all duration-75"
            style={{
              width: 4,
              height: h,
              backgroundColor: color,
              opacity: 0.5 + level * 0.5,
              boxShadow: level > 0.15 ? `0 0 ${4 + level * 6}px ${color}40` : "none",
            }}
          />
        );
      })}
    </div>
  );
}

/* ── Call duration timer ────────────────────────────────── */

function useTimer(running: boolean) {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      setSeconds(0);
      intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

/* ── Main component ─────────────────────────────────────── */

export function LiveKitControls({
  token,
  roomName,
  livekitUrl,
  participantIdentity,
  onDisconnect,
}: LiveKitControlsProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<string[]>([]);

  const roomRef = useRef<Room | null>(null);
  const audioContainerRef = useRef<HTMLDivElement | null>(null);

  // Media tracks for audio visualization
  const [localTrack, setLocalTrack] = useState<MediaStreamTrack | null>(null);
  const [remoteTrack, setRemoteTrack] = useState<MediaStreamTrack | null>(null);

  const localLevel = useAudioLevel(localTrack);
  const remoteLevel = useAudioLevel(remoteTrack);

  const duration = useTimer(isConnected);

  // Collect remote participant names (not supervisor)
  const updateRemoteParticipants = useCallback((room: Room) => {
    const names: string[] = [];
    room.remoteParticipants.forEach((p: RemoteParticipant) => {
      if (!p.identity.toLowerCase().includes("supervisor")) {
        names.push(p.identity);
      }
    });
    setRemoteParticipants(names);
  }, []);

  // Connect to LiveKit room and publish microphone
  useEffect(() => {
    let cancelled = false;

    const connect = async () => {
      setIsConnecting(true);
      setError(null);

      try {
        const room = new Room({
          audioCaptureDefaults: {
            autoGainControl: true,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        roomRef.current = room;

        room.on(RoomEvent.Connected, async () => {
          if (cancelled) return;
          setIsConnected(true);
          updateRemoteParticipants(room);

          try {
            await room.localParticipant.setMicrophoneEnabled(true);
            setIsMuted(false);
            // Extract local mic MediaStreamTrack for visualizer
            const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
            if (micPub?.track?.mediaStreamTrack) {
              setLocalTrack(micPub.track.mediaStreamTrack);
            }
          } catch {
            setError("No se pudo activar el micrófono. Revisa los permisos.");
          }
        });

        room.on(RoomEvent.Disconnected, () => {
          if (cancelled) return;
          setIsConnected(false);
          setLocalTrack(null);
          setRemoteTrack(null);
          onDisconnect?.();
        });

        room.on(RoomEvent.Reconnecting, () => {
          if (!cancelled) setError("Reconectando...");
        });
        room.on(RoomEvent.Reconnected, () => {
          if (!cancelled) setError(null);
        });

        // Remote audio tracks
        room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
          if (track.kind === Track.Kind.Audio && audioContainerRef.current) {
            const el = track.attach() as HTMLAudioElement;
            el.autoplay = true;
            el.volume = 1.0;
            audioContainerRef.current.appendChild(el);

            // Use the first non-supervisor remote audio for visualization
            if (!participant.identity.toLowerCase().includes("supervisor")) {
              if (track.mediaStreamTrack) {
                setRemoteTrack(track.mediaStreamTrack);
              }
            }
          }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          if (track.kind === Track.Kind.Audio) {
            track.detach().forEach((el) => el.remove());
            if (track.mediaStreamTrack) {
              setRemoteTrack((prev) =>
                prev === track.mediaStreamTrack ? null : prev,
              );
            }
          }
        });

        // Update local track ref when mic is published
        room.on(RoomEvent.LocalTrackPublished, (publication) => {
          if (publication.source === Track.Source.Microphone && publication.track?.mediaStreamTrack) {
            setLocalTrack(publication.track.mediaStreamTrack);
          }
        });

        room.on(RoomEvent.ParticipantConnected, () => updateRemoteParticipants(room));
        room.on(RoomEvent.ParticipantDisconnected, () => updateRemoteParticipants(room));

        await room.connect(livekitUrl, token);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error de conexión");
        }
      } finally {
        if (!cancelled) setIsConnecting(false);
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    };
  }, [token, livekitUrl, roomName, onDisconnect, updateRemoteParticipants]);

  const toggleMute = async () => {
    if (!roomRef.current) return;
    try {
      const newMuted = !isMuted;
      await roomRef.current.localParticipant.setMicrophoneEnabled(!newMuted);
      setIsMuted(newMuted);
      if (newMuted) {
        setLocalTrack(null);
      } else {
        const micPub = roomRef.current.localParticipant.getTrackPublication(Track.Source.Microphone);
        if (micPub?.track?.mediaStreamTrack) {
          setLocalTrack(micPub.track.mediaStreamTrack);
        }
      }
    } catch {
      setError("Error al cambiar el micrófono");
    }
  };

  const handleDisconnect = () => {
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    setIsConnected(false);
    setLocalTrack(null);
    setRemoteTrack(null);
    onDisconnect?.();
  };

  /* ── Always render the panel — collapse only content based on state ── */
  const carrierLabel = remoteParticipants.length > 0
    ? remoteParticipants[0]
    : "Carrier";

  /* ── Connecting / error / disconnected (not yet live) ─── */
  if (!isConnected) {
    return (
      <div className="rounded-xl border border-[#B1CA1E]/30 bg-gradient-to-b from-zinc-900 to-black p-8">
        <div className="flex flex-col items-center gap-4">
          {error ? (
            <>
              <div className="w-16 h-16 rounded-full border-2 border-red-700/50 bg-red-900/20 flex items-center justify-center">
                <PhoneOff className="w-7 h-7 text-red-400" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-red-400">Error de conexión</p>
                <p className="text-xs text-zinc-500 max-w-xs text-center">{error}</p>
              </div>
            </>
          ) : (
            <>
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-2 border-[#B1CA1E]/30 flex items-center justify-center">
                  <Loader2 className="w-7 h-7 text-[#B1CA1E] animate-spin" />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-[#B1CA1E]/20 animate-ping" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-zinc-300">Conectando a la llamada...</p>
                <p className="text-xs text-zinc-500 mt-1">El navegador pedirá acceso al micrófono</p>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ── Connected — Full voice panel ─────────────────────── */
  return (
    <div className="rounded-xl border border-[#B1CA1E]/40 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black overflow-hidden">
      {/* ── Header bar ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/60 bg-zinc-900/50">
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center">
            <Radio className="w-4 h-4 text-red-500" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          </div>
          <span className="text-sm font-semibold text-red-400 uppercase tracking-wider">En Vivo</span>
        </div>
        <span className="text-sm font-mono text-zinc-400 tabular-nums">{duration}</span>
      </div>

      {/* ── Participants area ── */}
      <div className="px-5 py-6">
        <div className="grid grid-cols-2 gap-6">
          {/* — Supervisor (You) — */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              {/* Glow ring when speaking */}
              <div
                className="absolute inset-0 rounded-full transition-all duration-150"
                style={{
                  boxShadow: localLevel > 0.08
                    ? `0 0 ${12 + localLevel * 30}px ${4 + localLevel * 10}px rgba(177,202,30,${0.15 + localLevel * 0.35})`
                    : "none",
                  transform: `scale(${1 + localLevel * 0.08})`,
                }}
              />
              <div
                className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-150 ${
                  isMuted
                    ? "bg-zinc-800 border-2 border-zinc-700"
                    : "bg-[#B1CA1E]/15 border-2 border-[#B1CA1E]/50"
                }`}
              >
                {isMuted ? (
                  <MicOff className="w-6 h-6 text-zinc-500" />
                ) : (
                  <Headphones className="w-6 h-6 text-[#B1CA1E]" />
                )}
              </div>
            </div>
            <VoiceBars level={isMuted ? 0 : localLevel} color="#B1CA1E" />
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-200">Tú</p>
              <p className="text-[10px] text-zinc-500 font-mono">{participantIdentity}</p>
            </div>
          </div>

          {/* — Remote participant (Carrier / Phone user) — */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              {/* Glow ring when speaking */}
              <div
                className="absolute inset-0 rounded-full transition-all duration-150"
                style={{
                  boxShadow: remoteLevel > 0.08
                    ? `0 0 ${12 + remoteLevel * 30}px ${4 + remoteLevel * 10}px rgba(59,130,246,${0.15 + remoteLevel * 0.35})`
                    : "none",
                  transform: `scale(${1 + remoteLevel * 0.08})`,
                }}
              />
              <div className="relative w-16 h-16 rounded-full bg-blue-500/15 border-2 border-blue-500/50 flex items-center justify-center transition-all duration-150">
                <User className="w-6 h-6 text-blue-400" />
              </div>
            </div>
            <VoiceBars level={remoteLevel} color="#3B82F6" barCount={5} />
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-200">{carrierLabel}</p>
              <p className="text-[10px] text-zinc-500">Línea telefónica</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mx-5 mb-3 text-xs text-red-400 bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-2 text-center">
          {error}
        </div>
      )}

      {/* ── Controls bar ── */}
      <div className="flex items-center justify-center gap-4 px-5 py-4 border-t border-zinc-800/60 bg-zinc-900/30">
        <Button
          size="sm"
          variant={isMuted ? "destructive" : "default"}
          onClick={toggleMute}
          className={`rounded-full w-12 h-12 p-0 ${
            !isMuted ? "bg-[#B1CA1E]/20 hover:bg-[#B1CA1E]/30 border border-[#B1CA1E]/40 text-[#B1CA1E]" : ""
          }`}
          title={isMuted ? "Activar micrófono" : "Silenciar"}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </Button>

        <Button
          size="sm"
          variant="destructive"
          onClick={handleDisconnect}
          className="rounded-full w-12 h-12 p-0 bg-red-600 hover:bg-red-700"
          title="Finalizar llamada"
        >
          <PhoneOff className="w-5 h-5" />
        </Button>
      </div>

      {/* ── Status footer ── */}
      <div className="px-5 py-2 border-t border-zinc-800/40 bg-zinc-950/50">
        <p className="text-[10px] text-zinc-500 text-center">
          Conectado a <span className="text-zinc-400 font-mono">{roomName}</span> — El agente IA está en silencio mientras tú hablas
        </p>
      </div>

      {/* Hidden audio container for remote audio playback */}
      <div ref={audioContainerRef} className="hidden" />
    </div>
  );
}
