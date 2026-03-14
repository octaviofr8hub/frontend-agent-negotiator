"use client";

import { useState, useEffect, useRef } from "react";
import { useDebounce } from "use-debounce";
import { searchLocations, type LocationItem } from "@/services/zayrenService";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { MapPin, Loader2 } from "lucide-react";

interface LocationPickerProps {
  label: string;
  value: LocationItem | null;
  onChange: (location: LocationItem) => void;
}

export function LocationPicker({ label, value, onChange }: LocationPickerProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebounce(query, 300);
  const [open, setOpen] = useState(false);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when popover opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Fetch locations when debounced query changes
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setLocations([]);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      try {
        const results = await searchLocations(debouncedQuery, 5);
        if (!cancelled) setLocations(results);
      } catch {
        if (!cancelled) setLocations([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery("");
      setLocations([]);
    }
  };

  const handleSelect = (location: LocationItem) => {
    onChange(location);
    setOpen(false);
    setQuery("");
    setLocations([]);
  };

  const displayText = value
    ? `${value.accent_city || value.city}, ${value.accent_state || value.state}`
    : label;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`w-full flex items-center gap-2 h-10 rounded-lg border px-3 text-sm text-left transition-colors ${
            value
              ? "border-zinc-700 bg-zinc-800 text-white"
              : "border-zinc-700 bg-zinc-800 text-zinc-500"
          } hover:border-[#B1CA1E]/50 focus:outline-none focus:ring-2 focus:ring-[#B1CA1E]/50`}
        >
          <MapPin className="w-4 h-4 text-[#B1CA1E] flex-shrink-0" />
          <span className="truncate flex-1">{displayText}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="p-2 border-b border-zinc-700">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search city, state..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-md border-0 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#B1CA1E]/50"
          />
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-4 text-zinc-400 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Searching...</span>
            </div>
          ) : locations.length === 0 ? (
            <div className="py-4 text-center text-sm text-zinc-500">
              {debouncedQuery.length < 2 ? "Type to search..." : "No results found"}
            </div>
          ) : (
            locations.map((loc) => (
              <button
                key={loc.location_id}
                type="button"
                onClick={() => handleSelect(loc)}
                className="w-full text-left rounded-md px-3 py-2 text-sm hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <span className="text-white font-medium">{loc.accent_city || loc.city}</span>
                <span className="text-zinc-400">
                  , {loc.accent_state || loc.state} — {loc.accent_country || loc.country}
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
