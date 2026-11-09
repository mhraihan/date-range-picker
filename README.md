# @raihan004/date-range-picker

Reusable React date range picker and date filtering helpers for Shopify apps.

The package is framework-agnostic React. It does not depend on Remix, React Router, Shopify App Bridge, or Polaris. Shopify apps can still render Polaris web component triggers through `renderTrigger`.

## Install

```bash
npm install @raihan004/date-range-picker
```

Import the package styles once in your app route or root:

```tsx
import "@raihan004/date-range-picker/styles.css";
```

For Vite or React Router route links, you can also import the CSS URL:

```tsx
import dateRangePickerStylesUrl from "@raihan004/date-range-picker/styles.css?url";
```

## Basic Usage

```tsx
import {
  DateRangePicker,
  getDefaultRange,
  serializeDateRange,
  type DateRange,
} from "@raihan004/date-range-picker";
import { useState } from "react";

export function ReportDateFilter() {
  const [range, setRange] = useState<DateRange>(() => getDefaultRange());

  return (
    <DateRangePicker
      value={range}
      onApply={({ range }) => {
        setRange(range);
        console.log(serializeDateRange(range));
      }}
    />
  );
}
```

## Layout and overflow

The popover is rendered into `document.body` with `position: fixed`, so cards
with `overflow: hidden` cannot clip it and it never makes the page scroll
sideways. It is placed against the viewport:

- it lines up with the trigger's `align` edge (`"end"` by default) and is pushed
  back inside the viewport when it would spill over an edge;
- it opens above the trigger when there is more room there;
- with `months={2}` it falls back to one month, then to a stacked layout
  (presets as chips above the calendar) when the viewport is too narrow.

```tsx
<DateRangePicker
  value={range}
  months={2}            // 1 | 2
  align="start"         // "start" | "end"
  weekStartsOn={1}      // Monday
  maxDate={new Date()}  // no future dates
  onApply={({ range }) => setRange(range)}
/>
```

Pass `portal={false}` to render the popover in place, or `portalContainer` to
render it somewhere other than `document.body`.

## Theming

Colours, radius and cell size are CSS custom properties. Because the popover is
portalled to `<body>`, set them on `:root` (or through `popoverClassName`):

```css
:root {
  --csdrp-accent: #303030;
  --csdrp-accent-hover: #1a1a1a;
  --csdrp-range: #ebebeb;
  --csdrp-cell-size: 32px;
  --csdrp-z-index: 520;
}
```

See the top of `styles.css` for the full list.

## Keyboard

Arrow keys move between days, Home/End go to the start/end of the week,
PageUp/PageDown change the month (with Shift: the year), Enter selects, and
Escape closes without applying.

## Shopify Polaris Trigger

```tsx
<DateRangePicker
  value={range}
  onChange={setRange}
  renderTrigger={({ label, toggle, isOpen, popoverId }) => (
    <s-button
      variant="secondary"
      icon="calendar"
      onClick={toggle}
      accessibilityLabel={
        isOpen ? "Close date range picker" : "Open date range picker"
      }
    >
      {label}
    </s-button>
  )}
/>
```

## Server or URL Filtering

```ts
import {
  deserializeDateRange,
  serializeDateRange,
} from "@raihan004/date-range-picker";

const range = deserializeDateRange(
  url.searchParams.get("startDate"),
  url.searchParams.get("endDate"),
);

const params = serializeDateRange(range);
```

## Client-Side Filtering

```ts
import { filterByDateRange } from "@raihan004/date-range-picker";

const rowsInRange = filterByDateRange(rows, {
  range,
  getDate: (row) => row.createdAt,
});
```

## API

### `DateRangePicker` props

| Prop | Type | Default |
| --- | --- | --- |
| `value` | `DateRange` | required |
| `months` | `1 \| 2` | `2` |
| `presets` | `DateRangePresetOption[]` | `DEFAULT_PRESETS` |
| `locale` | `string` | `"en-US"` |
| `weekStartsOn` | `0`–`6` | `0` (Sunday) |
| `minDate` / `maxDate` | `Date` | none |
| `align` | `"start" \| "end"` | `"end"` |
| `portal` | `boolean` | `true` |
| `portalContainer` | `HTMLElement` | `document.body` |
| `disabled` | `boolean` | `false` |
| `className` / `popoverClassName` | `string` | none |
| `triggerLabel`, `dialogLabel`, `applyLabel`, `cancelLabel`, `previousMonthLabel`, `nextMonthLabel` | `string` | English |
| `onChange(range)` | | called on Apply |
| `onApply({ range, preset })` | | called on Apply |
| `onCancel()` | | Cancel, Escape or click outside |
| `onDraftChange(range)`, `onOpenChange(open)`, `onPresetSelect({ preset, range })` | | |
| `renderTrigger(options)` | | custom trigger |

### Helpers

- `DateRangePicker`
- `getDefaultRange`
- `getPresetRange`
- `detectPreset`
- `serializeDateRange`
- `deserializeDateRange`
- `formatDateRange`
- `formatIsoDate`
- `parseIsoDate`
- `filterByDateRange`
- `getPreviousPeriod`
- `normalizeRange`, `clampDate`, `differenceInCalendarDays`, `getWeekdayLabels`, `toDate`

## Development

```bash
npm run dev        # playground with dashboard-like layouts (demo/)
npm test           # unit tests
npm run typecheck
npm run build
```

## Publish

```bash
npm run build
npm pack --dry-run
npm publish --access public
```
