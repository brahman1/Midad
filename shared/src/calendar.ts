/** Calendar days are civil dates in Algiers, independent of the browser timezone. */
export function calendarDay(instant: string | Date): string {
  return new Date(instant).toLocaleDateString("en-CA", {
    timeZone: "Africa/Algiers",
  });
}
export function shiftDay(day: string, amount: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
export function calendarWeek(day: string): string[] {
  const start = shiftDay(day, -new Date(`${day}T12:00:00Z`).getUTCDay());
  return Array.from({ length: 7 }, (_, i) => shiftDay(start, i));
}
export function calendarMonth(day: string): string[] {
  const first = `${day.slice(0, 7)}-01`;
  const start = calendarWeek(first)[0];
  const date = new Date(`${first}T12:00:00Z`);
  const count = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const length = Math.ceil((date.getUTCDay() + count) / 7) * 7;
  return Array.from({ length }, (_, i) => shiftDay(start, i));
}
export type CalendarSession = {
  id: string;
  starts_at: string;
  ends_at: string;
};
export type PositionedSession<T> = {
  row: T;
  start: number;
  end: number;
  lane: number;
  lanes: number;
};
export function dayLayout<T extends CalendarSession>(
  rows: T[],
  day: string,
): PositionedSession<T>[] {
  const midnight = Date.parse(`${day}T00:00:00+01:00`);
  const entries = rows
    .map((row) => ({
      row,
      start: Math.max(0, (Date.parse(row.starts_at) - midnight) / 60000),
      end: Math.min(1440, (Date.parse(row.ends_at) - midnight) / 60000),
      lane: 0,
      lanes: 1,
    }))
    .filter(
      (e) =>
        e.start < e.end && Number.isFinite(e.start) && Number.isFinite(e.end),
    )
    .sort(
      (a, b) =>
        a.start - b.start || b.end - a.end || a.row.id.localeCompare(b.row.id),
    );
  let cluster: PositionedSession<T>[] = [];
  let ends: number[] = [];
  let clusterEnd = -1;
  function finish() {
    for (const item of cluster) item.lanes = ends.length;
    cluster = [];
    ends = [];
  }
  for (const item of entries) {
    if (item.start >= clusterEnd) finish();
    const available = ends.findIndex((end) => end <= item.start);
    item.lane = available === -1 ? ends.length : available;
    ends[item.lane] = item.end;
    cluster.push(item);
    clusterEnd = Math.max(cluster.length === 1 ? -1 : clusterEnd, item.end);
  }
  finish();
  return entries;
}
