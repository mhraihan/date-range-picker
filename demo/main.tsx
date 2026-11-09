import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  DateRangePicker,
  getDefaultRange,
  getPreviousPeriod,
  formatDateRange,
  type DateRange,
} from "../src";
import "../src/styles.css";
import "./demo.css";

function Picker({ months, align }: { months: 1 | 2; align?: "start" | "end" }) {
  const [range, setRange] = useState<DateRange>(() => getDefaultRange());
  return (
    <DateRangePicker
      value={range}
      months={months}
      align={align}
      maxDate={new Date()}
      onApply={({ range }) => setRange(range)}
    />
  );
}

function App() {
  const [months, setMonths] = useState<1 | 2>(2);
  const [range, setRange] = useState<DateRange>(() => getDefaultRange());

  return (
    <div className="page">
      <header className="pageHeader">
        <h1>Analytics</h1>
        <label>
          Months{" "}
          <select
            value={months}
            onChange={(event) => setMonths(Number(event.target.value) as 1 | 2)}
          >
            <option value={2}>2</option>
            <option value={1}>1</option>
          </select>
        </label>
        <div className="spacer" />
        {/* Right-aligned trigger, like a Shopify page header action */}
        <DateRangePicker
          value={range}
          months={months}
          maxDate={new Date()}
          onApply={({ range }) => setRange(range)}
        />
      </header>
      <p className="note">
        Selected: {formatDateRange(range)} · previous period:{" "}
        {formatDateRange(getPreviousPeriod(range))}
      </p>

      <div className="grid">
        <section className="card">
          <h2>Left edge, overflow: hidden</h2>
          <Picker months={months} align="end" />
        </section>
        <section className="card">
          <h2>Middle card</h2>
          <Picker months={months} />
        </section>
        <section className="card narrow">
          <h2>Narrow</h2>
          <Picker months={months} align="start" />
        </section>
      </div>

      <div className="tall" />

      <section className="card bottom">
        <h2>Near the bottom (flips above)</h2>
        <Picker months={months} align="start" />
      </section>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
