"use client";

import { useState, useMemo } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { WB_CONSTITUENCIES, WB_CONSTITUENCY_MAP } from "@/lib/data/wb-constituencies";

interface ConstituencyComboboxProps {
  value: string;
  onValueChange: (code: string) => void;
  availableCodes?: string[];
}

export function ConstituencyCombobox({
  value,
  onValueChange,
  availableCodes,
}: ConstituencyComboboxProps) {
  const [open, setOpen] = useState(false);

  const constituencies = useMemo(() => {
    if (!availableCodes) return WB_CONSTITUENCIES;
    const codeSet = new Set(availableCodes);
    return WB_CONSTITUENCIES.filter((c) => codeSet.has(c.code));
  }, [availableCodes]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof constituencies>();
    for (const c of constituencies) {
      const existing = map.get(c.district);
      if (existing) {
        existing.push(c);
      } else {
        map.set(c.district, [c]);
      }
    }
    return map;
  }, [constituencies]);

  const selected = value ? WB_CONSTITUENCY_MAP.get(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selected
            ? `${selected.name} (${selected.district})`
            : "Select constituency..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search constituency..." />
          <CommandList>
            <CommandEmpty>No constituency found.</CommandEmpty>
            {Array.from(grouped.entries()).map(([district, items]) => (
              <CommandGroup key={district} heading={district}>
                {items.map((c) => (
                  <CommandItem
                    key={c.code}
                    value={`${c.name} ${c.district}`}
                    onSelect={() => {
                      onValueChange(c.code);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-1 h-4 w-4 text-theme-primary",
                        value === c.code ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {c.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
