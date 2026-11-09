import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  addDays,
  addMonths,
  clampDate,
  DEFAULT_PRESETS,
  detectPreset,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  endOfDay,
  endOfMonth,
  formatDateRange,
  formatIsoDate,
  getCalendarDays,
  getMonthYearLabel,
  getPresetRange,
  getWeekdayLabels,
  isBetween,
  isSameDay,
  normalizeRange,
  startOfDay,
  startOfMonth,
  type DateRange,
  type DateRangePreset,
  type DateRangePresetOption,
  type WeekStartsOn,
} from "./date-range";

export interface DateRangeApplyEvent {
  range: DateRange;
  preset: DateRangePreset;
}

export interface DateRangePresetSelectEvent {
  preset: DateRangePreset;
  range: DateRange;
}

export interface DateRangePickerRenderTriggerOptions {
  label: string;
  isOpen: boolean;
  disabled: boolean;
  /** Id of the popover element, for `aria-controls`. */
  popoverId: string;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export interface DateRangePickerProps {
  value: DateRange;
  presets?: ReadonlyArray<DateRangePresetOption>;
  locale?: string;
  /**
   * Months shown side by side. With `2`, the picker automatically falls back
   * to a single month (and then a stacked layout) when the viewport is too
   * narrow, so it never overflows the page.
   */
  months?: 1 | 2;
  /** First day of the week, 0 = Sunday (default) … 6 = Saturday. */
  weekStartsOn?: WeekStartsOn;
  /** Earliest selectable day. */
  minDate?: Date;
  /** Latest selectable day, e.g. `new Date()` to block future dates. */
  maxDate?: Date;
  /** Which edge of the trigger the popover lines up with. Default `"end"`. */
  align?: "start" | "end";
  /**
   * Render the popover into `document.body` (default) so containers with
   * `overflow: hidden` or their own stacking context cannot clip it.
   */
  portal?: boolean;
  /** Custom element to portal into instead of `document.body`. */
  portalContainer?: HTMLElement | null;
  disabled?: boolean;
  className?: string;
  popoverClassName?: string;
  triggerLabel?: string;
  dialogLabel?: string;
  applyLabel?: string;
  cancelLabel?: string;
  previousMonthLabel?: string;
  nextMonthLabel?: string;
  onChange?: (range: DateRange) => void;
  onApply?: (event: DateRangeApplyEvent) => void;
  /** Called when the popover closes without applying (Cancel, Escape, click outside). */
  onCancel?: () => void;
  onDraftChange?: (range: DateRange) => void;
  onOpenChange?: (isOpen: boolean) => void;
  onPresetSelect?: (event: DateRangePresetSelectEvent) => void;
  renderTrigger?: (options: DateRangePickerRenderTriggerOptions) => ReactNode;
}

interface Layout {
  months: 1 | 2;
  compact: boolean;
}

const VIEWPORT_MARGIN = 8;
const POPOVER_GAP = 4;
const MIN_POPOVER_HEIGHT = 200;

const WIDE_TWO: Layout = { months: 2, compact: false };
const WIDE_ONE: Layout = { months: 1, compact: false };
const COMPACT_ONE: Layout = { months: 1, compact: true };

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function isOutOfBounds(date: Date, minDate?: Date, maxDate?: Date): boolean {
  return Boolean(
    (minDate && differenceInCalendarDays(date, minDate) < 0) ||
      (maxDate && differenceInCalendarDays(date, maxDate) > 0),
  );
}

export function DateRangePicker({
  value,
  presets = DEFAULT_PRESETS,
  locale = "en-US",
  months = 2,
  weekStartsOn = 0,
  minDate,
  maxDate,
  align = "end",
  portal = true,
  portalContainer,
  disabled = false,
  className,
  popoverClassName,
  triggerLabel,
  dialogLabel = "Select date range",
  applyLabel = "Apply",
  cancelLabel = "Cancel",
  previousMonthLabel = "Previous month",
  nextMonthLabel = "Next month",
  onChange,
  onApply,
  onCancel,
  onDraftChange,
  onOpenChange,
  onPresetSelect,
  renderTrigger,
}: DateRangePickerProps) {
  const popoverId = `csDateRangePicker-${useId().replace(/:/g, "")}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const focusDayOnRender = useRef(false);

  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange>(value);
  /** First clicked day while a custom range is being selected. */
  const [anchorDate, setAnchorDate] = useState<Date | null>(null);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [presetOverride, setPresetOverride] = useState<DateRangePreset | null>(
    null,
  );
  /** Right-most visible month. */
  const [lastMonth, setLastMonth] = useState(() => startOfMonth(value.end));
  const [focusedDate, setFocusedDate] = useState(() => startOfDay(value.end));
  const [layoutIndex, setLayoutIndex] = useState(0);
  const [measureKey, setMeasureKey] = useState(0);

  const layouts = useMemo<Layout[]>(
    () =>
      months === 2 ? [WIDE_TWO, WIDE_ONE, COMPACT_ONE] : [WIDE_ONE, COMPACT_ONE],
    [months],
  );
  const layout = layouts[Math.min(layoutIndex, layouts.length - 1)];

  const visibleMonths = useMemo(
    () =>
      Array.from({ length: layout.months }, (_, index) =>
        addMonths(lastMonth, index - (layout.months - 1)),
      ),
    [lastMonth, layout.months],
  );

  const weekdayLabels = useMemo(
    () => getWeekdayLabels(locale, weekStartsOn, "short"),
    [locale, weekStartsOn],
  );
  const dayLabelFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    [locale],
  );

  /* ------------------------------------------------------------------ */
  /* Open / close                                                        */
  /* ------------------------------------------------------------------ */

  const focusTrigger = useCallback(() => {
    containerRef.current
      ?.querySelector<HTMLElement>(
        "button, [href], [tabindex]:not([tabindex='-1']), s-button",
      )
      ?.focus();
  }, []);

  const open = useCallback(() => {
    if (disabled || isOpen) return;
    setDraft(value);
    setAnchorDate(null);
    setHoverDate(null);
    setPresetOverride(null);
    setLastMonth(startOfMonth(value.end));
    setFocusedDate(clampDate(startOfDay(value.end), minDate, maxDate));
    setLayoutIndex(0);
    setIsOpen(true);
    onOpenChange?.(true);
  }, [disabled, isOpen, maxDate, minDate, onOpenChange, value]);

  const close = useCallback(
    (restoreFocus = false) => {
      if (!isOpen) return;
      setIsOpen(false);
      onOpenChange?.(false);
      if (restoreFocus) focusTrigger();
    },
    [focusTrigger, isOpen, onOpenChange],
  );

  const dismiss = useCallback(
    (restoreFocus = false) => {
      if (!isOpen) return;
      onCancel?.();
      close(restoreFocus);
    },
    [close, isOpen, onCancel],
  );

  const toggle = useCallback(() => {
    if (isOpen) dismiss();
    else open();
  }, [dismiss, isOpen, open]);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const path = event.composedPath();
      if (containerRef.current && path.includes(containerRef.current)) return;
      if (popoverRef.current && path.includes(popoverRef.current)) return;
      dismiss(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      dismiss(true);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dismiss, isOpen]);

  useEffect(() => {
    if (isOpen) popoverRef.current?.focus({ preventScroll: true });
  }, [isOpen]);

  /* ------------------------------------------------------------------ */
  /* Positioning: fixed, clamped to the viewport, flips above if needed, */
  /* and steps down 2 months → 1 month → stacked until it fits.          */
  /* ------------------------------------------------------------------ */

  const updatePosition = useCallback(() => {
    const popover = popoverRef.current;
    const anchor = containerRef.current;
    if (!popover || !anchor) return;

    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight;
    const rect = anchor.getBoundingClientRect();

    popover.style.maxWidth = `${viewportWidth - VIEWPORT_MARGIN * 2}px`;
    popover.style.maxHeight = "";

    const width = popover.offsetWidth;
    const naturalHeight = popover.offsetHeight;
    const spaceBelow =
      viewportHeight - rect.bottom - POPOVER_GAP - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - POPOVER_GAP - VIEWPORT_MARGIN;
    const placeBelow = naturalHeight <= spaceBelow || spaceBelow >= spaceAbove;
    const maxHeight = Math.min(
      Math.max(placeBelow ? spaceBelow : spaceAbove, MIN_POPOVER_HEIGHT),
      viewportHeight - VIEWPORT_MARGIN * 2,
    );
    const height = Math.min(naturalHeight, maxHeight);

    const top = clamp(
      placeBelow ? rect.bottom + POPOVER_GAP : rect.top - POPOVER_GAP - height,
      VIEWPORT_MARGIN,
      viewportHeight - VIEWPORT_MARGIN - height,
    );
    const left = clamp(
      align === "start" ? rect.left : rect.right - width,
      VIEWPORT_MARGIN,
      viewportWidth - VIEWPORT_MARGIN - width,
    );

    popover.style.maxHeight = `${maxHeight}px`;
    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
    popover.style.visibility = "visible";
    popover.dataset.placement = placeBelow ? "bottom" : "top";
  }, [align]);

  useIsomorphicLayoutEffect(() => {
    if (!isOpen) return;
    const popover = popoverRef.current;
    if (!popover) return;

    updatePosition();
    const overflows = popover.scrollWidth > popover.clientWidth + 1;
    if (overflows && layoutIndex < layouts.length - 1) {
      setLayoutIndex((index) => index + 1);
    }
  }, [isOpen, layoutIndex, layouts.length, measureKey, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;

    let frame = 0;
    const schedule = (relayout: boolean) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (relayout) {
          setLayoutIndex(0);
          setMeasureKey((key) => key + 1);
        } else {
          updatePosition();
        }
      });
    };
    const handleResize = () => schedule(true);
    const handleScroll = () => schedule(false);

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => schedule(false));
    if (containerRef.current) observer?.observe(containerRef.current);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
      observer?.disconnect();
    };
  }, [isOpen, updatePosition]);

  /* ------------------------------------------------------------------ */
  /* Selection                                                           */
  /* ------------------------------------------------------------------ */

  const activePreset: DateRangePreset =
    presetOverride ?? (anchorDate ? "custom" : detectPreset(draft, {}, presets));

  const displayRange = useMemo(
    () =>
      anchorDate && hoverDate ? normalizeRange(anchorDate, hoverDate) : draft,
    [anchorDate, draft, hoverDate],
  );

  const canApply = anchorDate === null;

  const updateDraft = useCallback(
    (range: DateRange) => {
      setDraft(range);
      onDraftChange?.(range);
    },
    [onDraftChange],
  );

  const showMonthOf = useCallback(
    (date: Date) => {
      setLastMonth((current) => {
        const first = addMonths(current, -(layout.months - 1));
        if (differenceInCalendarMonths(date, first) < 0) {
          return addMonths(startOfMonth(date), layout.months - 1);
        }
        if (differenceInCalendarMonths(date, current) > 0) {
          return startOfMonth(date);
        }
        return current;
      });
    },
    [layout.months],
  );

  const handlePresetClick = useCallback(
    (preset: DateRangePreset) => {
      setAnchorDate(null);
      setHoverDate(null);

      if (preset === "custom") {
        setPresetOverride("custom");
        onPresetSelect?.({ preset, range: draft });
        return;
      }

      const range = getPresetRange(preset);
      setPresetOverride(null);
      updateDraft(range);
      setLastMonth(startOfMonth(range.end));
      setFocusedDate(startOfDay(range.end));
      onPresetSelect?.({ preset, range });
    },
    [draft, onPresetSelect, updateDraft],
  );

  const handleDayClick = useCallback(
    (date: Date) => {
      const clicked = startOfDay(date);
      setFocusedDate(clicked);
      setPresetOverride(null);
      setHoverDate(null);

      if (anchorDate) {
        setAnchorDate(null);
        updateDraft(normalizeRange(anchorDate, clicked));
      } else {
        setAnchorDate(clicked);
        updateDraft({ start: clicked, end: endOfDay(clicked) });
      }
    },
    [anchorDate, updateDraft],
  );

  const handleDayHover = useCallback(
    (date: Date) => {
      if (!anchorDate) return;
      setHoverDate((current) =>
        current && isSameDay(current, date) ? current : startOfDay(date),
      );
    },
    [anchorDate],
  );

  const moveFocus = useCallback(
    (date: Date) => {
      const next = clampDate(startOfDay(date), minDate, maxDate);
      focusDayOnRender.current = true;
      setFocusedDate(next);
      showMonthOf(next);
      if (anchorDate) setHoverDate(next);
    },
    [anchorDate, maxDate, minDate, showMonthOf],
  );

  const handleDayKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>, date: Date) => {
      const dayOfWeek = (date.getDay() - weekStartsOn + 7) % 7;
      let next: Date | null = null;

      switch (event.key) {
        case "ArrowLeft":
          next = addDays(date, -1);
          break;
        case "ArrowRight":
          next = addDays(date, 1);
          break;
        case "ArrowUp":
          next = addDays(date, -7);
          break;
        case "ArrowDown":
          next = addDays(date, 7);
          break;
        case "Home":
          next = addDays(date, -dayOfWeek);
          break;
        case "End":
          next = addDays(date, 6 - dayOfWeek);
          break;
        case "PageUp":
          next = addMonths(date, event.shiftKey ? -12 : -1);
          break;
        case "PageDown":
          next = addMonths(date, event.shiftKey ? 12 : 1);
          break;
        default:
          return;
      }

      event.preventDefault();
      moveFocus(next);
    },
    [moveFocus, weekStartsOn],
  );

  useEffect(() => {
    if (!focusDayOnRender.current) return;
    focusDayOnRender.current = false;
    popoverRef.current
      ?.querySelector<HTMLButtonElement>(
        `[data-date="${formatIsoDate(focusedDate)}"]`,
      )
      ?.focus();
  }, [focusedDate, lastMonth]);

  const handleApply = useCallback(() => {
    if (!canApply) return;
    onChange?.(draft);
    onApply?.({ range: draft, preset: activePreset });
    close(true);
  }, [activePreset, canApply, close, draft, onApply, onChange]);

  /* ------------------------------------------------------------------ */
  /* Rendering                                                           */
  /* ------------------------------------------------------------------ */

  const firstVisible = visibleMonths[0];
  const canGoPrevious =
    !minDate || differenceInCalendarMonths(firstVisible, minDate) > 0;
  const canGoNext =
    !maxDate || differenceInCalendarMonths(lastMonth, maxDate) < 0;

  // Exactly one day in the grid is reachable with Tab (roving tabindex).
  const tabbableDate = useMemo(() => {
    const visibleStart = firstVisible;
    const visibleEnd = endOfMonth(lastMonth);
    if (
      isBetween(focusedDate, visibleStart, visibleEnd) &&
      !isOutOfBounds(focusedDate, minDate, maxDate)
    ) {
      return focusedDate;
    }
    return clampDate(visibleStart, minDate, maxDate);
  }, [firstVisible, focusedDate, lastMonth, maxDate, minDate]);

  const today = startOfDay(new Date());

  function renderMonth(month: Date, index: number) {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const days = getCalendarDays(year, monthIndex, weekStartsOn);
    const labelId = `${popoverId}-month-${index}`;
    const isFirst = index === 0;
    const isLast = index === visibleMonths.length - 1;
    const weeks = Array.from({ length: 6 }, (_, week) =>
      days.slice(week * 7, week * 7 + 7),
    );

    return (
      <div className="csDateRangePicker-calendar" key={formatIsoDate(month)}>
        <div className="csDateRangePicker-monthHeader">
          {isFirst ? (
            <button
              type="button"
              className="csDateRangePicker-iconButton"
              aria-label={previousMonthLabel}
              disabled={!canGoPrevious}
              onClick={() => setLastMonth((current) => addMonths(current, -1))}
            >
              <ChevronIcon direction="left" />
            </button>
          ) : (
            <span className="csDateRangePicker-navSpacer" />
          )}
          <div
            className="csDateRangePicker-monthLabel"
            id={labelId}
            aria-live="polite"
          >
            {getMonthYearLabel(month, locale)}
          </div>
          {isLast ? (
            <button
              type="button"
              className="csDateRangePicker-iconButton"
              aria-label={nextMonthLabel}
              disabled={!canGoNext}
              onClick={() => setLastMonth((current) => addMonths(current, 1))}
            >
              <ChevronIcon direction="right" />
            </button>
          ) : (
            <span className="csDateRangePicker-navSpacer" />
          )}
        </div>

        <div
          className="csDateRangePicker-grid"
          role="grid"
          aria-labelledby={labelId}
        >
          <div className="csDateRangePicker-row" role="row">
            {weekdayLabels.map((weekday) => (
              <div
                className="csDateRangePicker-weekday"
                role="columnheader"
                key={weekday}
              >
                {weekday}
              </div>
            ))}
          </div>

          {weeks.map((week, weekIndex) => (
            <div className="csDateRangePicker-row" role="row" key={weekIndex}>
              {week.map((date) => {
                const key = formatIsoDate(date);
                if (date.getMonth() !== monthIndex) {
                  return (
                    <div
                      className="csDateRangePicker-cell"
                      role="gridcell"
                      key={key}
                    />
                  );
                }

                const isStart = isSameDay(date, displayRange.start);
                const isEnd = isSameDay(date, displayRange.end);
                const inRange = isBetween(
                  date,
                  displayRange.start,
                  displayRange.end,
                );
                const outOfBounds = isOutOfBounds(date, minDate, maxDate);

                return (
                  <button
                    type="button"
                    role="gridcell"
                    key={key}
                    data-date={key}
                    className={cx(
                      "csDateRangePicker-day",
                      inRange && "csDateRangePicker-dayInRange",
                      isStart && "csDateRangePicker-dayRangeStart",
                      isEnd && "csDateRangePicker-dayRangeEnd",
                      (isStart || isEnd) && "csDateRangePicker-daySelected",
                      date.getDate() === 1 && "csDateRangePicker-dayMonthStart",
                      isSameDay(date, endOfMonth(date)) &&
                        "csDateRangePicker-dayMonthEnd",
                      isSameDay(date, today) && "csDateRangePicker-dayToday",
                      anchorDate && "csDateRangePicker-dayPreview",
                    )}
                    aria-label={dayLabelFormatter.format(date)}
                    aria-selected={inRange}
                    aria-current={isSameDay(date, today) ? "date" : undefined}
                    disabled={outOfBounds}
                    tabIndex={isSameDay(date, tabbableDate) ? 0 : -1}
                    onClick={() => handleDayClick(date)}
                    onMouseEnter={() => handleDayHover(date)}
                    onFocus={() => setFocusedDate(startOfDay(date))}
                    onKeyDown={(event) => handleDayKeyDown(event, date)}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const label = triggerLabel ?? formatDateRange(value, locale);
  const triggerOptions: DateRangePickerRenderTriggerOptions = {
    label,
    isOpen,
    disabled,
    popoverId,
    open,
    close: () => dismiss(),
    toggle,
  };

  const popover = isOpen ? (
    <div
      ref={popoverRef}
      id={popoverId}
      role="dialog"
      aria-label={dialogLabel}
      tabIndex={-1}
      data-months={layout.months}
      className={cx(
        "csDateRangePicker-popover",
        layout.compact && "csDateRangePicker-popoverCompact",
        popoverClassName,
      )}
    >
      <div className="csDateRangePicker-content">
        {presets.length > 0 && (
          <div className="csDateRangePicker-presets">
            {presets.map((preset) => (
              <button
                type="button"
                key={preset.value}
                className={cx(
                  "csDateRangePicker-preset",
                  activePreset === preset.value &&
                    "csDateRangePicker-presetActive",
                )}
                aria-pressed={activePreset === preset.value}
                onClick={() => handlePresetClick(preset.value)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}
        <div className="csDateRangePicker-calendars">
          {visibleMonths.map(renderMonth)}
        </div>
      </div>

      <div className="csDateRangePicker-footer">
        <div className="csDateRangePicker-rangeDisplay" aria-live="polite">
          {formatDateRange(displayRange, locale)}
        </div>
        <div className="csDateRangePicker-actions">
          <button
            type="button"
            className="csDateRangePicker-secondaryButton"
            onClick={() => dismiss(true)}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="csDateRangePicker-primaryButton"
            onClick={handleApply}
            disabled={!canApply}
          >
            {applyLabel}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className={cx("csDateRangePicker", className)} ref={containerRef}>
      {renderTrigger ? (
        renderTrigger(triggerOptions)
      ) : (
        <button
          type="button"
          className="csDateRangePicker-trigger"
          onClick={toggle}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls={isOpen ? popoverId : undefined}
        >
          <CalendarIcon />
          <span className="csDateRangePicker-triggerLabel">{label}</span>
        </button>
      )}
      {popover &&
        (portal && typeof document !== "undefined"
          ? createPortal(popover, portalContainer ?? document.body)
          : popover)}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg
      className="csDateRangePicker-triggerIcon"
      viewBox="0 0 20 20"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M6.25 2a.75.75 0 0 1 .75.75V4h6V2.75a.75.75 0 0 1 1.5 0V4h.75A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4h.75V2.75A.75.75 0 0 1 6.25 2ZM3.5 9v6.25c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25V9h-13Zm13-1.5v-.75c0-.69-.56-1.25-1.25-1.25H4.75c-.69 0-1.25.56-1.25 1.25v.75h13Z"
      />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
      style={direction === "left" ? { transform: "scaleX(-1)" } : undefined}
    >
      <path
        fill="currentColor"
        d="M7.47 4.97a.75.75 0 0 1 1.06 0l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06-1.06L11.44 10 7.47 6.03a.75.75 0 0 1 0-1.06Z"
      />
    </svg>
  );
}
