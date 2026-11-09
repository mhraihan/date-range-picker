export interface DateRange {
  start: Date;
  end: Date;
}

export type DateRangePreset =
  | "today"
  | "yesterday"
  | "last7days"
  | "last30days"
  | "thisMonth"
  | "lastMonth"
  | "custom";

export interface DateRangePresetOption {
  value: DateRangePreset;
  label: string;
}

export interface DateRangeOptions {
  now?: Date;
}

/** 0 = Sunday, 1 = Monday, ... 6 = Saturday */
export type WeekStartsOn = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const DEFAULT_PRESETS: ReadonlyArray<DateRangePresetOption> = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7days", label: "Last 7 days" },
  { value: "last30days", label: "Last 30 days" },
  { value: "thisMonth", label: "This month" },
  { value: "lastMonth", label: "Last month" },
  { value: "custom", label: "Custom" },
];

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function endOfDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Adds calendar months, clamping the day so that e.g. Mar 31 - 1 month is
 * Feb 28/29 (not Mar 3, which is what `Date#setMonth` produces).
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

/** Whole calendar days from `b` to `a` (DST safe). */
export function differenceInCalendarDays(a: Date, b: Date): number {
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcA - utcB) / MS_PER_DAY);
}

export function differenceInCalendarMonths(a: Date, b: Date): number {
  return (
    (a.getFullYear() - b.getFullYear()) * 12 + (a.getMonth() - b.getMonth())
  );
}

/** Returns a range whose start is the start of the earlier day and end is the end of the later day. */
export function normalizeRange(a: Date, b: Date): DateRange {
  return a.getTime() <= b.getTime()
    ? { start: startOfDay(a), end: endOfDay(b) }
    : { start: startOfDay(b), end: endOfDay(a) };
}

export function clampDate(date: Date, min?: Date | null, max?: Date | null): Date {
  if (min && differenceInCalendarDays(date, min) < 0) return startOfDay(min);
  if (max && differenceInCalendarDays(date, max) > 0) return startOfDay(max);
  return date;
}

export function getPresetRange(
  preset: DateRangePreset,
  options: DateRangeOptions = {},
): DateRange {
  const today = startOfDay(options.now ?? new Date());

  switch (preset) {
    case "today":
      return { start: today, end: endOfDay(today) };
    case "yesterday": {
      const yesterday = addDays(today, -1);
      return { start: yesterday, end: endOfDay(yesterday) };
    }
    case "last7days":
      return { start: addDays(today, -6), end: endOfDay(today) };
    case "last30days":
      return { start: addDays(today, -29), end: endOfDay(today) };
    case "thisMonth":
      return { start: startOfMonth(today), end: endOfDay(today) };
    case "lastMonth": {
      const lastMonth = addMonths(startOfMonth(today), -1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    }
    case "custom":
    default:
      return { start: today, end: endOfDay(today) };
  }
}

export function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parses a `YYYY-MM-DD` string as a local date. Returns `null` for malformed
 * or impossible dates such as `2024-02-31`.
 */
export function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function formatPickerValue(range: DateRange): string {
  return `${formatIsoDate(range.start)}--${formatIsoDate(range.end)}`;
}

export function parsePickerValue(value: string): DateRange | null {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})--(\d{4}-\d{2}-\d{2})$/);
  if (!match) return null;

  const start = parseIsoDate(match[1]);
  const end = parseIsoDate(match[2]);
  if (!start || !end) return null;

  return normalizeRange(start, end);
}

export function formatDisplayDate(
  date: Date,
  locale = "en-US",
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  },
): string {
  return date.toLocaleDateString(locale, options);
}

export function formatShortDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

export function formatDateRange(range: DateRange, locale = "en-US"): string {
  const start = formatDisplayDate(range.start, locale);
  if (isSameDay(range.start, range.end)) return start;
  return `${start} – ${formatDisplayDate(range.end, locale)}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isBetween(date: Date, start: Date, end: Date): boolean {
  const current = startOfDay(date).getTime();
  const rangeStart = startOfDay(start).getTime();
  const rangeEnd = startOfDay(end).getTime();
  return current >= rangeStart && current <= rangeEnd;
}

/**
 * Returns the 42 days (6 weeks) shown in a month grid, starting on
 * `weekStartsOn` (0 = Sunday, the default).
 */
export function getCalendarDays(
  year: number,
  month: number,
  weekStartsOn: WeekStartsOn = 0,
): Date[] {
  const firstDay = new Date(year, month, 1);
  const offset = (firstDay.getDay() - weekStartsOn + 7) % 7;
  const calendarStart = new Date(year, month, 1 - offset);
  const days: Date[] = [];

  for (let index = 0; index < 42; index += 1) {
    days.push(addDays(calendarStart, index));
  }

  return days;
}

/** Localised short weekday names, ordered from `weekStartsOn`. */
export function getWeekdayLabels(
  locale = "en-US",
  weekStartsOn: WeekStartsOn = 0,
  format: "narrow" | "short" | "long" = "short",
): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: format });
  // Jan 4 2015 was a Sunday.
  return Array.from({ length: 7 }, (_, index) =>
    formatter.format(new Date(2015, 0, 4 + ((index + weekStartsOn) % 7))),
  );
}

export function getMonthYearLabel(date: Date, locale = "en-US"): string {
  return date.toLocaleDateString(locale, { month: "long", year: "numeric" });
}

export function detectPreset(
  range: DateRange,
  options: DateRangeOptions = {},
  presets: ReadonlyArray<DateRangePresetOption> = DEFAULT_PRESETS,
): DateRangePreset {
  for (const preset of presets) {
    if (preset.value === "custom") continue;

    const presetRange = getPresetRange(preset.value, options);
    if (
      isSameDay(range.start, presetRange.start) &&
      isSameDay(range.end, presetRange.end)
    ) {
      return preset.value;
    }
  }

  return "custom";
}

export function getDefaultRange(options: DateRangeOptions = {}): DateRange {
  return getPresetRange("last30days", options);
}

export function serializeDateRange(range: DateRange): {
  startDate: string;
  endDate: string;
} {
  return {
    startDate: formatIsoDate(range.start),
    endDate: formatIsoDate(range.end),
  };
}

export function deserializeDateRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  fallback?: DateRange,
): DateRange {
  const start = startDate ? parseIsoDate(startDate) : null;
  const end = endDate ? parseIsoDate(endDate) : null;
  if (start && end) return normalizeRange(start, end);
  return fallback ?? getDefaultRange();
}

/**
 * The period of equal length immediately before `range`, e.g. Nov 1–7 → Oct 25–31.
 */
export function getPreviousPeriod(range: DateRange): DateRange {
  const days = differenceInCalendarDays(range.end, range.start) + 1;
  const previousEnd = addDays(startOfDay(range.start), -1);
  const previousStart = addDays(previousEnd, -(days - 1));
  return { start: startOfDay(previousStart), end: endOfDay(previousEnd) };
}
