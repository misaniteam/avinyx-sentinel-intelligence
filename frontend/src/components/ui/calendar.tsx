"use client";

import * as React from "react";
import { DayPicker, type DayButton, type Locale } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
} from "lucide-react";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "dropdown",
  locale,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  locale?: Partial<Locale>;
}) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      locale={locale}
      className={cn("bg-background rounded-lg", className)}
      classNames={{
        months: "flex flex-col gap-4",
        month: "space-y-3",
        nav: "flex items-center justify-between",
        month_caption: "flex justify-center font-medium text-sm",
        dropdowns: "flex items-center gap-1",
        weekdays: "flex justify-between",
        weekday: "w-9 text-center text-xs text-muted-foreground",
        week: "flex justify-between",
        day: "h-9 w-9 flex items-center justify-center",
        today: "bg-muted rounded-md",
        selected: "bg-primary text-primary-foreground rounded-md",
        outside: "text-muted-foreground opacity-50",
        disabled: "opacity-50",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          if (orientation === "left")
            return <ChevronLeftIcon className="h-4 w-4" />;
          if (orientation === "right")
            return <ChevronRightIcon className="h-4 w-4" />;
          return <ChevronDownIcon className="h-4 w-4" />;
        },
        DayButton: (props) => <CalendarDayButton {...props} />,
        ...components,
      }}
      {...props}
      numberOfMonths={1} // ✅ After {...props} so it always wins
    />
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "h-9 w-9 p-0",
        modifiers.selected && "bg-primary text-primary-foreground",
        modifiers.today && "bg-muted",
        className,
      )}
      {...props}
    >
      {day.date.getDate()}
    </Button>
  );
}

export { Calendar };