"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";

interface TrailerTypeSelectProps {
  value: string;
  onChange: (value: string) => void;
}

export function TrailerTypeSelect({ value, onChange }: TrailerTypeSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Trailer type" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="dry_van">Dry Van</SelectItem>
        <SelectItem value="flatbed">Flatbed</SelectItem>
        <SelectItem value="reefer">Reefer</SelectItem>
      </SelectContent>
    </Select>
  );
}
