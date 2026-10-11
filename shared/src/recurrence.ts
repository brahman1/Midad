import { z } from "zod";
import { calendarDay, calendarWeek, shiftDay } from "./calendar";

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      Number.isFinite(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Date invalide",
  );
export const exclusionPeriod = z
  .object({
    label: z.string().trim().min(2).max(120),
    from: date,
    to: date,
  })
  .refine((v) => v.to >= v.from, "La fin doit suivre le début");
export const recurrenceInput = z
  .object({
    group_id: z.uuid(),
    from: date,
    to: date,
    weekdays: z
      .array(z.number().int().min(0).max(6))
      .min(1)
      .max(7)
      .transform((v) => [...new Set(v)].sort()),
    start_time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    duration_minutes: z.number().int().min(5).max(720),
    interval_weeks: z.number().int().min(1).max(4).default(1),
    room: z.string().trim().max(100).default(""),
    notes: z.string().max(2000).default(""),
    excluded_months: z
      .array(z.number().int().min(1).max(12))
      .max(12)
      .default([]),
    excluded_dates: z.array(date).max(100).default([]),
    excluded_periods: z.array(exclusionPeriod).max(24).default([]),
    skip_conflicts: z.boolean().default(false),
  })
  .refine(
    (v) =>
      v.to >= v.from && Date.parse(v.to) - Date.parse(v.from) <= 365 * 86400000,
    "La période doit durer au maximum un an",
  );
export type RecurrenceRule = z.infer<typeof recurrenceInput>;
export type ClosurePeriod = z.infer<typeof exclusionPeriod>;
export type Occurrence = { date: string; starts_at: string; ends_at: string };
export function overlappingClosure(
  start: string,
  end: string,
  periods: ClosurePeriod[],
) {
  return periods.find(
    (p) =>
      Date.parse(start) < Date.parse(`${shiftDay(p.to, 1)}T00:00:00+01:00`) &&
      Date.parse(end) > Date.parse(`${p.from}T00:00:00+01:00`),
  );
}
export function generateRecurrence(
  rule: RecurrenceRule,
  closures: ClosurePeriod[] = [],
  now = Date.now(),
) {
  const occurrences: Occurrence[] = [],
    excluded: (Occurrence & { reason: string; label: string })[] = [];
  const anchor = calendarWeek(rule.from)[0];
  for (let date = rule.from; date <= rule.to; date = shiftDay(date, 1)) {
    const week = Math.floor(
      (Date.parse(date) - Date.parse(anchor)) / 604800000,
    );
    if (
      !rule.weekdays.includes(new Date(`${date}T12:00:00Z`).getUTCDay()) ||
      week % rule.interval_weeks
    )
      continue;
    const start = Date.parse(`${date}T${rule.start_time}:00+01:00`);
    const occurrence = {
      date,
      starts_at: new Date(start).toISOString(),
      ends_at: new Date(start + rule.duration_minutes * 60000).toISOString(),
    };
    const lastDay = calendarDay(new Date(Date.parse(occurrence.ends_at) - 1));
    const coveredDays = date === lastDay ? [date] : [date, lastDay];
    const closure = overlappingClosure(
      occurrence.starts_at,
      occurrence.ends_at,
      closures,
    );
    const exception = overlappingClosure(
      occurrence.starts_at,
      occurrence.ends_at,
      rule.excluded_periods,
    );
    const reason =
      start < now
        ? "past"
        : coveredDays.some((d) =>
              rule.excluded_months.includes(Number(d.slice(5, 7))),
            )
          ? "month"
          : coveredDays.some((d) => rule.excluded_dates.includes(d))
            ? "date"
            : closure
              ? "closure"
              : exception
                ? "period"
                : "";
    if (reason)
      excluded.push({
        ...occurrence,
        reason,
        label: closure?.label ?? exception?.label ?? "",
      });
    else occurrences.push(occurrence);
  }
  return { occurrences, excluded };
}
