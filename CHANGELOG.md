# Changelog

## 0.2.0

### Fixed

- The popover no longer overflows dashboards or gets clipped by cards with
  `overflow: hidden`. It is portalled to `document.body`, positioned against
  the viewport, flips above the trigger when needed, and falls back from two
  months to one month to a stacked layout when space is tight.
- `getPresetRange("lastMonth")` returned the current month on the 31st (and on
  the 29th/30th after February) because `addMonths` overflowed.
- `getPreviousPeriod` returned a period one day longer than the input.
- `parseIsoDate` accepted impossible dates such as `2024-02-31`.
- `filterByDateRange` read `YYYY-MM-DD` strings as UTC, shifting them to the
  previous day in negative-offset time zones.
- The draft selection was reset whenever the parent re-rendered with a new
  `value` object while the picker was open.
- Clicking "Custom" highlighted "Today"; single-day custom ranges could not be
  applied; `onDraftChange` could fire twice under React StrictMode.

### Added

- `minDate`, `maxDate`, `weekStartsOn`, `align`, `disabled`, `portal`,
  `portalContainer`, `popoverClassName`, `dialogLabel` props.
- Keyboard navigation (arrows, Home/End, PageUp/PageDown, Escape) and ARIA
  grid/dialog roles.
- Theming through `--csdrp-*` CSS custom properties.
- Localised weekday names, a today marker, continuous range highlight.
- `popoverId` and `disabled` in `renderTrigger` options.
- Helpers: `normalizeRange`, `clampDate`, `differenceInCalendarDays`,
  `differenceInCalendarMonths`, `endOfMonth`, `getWeekdayLabels`, `toDate`.

### Changed

- `onCancel` is also called when the picker is dismissed with Escape or a
  click outside, not only with the Cancel button.
- With two months, the end month of the range is shown on the right (e.g.
  "Today" shows the previous and current month instead of current and next).
- The footer shows the range in the picker's `locale` instead of `MM/DD/YYYY`.
- Theme variables must be set on `:root` (or via `popoverClassName`) because
  the popover is portalled; pass `portal={false}` to render it in place.
