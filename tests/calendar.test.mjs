import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calendarDay,
  calendarWeek,
  calendarMonth,
  shiftDay,
  dayLayout,
} from "../shared/dist/calendar.js";
test("Le calendrier utilise la date d’Alger, même autour de minuit UTC", () => {
  assert.equal(calendarDay("2026-10-11T23:30:00Z"), "2026-10-12");
  assert.equal(calendarDay("2026-10-11T22:30:00Z"), "2026-10-11");
  assert.equal(shiftDay("2026-12-31", 1), "2027-01-01");
  assert.equal(shiftDay("2024-03-01", -1), "2024-02-29");
});
test("Semaines dimanche-samedi et mois complets aux frontières des années", () => {
  assert.deepEqual(calendarWeek("2026-10-14"), [
    "2026-10-11",
    "2026-10-12",
    "2026-10-13",
    "2026-10-14",
    "2026-10-15",
    "2026-10-16",
    "2026-10-17",
  ]);
  const month = calendarMonth("2026-08-15");
  assert.equal(month.length, 42);
  assert.equal(month[0], "2026-07-26");
  assert.equal(month.at(-1), "2026-09-05");
  assert.equal(calendarMonth("2026-01-20")[0], "2025-12-28");
});
const session = (id, start, end) => ({
  id,
  starts_at: `2026-10-11T${start}:00+01:00`,
  ends_at: `2026-10-11T${end}:00+01:00`,
});
test("Les cours simultanés restent accessibles, les cours adjacents utilisent toute la largeur", () => {
  const rows = [
    session("a", "09:00", "11:00"),
    session("b", "09:00", "10:00"),
    session("c", "10:00", "11:30"),
    session("d", "11:30", "12:00"),
  ];
  const layout = dayLayout(rows, "2026-10-11");
  assert.equal(layout.find((e) => e.row.id === "a").lanes, 2);
  assert.equal(
    layout.find((e) => e.row.id === "b").lane,
    layout.find((e) => e.row.id === "c").lane,
  );
  assert.equal(layout.find((e) => e.row.id === "d").lanes, 1);
  for (let i = 0; i < layout.length; i++)
    for (let j = i + 1; j < layout.length; j++) {
      const a = layout[i],
        b = layout[j];
      if (a.start < b.end && b.start < a.end) assert.notEqual(a.lane, b.lane);
    }
});
test("Une séance traversant minuit est visible et découpée sur les deux jours", () => {
  const rows = [
    {
      id: "nuit",
      starts_at: "2026-10-11T23:30:00+01:00",
      ends_at: "2026-10-12T01:00:00+01:00",
    },
  ];
  assert.deepEqual(
    dayLayout(rows, "2026-10-11").map(({ start, end }) => [start, end]),
    [[1410, 1440]],
  );
  assert.deepEqual(
    dayLayout(rows, "2026-10-12").map(({ start, end }) => [start, end]),
    [[0, 60]],
  );
  assert.equal(dayLayout(rows, "2026-10-13").length, 0);
});
