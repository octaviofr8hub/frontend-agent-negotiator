import { ZayrenLogo } from "@/app/components/Logo";
import { NegotiationPanel } from "@/app/components/NegotiationPanel";

export default function Home() {
  return (
    <div className="min-h-screen bg-black">
      {/* Top Bar */}
      <header className="border-b border-zinc-800 bg-black/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ZayrenLogo showText={true} width={36} height={28} />
            <div className="h-6 w-px bg-zinc-800" />
            <div>
              <h1 className="text-sm font-semibold text-white">Negotiation Agent</h1>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">AI-Powered Carrier Calls</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-zinc-900 border border-zinc-800 px-3 py-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-zinc-400">System Online</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <NegotiationPanel />
      </main>
    </div>
  );
}
