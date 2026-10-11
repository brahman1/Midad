import { test } from "node:test";
import assert from "node:assert/strict";
import { recurrenceInput, generateRecurrence } from "../shared/dist/index.js";
const base = {
  group_id: "a1234567-1234-4123-a123-123456789abc",
  from: "2030-01-01",
  to: "2030-03-31",
  weekdays: [0],
  start_time: "09:00",
  duration_minutes: 60,
};
const now = Date.parse("2029-01-01T00:00:00Z");
test("Chaque dimanche à Alger, avec mois, dates, pauses et fermetures exclus", () => {
  const rule = recurrenceInput.parse({
    ...base,
    excluded_months: [2],
    excluded_dates: ["2030-01-20"],
    excluded_periods: [
      { label: "Pause", from: "2030-03-10", to: "2030-03-16" },
    ],
  });
  const result = generateRecurrence(
    rule,
    [{ label: "Vacances", from: "2030-01-13", to: "2030-01-19" }],
    now,
  );
  assert.deepEqual(
    result.occurrences.map((o) => o.date),
    [
      "2030-01-06",
      "2030-01-27",
      "2030-03-03",
      "2030-03-17",
      "2030-03-24",
      "2030-03-31",
    ],
  );
  assert.equal(result.occurrences[0].starts_at, "2030-01-06T08:00:00.000Z");
  assert.equal(result.occurrences[0].ends_at, "2030-01-06T09:00:00.000Z");
  assert.equal(result.excluded.filter((o) => o.reason === "month").length, 4);
  assert.deepEqual(
    new Set(result.excluded.map((o) => o.reason)),
    new Set(["month", "date", "closure", "period"]),
  );
});
test("Semaines alternées ancrées au dimanche, sans décaler le rythme après une pause", () => {
  const rule = recurrenceInput.parse({
    ...base,
    from: "2030-01-02",
    to: "2030-02-01",
    weekdays: [0, 0, 3],
    interval_weeks: 2,
    excluded_dates: ["2030-01-13"],
  });
  const result = generateRecurrence(rule, [], now);
  assert.deepEqual(
    result.occurrences.map((o) => o.date),
    ["2030-01-02", "2030-01-16", "2030-01-27", "2030-01-30"],
  );
});
test("Un cours de nuit respecte la fermeture du lendemain ; minuit exact ne déborde pas", () => {
  const closures = [
    { label: "Fermeture", from: "2030-01-07", to: "2030-01-07" },
  ];
  const rule = recurrenceInput.parse({
    ...base,
    to: "2030-01-06",
    start_time: "23:30",
  });
  assert.equal(
    generateRecurrence(rule, closures, now).excluded[0].reason,
    "closure",
  );
  assert.equal(
    generateRecurrence({ ...rule, start_time: "23:00" }, closures, now)
      .occurrences.length,
    1,
  );
});
test("Année bissextile, limite de période et paramètres invalides", () => {
  const rule = recurrenceInput.parse({
    ...base,
    from: "2032-02-29",
    to: "2032-02-29",
    weekdays: [0, 1, 2, 3, 4, 5, 6],
  });
  assert.equal(
    generateRecurrence(rule, [], now).occurrences[0].date,
    "2032-02-29",
  );
  for (const changes of [
    { from: "2030-02-30" },
    { to: "2029-01-01" },
    { to: "2032-01-01" },
    { weekdays: [] },
    { duration_minutes: 0 },
    { start_time: "24:00" },
    {
      excluded_periods: [
        { label: "Vacances", from: "2030-01-20", to: "2030-01-19" },
      ],
    },
  ])
    assert.equal(
      recurrenceInput.safeParse({ ...base, ...changes }).success,
      false,
    );
});
test("Les occurrences déjà commencées sont exclues, sans créer de séances rétroactives", () => {
  const result = generateRecurrence(
    recurrenceInput.parse({ ...base, to: "2030-01-13" }),
    [],
    Date.parse("2030-01-06T08:01:00Z"),
  );
  assert.deepEqual(
    result.occurrences.map((o) => o.date),
    ["2030-01-13"],
  );
  assert.equal(result.excluded[0].reason, "past");
});
