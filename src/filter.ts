import { isBetween, parseIsoDate, type DateRange } from "./date-range";

export type DateInput = Date | string | number | null | undefined;

export interface DateRangeFilterOptions<Item> {
  range: DateRange;
  getDate: (item: Item) => DateInput;
}

/**
 * Converts a date-ish value to a `Date`. Date-only strings (`YYYY-MM-DD`) are
 * read as local dates; `new Date("2024-05-01")` would read them as UTC
 * midnight, which lands on the previous day in negative-offset time zones.
 */
export function toDate(value: DateInput): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string") {
    const dateOnly = parseIsoDate(value);
    if (dateOnly) return dateOnly;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function filterByDateRange<Item>(
  items: ReadonlyArray<Item>,
  options: DateRangeFilterOptions<Item>,
): Item[] {
  const { range, getDate } = options;
  return items.filter((item) => {
    const date = toDate(getDate(item));
    return date ? isBetween(date, range.start, range.end) : false;
  });
}
