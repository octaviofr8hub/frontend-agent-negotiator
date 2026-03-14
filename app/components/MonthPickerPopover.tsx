"use client";

import { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

interface MonthPickerPopoverProps {
  value: Date | null;
  onChange: (date: Date) => void;
}

export function MonthPickerPopover({ value, onChange }: MonthPickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState<Date>(() => value || new Date());

  useEffect(() => {
    if (value) setCurrentDate(value);
  }, [value]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const days: { day: number; isCurrentMonth: boolean; date: Date }[] = [];

    const prevMonth = new Date(year, month, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ day: prevMonth - i, isCurrentMonth: false, date: new Date(year, month - 1, prevMonth - i) });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ day: d, isCurrentMonth: true, date: new Date(year, month, d) });
    }
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      days.push({ day: d, isCurrentMonth: false, date: new Date(year, month + 1, d) });
    }
    return days;
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  const handleDayClick = (dayInfo: { day: number; isCurrentMonth: boolean; date: Date }) => {
    if (!dayInfo.isCurrentMonth) return;
    onChange(dayInfo.date);
    setOpen(false);
  };

  const navigateMonth = (dir: "prev" | "next") => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + (dir === "prev" ? -1 : 1));
      return d;
    });
  };

  const isToday = (d: Date) => d.toDateString() === new Date().toDateString();
  const isSelected = (d: Date) => value && d.toDateString() === value.toDateString();

  const formatted = value
    ? value.toLocaleDateString("en-US", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`w-full flex items-center gap-2 h-10 rounded-lg border px-3 text-sm text-left transition-colors ${
            value
              ? "border-zinc-700 bg-zinc-800 text-white"
              : "border-zinc-700 bg-zinc-800 text-zinc-500"
          } hover:border-[#B1CA1E]/50 focus:outline-none focus:ring-2 focus:ring-[#B1CA1E]/50`}
        >
          <Calendar className="w-4 h-4 text-[#B1CA1E] flex-shrink-0" />
          <span className="truncate flex-1">{formatted || "Select date"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <button type="button" onClick={() => navigateMonth("prev")} className="p-1 hover:bg-zinc-800 rounded transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
          <button type="button" onClick={() => navigateMonth("next")} className="p-1 hover:bg-zinc-800 rounded transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Day names */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {dayNames.map((d) => (
            <div key={d} className="text-center text-[10px] font-medium text-zinc-500 py-1">{d}</div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {getDaysInMonth(currentDate).map((dayInfo, i) => (
            <button
              key={i}
              type="button"
              disabled={!dayInfo.isCurrentMonth}
              onClick={() => handleDayClick(dayInfo)}
              className={`h-8 w-full rounded text-xs transition-colors ${
                !dayInfo.isCurrentMonth
                  ? "text-zinc-700 cursor-default"
                  : isSelected(dayInfo.date)
                  ? "bg-[#B1CA1E] text-black font-bold"
                  : isToday(dayInfo.date)
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-300 hover:bg-zinc-800 cursor-pointer"
              }`}
            >
              {dayInfo.day}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
