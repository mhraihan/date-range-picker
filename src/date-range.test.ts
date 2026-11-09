import { describe, expect, it } from "vitest";
import {
  addMonths,
  deserializeDateRange,
  detectPreset,
  formatDateRange,
  formatIsoDate,
  getCalendarDays,
  getPresetRange,
  getPreviousPeriod,
  getWeekdayLabels,
  parseIsoDate,
  parsePickerValue,
} from "./date-range";
import { filterByDateRange, toDate } from "./filter";

const iso = formatIsoDate;

describe("addMonths", () => {
  it("clamps to the last day of shorter months", () => {
    expect(iso(addMonths(new Date(2026, 2, 31), -1))).toBe("2026-02-28");
    expect(iso(addMonths(new Date(2024, 0, 31), 1))).toBe("2024-02-29");
    expect(iso(addMonths(new Date(2026, 11, 15), 1))).toBe("2027-01-15");
  });
});

describe("getPresetRange", () => {
  it("returns the previous month on the 31st", () => {
    const range = getPresetRange("lastMonth", { now: new Date(2026, 2, 31) });
    expect(iso(range.start)).toBe("2026-02-01");
    expect(iso(range.end)).toBe("2026-02-28");
  });

  it("last 7 days includes today", () => {
    const range = getPresetRange("last7days", { now: new Date(2026, 10, 9, 15) });
    expect(iso(range.start)).toBe("2026-11-03");
    expect(iso(range.end)).toBe("2026-11-09");
  });

  it("detectPreset round-trips", () => {
    const now = new Date(2026, 10, 9);
    for (const preset of ["today", "yesterday", "last7days", "last30days", "lastMonth"] as const) {
      expect(detectPreset(getPresetRange(preset, { now }), { now })).toBe(preset);
    }
  });
});

describe("parseIsoDate", () => {
  it("rejects impossible dates", () => {
    expect(parseIsoDate("2024-02-31")).toBeNull();
    expect(parseIsoDate("2024-13-01")).toBeNull();
    expect(parseIsoDate("nope")).toBeNull();
  });

  it("parses as local midnight", () => {
    const date = parseIsoDate("2024-05-01")!;
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2024, 4, 1, 0]);
  });
});

describe("deserializeDateRange / parsePickerValue", () => {
  it("swaps reversed ranges", () => {
    const range = deserializeDateRange("2026-11-09", "2026-11-01");
    expect(iso(range.start)).toBe("2026-11-01");
    expect(iso(range.end)).toBe("2026-11-09");
    expect(range.end.getHours()).toBe(23);
  });

  it("uses the fallback for invalid input", () => {
    const fallback = { start: new Date(2020, 0, 1), end: new Date(2020, 0, 2) };
    expect(deserializeDateRange("bad", "2026-11-01", fallback)).toBe(fallback);
  });

  it("parsePickerValue normalises order", () => {
    const range = parsePickerValue("2026-11-09--2026-11-01")!;
    expect(iso(range.start)).toBe("2026-11-01");
  });
});

describe("getPreviousPeriod", () => {
  it("has the same number of days", () => {
    const previous = getPreviousPeriod({
      start: new Date(2026, 10, 1),
      end: new Date(2026, 10, 7, 23, 59, 59, 999),
    });
    expect(iso(previous.start)).toBe("2026-10-25");
    expect(iso(previous.end)).toBe("2026-10-31");
  });

  it("handles a single day", () => {
    const previous = getPreviousPeriod({ start: new Date(2026, 10, 9), end: new Date(2026, 10, 9) });
    expect(iso(previous.start)).toBe("2026-11-08");
    expect(iso(previous.end)).toBe("2026-11-08");
  });
});

describe("calendar helpers", () => {
  it("starts the grid on the requested weekday", () => {
    // Nov 1 2026 is a Sunday.
    expect(iso(getCalendarDays(2026, 10)[0])).toBe("2026-11-01");
    expect(iso(getCalendarDays(2026, 10, 1)[0])).toBe("2026-10-26");
    expect(getCalendarDays(2026, 10)).toHaveLength(42);
  });

  it("orders weekday labels", () => {
    expect(getWeekdayLabels("en-US", 0)[0]).toBe("Sun");
    expect(getWeekdayLabels("en-US", 1)[0]).toBe("Mon");
  });

  it("formats a single day without repeating it", () => {
    const day = new Date(2026, 10, 9);
    expect(formatDateRange({ start: day, end: day })).toBe("Nov 9, 2026");
  });
});

describe("filterByDateRange", () => {
  const range = { start: new Date(2024, 4, 1), end: new Date(2024, 4, 1, 23, 59) };

  it("treats date-only strings as local dates", () => {
    expect(toDate("2024-05-01")?.getDate()).toBe(1);
    const rows = [{ d: "2024-05-01" }, { d: "2024-04-30" }, { d: null }, { d: "garbage" }];
    expect(filterByDateRange(rows, { range, getDate: (row) => row.d })).toEqual([{ d: "2024-05-01" }]);
  });
});
