'use client';

interface HeatmapControlsProps {
  sentimentFilter: string | undefined;
  onSentimentFilterChange: (val: string | undefined) => void;
  dateFrom: string;
  onDateFromChange: (val: string) => void;
  dateTo: string;
  onDateToChange: (val: string) => void;
}

export default function HeatmapControls({
  sentimentFilter,
  onSentimentFilterChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
}: HeatmapControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <label htmlFor="sentiment-filter" className="text-sm font-medium">
          Sentiment
        </label>
        <select
          id="sentiment-filter"
          value={sentimentFilter ?? ''}
          onChange={(e) =>
            onSentimentFilterChange(e.target.value || undefined)
          }
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All</option>
          <option value="positive">Positive</option>
          <option value="negative">Negative</option>
          <option value="neutral">Neutral</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="date-from" className="text-sm font-medium">
          From
        </label>
        <input
          id="date-from"
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="date-to" className="text-sm font-medium">
          To
        </label>
        <input
          id="date-to"
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
    </div>
  );
}
