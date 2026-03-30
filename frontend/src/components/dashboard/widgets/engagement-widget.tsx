'use client';

import { useState } from 'react';
import { format, subDays } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { useEngagementOverTime } from '@/lib/api/hooks-analytics';
import { EngagementAreaChart } from '@/components/charts/engagement-area-chart';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DateRange } from 'react-day-picker';

const PRESETS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
] as const;

export default function EngagementWidget() {
  const [range, setRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [period, setPeriod] = useState('daily');

  const dateFrom = range?.from ? format(range.from, 'yyyy-MM-dd') : undefined;
  const dateTo = range?.to ? format(range.to, 'yyyy-MM-dd') : undefined;

  const { data, isLoading } = useEngagementOverTime(period, dateFrom, dateTo);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs">
              <CalendarIcon className="mr-1 h-3 w-3" />
              {range?.from ? (
                range.to ? (
                  <>
                    {format(range.from, 'MMM dd')} – {format(range.to, 'MMM dd')}
                  </>
                ) : (
                  format(range.from, 'MMM dd, yyyy')
                )
              ) : (
                'Select dates'
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto border-slate-200/70 bg-slate-50/95 p-3 shadow-lg dark:border-slate-800 dark:bg-slate-950/95"
            align="start"
          >
            <div className="mb-2 flex gap-1">
              {PRESETS.map((p) => (
                <Button
                  key={p.days}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() =>
                    setRange({ from: subDays(new Date(), p.days), to: new Date() })
                  }
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <Calendar
              mode="range"
              selected={range}
              onSelect={setRange}
              disabled={{ after: new Date() }}
              showOutsideDays={false}
              className="rounded-md bg-transparent"
            />
          </PopoverContent>
        </Popover>

        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="h-7 w-[90px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hourly">Hourly</SelectItem>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="min-h-0 flex-1">
        {isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : !data || data.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            No engagement data for this period
          </div>
        ) : (
          <EngagementAreaChart data={data} height={200} />
        )}
      </div>
    </div>
  );
}
