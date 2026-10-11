"use client";
import { useEffect, useMemo, useRef, useState, CSSProperties } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  UserRound,
  Users,
  Search,
  X,
  Plus,
  CheckCircle2,
  Circle,
  Ban,
  RotateCw,
  List,
  SlidersHorizontal,
  ArrowUpRight,
} from "lucide-react";
import {
  calendarDay,
  calendarWeek,
  calendarMonth,
  shiftDay,
  dayLayout,
} from "@midad/shared";
import "./calendar.css";
type Row = Record<string, any>;
type View = "week" | "month" | "day" | "list";
type Props = {
  rows: Row[];
  groups: Row[];
  lang: "fr" | "ar";
  canEdit: boolean;
  busy: boolean;
  onCreate: (row?: Row) => void;
  onEdit: (row: Row) => void;
  onStatus: (row: Row) => void;
  onAttendance: (row: Row) => void;
  onRefresh: () => void;
  onRangeChange: (from: string, to: string) => void;
};
const palette = [
  ["#4f46e5", "#eeedff", "#38309b"],
  ["#0284c7", "#e8f5ff", "#075985"],
  ["#059669", "#e5f8ee", "#065f46"],
  ["#d97706", "#fff3df", "#92400e"],
  ["#db2777", "#fdebf4", "#9d174d"],
  ["#7c3aed", "#f1eaff", "#5b21b6"],
  ["#0891b2", "#e5f8fc", "#155e75"],
  ["#ea580c", "#fff0e7", "#9a3412"],
  ["#2563eb", "#eaf0ff", "#1e40af"],
  ["#b45309", "#faf0dd", "#78350f"],
];
const at = (day: string, minute: number) =>
  new Date(Date.parse(`${day}T00:00:00+01:00`) + minute * 60000).toISOString();
export default function PlanningCalendar({
  rows,
  groups,
  lang,
  canEdit,
  busy,
  onCreate,
  onEdit,
  onStatus,
  onAttendance,
  onRefresh,
  onRangeChange,
}: Props) {
  const t = (fr: string, ar: string) => (lang === "fr" ? fr : ar);
  const locale = lang === "fr" ? "fr-DZ" : "ar-DZ";
  const [now, setNow] = useState(new Date());
  const today = calendarDay(now);
  const [anchor, setAnchor] = useState(today);
  const [view, setView] = useState<View>("week");
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [teacher, setTeacher] = useState("");
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (window.matchMedia("(max-width: 650px)").matches) setView("day");
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const groupOptions = useMemo(() => {
    const map = new Map<string, Row>();
    for (const g of groups) map.set(g.id, g);
    for (const row of rows)
      map.set(row.group_id, { id: row.group_id, name: row.group_name });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, groups]);
  const teacherOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of groups)
      if (g.teacher_id && g.teacher_name) map.set(g.teacher_id, g.teacher_name);
    for (const row of rows)
      if (row.teacher_id && row.teacher_name)
        map.set(row.teacher_id, row.teacher_name);
    return [...map].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows, groups]);
  const colorIds = useMemo(
    () => groupOptions.map((g) => g.id).sort(),
    [groupOptions],
  );
  const color = (id: string): CSSProperties => {
    const p = palette[Math.max(0, colorIds.indexOf(id)) % palette.length];
    return {
      "--course": p[0],
      "--course-bg": p[1],
      "--course-ink": p[2],
    } as CSSProperties;
  };
  const statusLabel = (s: string) =>
    s === "completed"
      ? t("Terminée", "مكتملة")
      : s === "cancelled"
        ? t("Annulée", "ملغاة")
        : t("Prévue", "مبرمجة");
  const statusIcon = (s: string) =>
    s === "completed" ? (
      <CheckCircle2 size={13} />
    ) : s === "cancelled" ? (
      <Ban size={13} />
    ) : (
      <Circle size={12} />
    );
  const fmt = (day: string, options: Intl.DateTimeFormatOptions) =>
    new Date(`${day}T12:00:00Z`).toLocaleDateString(locale, {
      timeZone: "Africa/Algiers",
      ...options,
    });
  const time = (instant: string) =>
    new Date(instant).toLocaleTimeString(locale, {
      timeZone: "Africa/Algiers",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  const filtered = rows.filter(
    (r) =>
      (!group || r.group_id === group) &&
      (!teacher || r.teacher_id === teacher) &&
      (!status || r.status === status) &&
      `${r.group_name} ${r.subject} ${r.teacher_name || ""} ${r.room || ""} ${r.notes || ""}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase().trim()),
  );
  const days =
    view === "month"
      ? calendarMonth(anchor)
      : view === "day"
        ? [anchor]
        : calendarWeek(anchor);
  const fetchFrom = days[0];
  const fetchTo = shiftDay(days.at(-1)!, 1);
  useEffect(() => {
    onRangeChange(fetchFrom, fetchTo);
  }, [fetchFrom, fetchTo, onRangeChange]);
  const rangeStart = view === "month" ? `${anchor.slice(0, 7)}-01` : days[0];
  const rangeEnd =
    view === "month"
      ? shiftDay(
          `${anchor.slice(0, 7)}-01`,
          new Date(
            Number(anchor.slice(0, 4)),
            Number(anchor.slice(5, 7)),
            0,
          ).getDate(),
        )
      : shiftDay(days.at(-1)!, 1);
  const rangeRows = filtered.filter(
    (r) =>
      Date.parse(r.starts_at) < Date.parse(`${rangeEnd}T00:00:00+01:00`) &&
      Date.parse(r.ends_at) > Date.parse(`${rangeStart}T00:00:00+01:00`),
  );
  const scheduled = rangeRows.filter((r) => r.status === "scheduled").length;
  const hours = rangeRows
    .filter((r) => r.status !== "cancelled")
    .reduce(
      (n, r) => n + (Date.parse(r.ends_at) - Date.parse(r.starts_at)) / 3600000,
      0,
    );
  const layouts = days.map((day) =>
    dayLayout(
      filtered as (Row & { id: string; starts_at: string; ends_at: string })[],
      day,
    ),
  );
  const visibleIntervals = layouts.flat();
  const firstHour = Math.max(
    0,
    Math.min(
      8,
      Math.floor(Math.min(...visibleIntervals.map((r) => r.start)) / 60),
    ),
  );
  const lastHour = Math.min(
    24,
    Math.max(
      18,
      Math.ceil(Math.max(...visibleIntervals.map((r) => r.end)) / 60),
    ),
  );
  const hoursGrid = Array.from(
    { length: lastHour - firstHour },
    (_, i) => i + firstHour,
  );
  const height = hoursGrid.length * 88;
  const currentMinute =
    (now.getTime() - Date.parse(`${today}T00:00:00+01:00`)) / 60000;
  const selected = rows.find((r) => r.id === selectedId);
  const selectedGroup = selected
    ? (groups.find((g) => g.id === selected.group_id) ?? selected)
    : null;
  const activeFilters = !!(query || group || teacher || status);
  function move(amount: number) {
    if (view === "month") {
      const date = new Date(`${anchor.slice(0, 7)}-01T12:00:00Z`);
      date.setUTCMonth(date.getUTCMonth() + amount);
      setAnchor(date.toISOString().slice(0, 10));
    } else setAnchor(shiftDay(anchor, amount * (view === "day" ? 1 : 7)));
  }
  function create(day: string, minute = 9 * 60) {
    onCreate({
      starts_at: at(day, minute),
      ends_at: at(day, Math.min(minute + 60, 1440)),
      ...(group ? { group_id: group } : {}),
    });
  }
  const eventLabel = (r: Row) =>
    `${r.group_name}, ${fmt(calendarDay(r.starts_at), { day: "numeric", month: "long" })}, ${time(r.starts_at)} – ${time(r.ends_at)}, ${r.teacher_name || t("Sans enseignant", "بدون أستاذ")}, ${r.room || t("Sans salle", "بدون قاعة")}, ${statusLabel(r.status)}`;
  const showDay = (day: string) => {
    setAnchor(day);
    setView("day");
  };
  const title =
    view === "month"
      ? fmt(anchor, { month: "long", year: "numeric" })
      : view === "day"
        ? fmt(anchor, {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : `${fmt(days[0], { day: "numeric", month: "short" })} – ${fmt(days[6], { day: "numeric", month: "short", year: "numeric" })}`;
  return (
    <section
      className="planning-calendar"
      aria-label={t("Calendrier des séances", "تقويم الحصص")}
      aria-busy={busy}
    >
      <div className="cal-intro">
        <div className="cal-intro-title">
          <span className="cal-icon">
            <CalendarDays size={22} />
          </span>
          <div>
            <h2>{t("Votre calendrier", "تقويمك")}</h2>
            <p>
              {t(
                "Chaque cours à sa place. Toute l’équipe au même rythme.",
                "كل درس في مكانه. والفريق على نفس الإيقاع.",
              )}
            </p>
          </div>
        </div>
        <span className="cal-timezone">
          <Clock3 size={14} />
          {t("Heure d’Alger · UTC+1", "توقيت الجزائر · UTC+1")}
        </span>
      </div>
      <div className="cal-toolbar">
        <div className="cal-navigation">
          <button
            className="cal-today"
            onClick={() => {
              setAnchor(today);
              setNow(new Date());
            }}
          >
            {t("Aujourd’hui", "اليوم")}
          </button>
          <button
            className="cal-arrow"
            aria-label={t("Période précédente", "الفترة السابقة")}
            onClick={() => move(-1)}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="cal-arrow"
            aria-label={t("Période suivante", "الفترة التالية")}
            onClick={() => move(1)}
          >
            <ChevronRight size={18} />
          </button>
          <h3 aria-live="polite">{title}</h3>
          <label className="cal-date">
            <CalendarDays size={15} />
            <input
              type="date"
              aria-label={t("Aller à une date", "الانتقال إلى تاريخ")}
              value={anchor}
              onChange={(e) => e.target.value && setAnchor(e.target.value)}
            />
          </label>
        </div>
        <div
          className="cal-views"
          role="group"
          aria-label={t("Vue du calendrier", "عرض التقويم")}
        >
          {(
            [
              ["day", "Jour", "يوم"],
              ["week", "Semaine", "أسبوع"],
              ["month", "Mois", "شهر"],
              ["list", "Liste", "قائمة"],
            ] as const
          ).map(([id, fr, ar]) => (
            <button
              key={id}
              aria-pressed={view === id}
              className={view === id ? "active" : ""}
              onClick={() => setView(id)}
            >
              {id === "list" && <List size={14} />}
              {t(fr, ar)}
            </button>
          ))}
        </div>
      </div>
      <div className="cal-filters">
        <label className="cal-search">
          <Search size={17} />
          <input
            aria-label={t("Rechercher une séance", "البحث عن حصة")}
            placeholder={t("Cours, salle, professeur…", "درس، قاعة، أستاذ…")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="cal-filter">
          <span>{t("Groupe", "المجموعة")}</span>
          <select
            aria-label={t("Filtrer par groupe", "التصفية حسب المجموعة")}
            value={group}
            onChange={(e) => setGroup(e.target.value)}
          >
            <option value="">{t("Tous les groupes", "كل المجموعات")}</option>
            {groupOptions.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label className="cal-filter">
          <span>{t("Professeur", "الأستاذ")}</span>
          <select
            aria-label={t("Filtrer par professeur", "التصفية حسب الأستاذ")}
            value={teacher}
            onChange={(e) => setTeacher(e.target.value)}
          >
            <option value="">{t("Toute l’équipe", "كل الفريق")}</option>
            {teacherOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="cal-filter cal-status-filter">
          <span>{t("Statut", "الحالة")}</span>
          <select
            aria-label={t("Filtrer par statut", "التصفية حسب الحالة")}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">{t("Tous les statuts", "كل الحالات")}</option>
            {["scheduled", "completed", "cancelled"].map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <button
          className="cal-arrow"
          aria-label={t("Actualiser le calendrier", "تحديث التقويم")}
          onClick={onRefresh}
          disabled={busy}
        >
          <RotateCw size={17} />
        </button>
        {activeFilters && (
          <button
            className="cal-reset"
            onClick={() => {
              setQuery("");
              setGroup("");
              setTeacher("");
              setStatus("");
            }}
          >
            <X size={14} />
            {t("Effacer", "مسح")}
          </button>
        )}
      </div>
      <div className="cal-summary" aria-live="polite">
        <span>
          <i className="cal-dot" />
          {rangeRows.length} {t("séances", "حصص")}
        </span>
        <span>
          <Clock3 size={14} />
          {new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
            hours,
          )}{" "}
          {t("h de cours", "ساعة دروس")}
        </span>
        <span>
          {scheduled} {t("prévues", "مبرمجة")}
        </span>
        <span className="cal-summary-hint">
          {canEdit
            ? t(
                "Cliquez sur un créneau libre pour planifier",
                "اضغط على وقت فارغ لجدولة حصة",
              )
            : t(
                "Cliquez sur un cours pour voir les détails",
                "اضغط على درس لعرض التفاصيل",
              )}
        </span>
      </div>
      {!rangeRows.length && !busy && (
        <div className="cal-empty" role="status">
          <SlidersHorizontal size={18} />
          {activeFilters
            ? t(
                "Aucune séance ne correspond à ces filtres sur cette période.",
                "لا توجد حصص بهذه التصفية في هذه الفترة.",
              )
            : t(
                "Aucune séance sur cette période. Parcourez les dates ou planifiez un cours.",
                "لا توجد حصص في هذه الفترة. اختر تاريخًا أو أضف درسًا.",
              )}
        </div>
      )}
      {(view === "week" || view === "day") && (
        <div className="cal-grid-scroll">
          <div
            className={`cal-time-grid ${view === "day" ? "single-day" : ""}`}
            style={{ "--days": days.length } as CSSProperties}
          >
            <div className="cal-time-heading">
              <span>UTC+1</span>
            </div>
            {days.map((day) => (
              <button
                key={day}
                className={`cal-day-heading ${day === today ? "today" : ""}`}
                onClick={() => showDay(day)}
                aria-label={fmt(day, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              >
                <span>{fmt(day, { weekday: "short" })}</span>
                <strong>{fmt(day, { day: "numeric" })}</strong>
                <small>
                  {dayLayout(filtered as any, day).length} {t("cours", "دروس")}
                </small>
              </button>
            ))}
            <div className="cal-time-axis" style={{ height }}>
              {hoursGrid.map((h) => (
                <span key={h} style={{ top: (h - firstHour) * 88 }}>
                  {String(h).padStart(2, "0")}:00
                </span>
              ))}
            </div>
            {days.map((day, i) => (
              <div
                key={day}
                className={`cal-day-column ${day === today ? "today" : ""}`}
                style={{ height }}
              >
                {hoursGrid.flatMap((h) =>
                  [0, 30].map((m) =>
                    canEdit ? (
                      <button
                        key={`${h}-${m}`}
                        className={`cal-slot ${m === 30 ? "half" : ""}`}
                        style={{ top: (h - firstHour) * 88 + (m / 60) * 88 }}
                        aria-label={`${t("Planifier le", "جدولة يوم")} ${fmt(day, { weekday: "long", day: "numeric", month: "long" })} ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`}
                        onClick={() => create(day, h * 60 + m)}
                      >
                        <Plus size={13} />
                      </button>
                    ) : (
                      <div
                        key={`${h}-${m}`}
                        className={`cal-slot ${m === 30 ? "half" : ""}`}
                        style={{ top: (h - firstHour) * 88 + (m / 60) * 88 }}
                      />
                    ),
                  ),
                )}
                {layouts[i].map(({ row: r, start, end, lane, lanes }) => (
                  <button
                    key={r.id}
                    className={`cal-event ${r.status} ${end - start < 45 ? "compact" : ""}`}
                    style={{
                      ...color(r.group_id),
                      top: ((start - firstHour * 60) / 60) * 88 + 2,
                      height: Math.max(20, ((end - start) / 60) * 88 - 4),
                      insetInlineStart: `calc(${(lane / lanes) * 100}% + 4px)`,
                      width: `calc(${100 / lanes}% - 8px)`,
                    }}
                    title={eventLabel(r)}
                    aria-label={eventLabel(r)}
                    onClick={() => setSelectedId(r.id)}
                  >
                    <span className="cal-event-time" dir="ltr">
                      {time(r.starts_at)}–{time(r.ends_at)}
                      {statusIcon(r.status)}
                    </span>
                    <strong>{r.group_name}</strong>
                    <span className="cal-event-room">
                      <MapPin size={11} />
                      {r.room || t("Salle à définir", "القاعة غير محددة")}
                    </span>
                    <span className="cal-event-teacher">
                      {r.teacher_name ||
                        t("Professeur à définir", "الأستاذ غير محدد")}
                    </span>
                  </button>
                ))}
                {day === today &&
                  currentMinute >= firstHour * 60 &&
                  currentMinute < lastHour * 60 && (
                    <div
                      className="cal-now"
                      style={{
                        top: ((currentMinute - firstHour * 60) / 60) * 88,
                      }}
                    >
                      <span />
                      <small>{time(now.toISOString())}</small>
                    </div>
                  )}
              </div>
            ))}
          </div>
        </div>
      )}
      {view === "month" && (
        <div className="cal-month-scroll">
          <div className="cal-month-grid">
            {calendarWeek(anchor).map((day) => (
              <div key={day} className="cal-month-weekday">
                {fmt(day, { weekday: "short" })}
              </div>
            ))}
            {days.map((day, i) => (
              <div
                key={day}
                className={`cal-month-day ${day.slice(0, 7) !== anchor.slice(0, 7) ? "outside" : ""} ${day === today ? "today" : ""}`}
              >
                <div className="cal-month-date">
                  <button
                    onClick={() => showDay(day)}
                    aria-label={`${t("Voir le", "عرض يوم")} ${fmt(day, { day: "numeric", month: "long" })}`}
                  >
                    {fmt(day, { day: "numeric" })}
                  </button>
                  {canEdit && (
                    <button
                      className="cal-month-add"
                      aria-label={`${t("Planifier le", "جدولة يوم")} ${day}`}
                      onClick={() => create(day)}
                    >
                      <Plus size={13} />
                    </button>
                  )}
                </div>
                {layouts[i].slice(0, 3).map(({ row: r }) => (
                  <button
                    key={r.id}
                    className={`cal-month-event ${r.status}`}
                    style={color(r.group_id)}
                    title={eventLabel(r)}
                    aria-label={eventLabel(r)}
                    onClick={() => setSelectedId(r.id)}
                  >
                    <i />
                    <span>
                      <b>{time(r.starts_at)}</b> {r.group_name}
                    </span>
                  </button>
                ))}
                {layouts[i].length > 3 && (
                  <button className="cal-more" onClick={() => showDay(day)}>
                    +{layouts[i].length - 3} {t("autres", "أخرى")}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {view === "list" && (
        <div className="cal-agenda">
          {days.map(
            (day, i) =>
              layouts[i].length > 0 && (
                <section key={day}>
                  <div
                    className={`cal-agenda-date ${day === today ? "today" : ""}`}
                  >
                    <b>{fmt(day, { day: "numeric" })}</b>
                    <div>
                      <strong>{fmt(day, { weekday: "long" })}</strong>
                      <small>{fmt(day, { month: "long" })}</small>
                    </div>
                  </div>
                  <div>
                    {layouts[i].map(({ row: r }) => (
                      <button
                        key={r.id}
                        className={`cal-agenda-event ${r.status}`}
                        style={color(r.group_id)}
                        onClick={() => setSelectedId(r.id)}
                        aria-label={eventLabel(r)}
                      >
                        <span className="cal-agenda-time">
                          {time(r.starts_at)}
                          <small>{time(r.ends_at)}</small>
                        </span>
                        <span className="cal-agenda-course">
                          <strong>{r.group_name}</strong>
                          <small>
                            <UserRound size={13} />
                            {r.teacher_name || "—"}
                            <MapPin size={13} />
                            {r.room || "—"}
                          </small>
                        </span>
                        <span className={`cal-session-status ${r.status}`}>
                          {statusIcon(r.status)}
                          {statusLabel(r.status)}
                        </span>
                        <ArrowUpRight size={16} />
                      </button>
                    ))}
                  </div>
                </section>
              ),
          )}
        </div>
      )}
      <div className="cal-legend">
        <span>{t("Couleurs des groupes", "ألوان المجموعات")}</span>
        <div>
          {groupOptions.map((g) => (
            <button
              key={g.id}
              style={color(g.id)}
              aria-pressed={group === g.id}
              className={group === g.id ? "active" : ""}
              onClick={() => setGroup(group === g.id ? "" : g.id)}
            >
              <i />
              {g.name}
            </button>
          ))}
        </div>
        <small>
          <CheckCircle2 size={12} />
          {t("Terminée", "مكتملة")}
          <Ban size={12} />
          {t("Annulée : barrée", "الملغاة: مشطوبة")}
        </small>
      </div>
      {selected && (
        <SessionDialog
          row={selected}
          lang={lang}
          color={color(selected.group_id)}
          close={() => setSelectedId(null)}
        >
          <span className={`cal-session-status ${selected.status}`}>
            {statusIcon(selected.status)}
            {statusLabel(selected.status)}
          </span>
          <div className="cal-detail-metadata">
            <div>
              <CalendarDays size={19} />
              <span>
                <small>{t("Date", "التاريخ")}</small>
                <strong>
                  {fmt(calendarDay(selected.starts_at), {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </strong>
              </span>
            </div>
            <div>
              <Clock3 size={19} />
              <span>
                <small>
                  {t("Horaire · heure d’Alger", "الوقت · توقيت الجزائر")}
                </small>
                <strong dir="ltr">
                  {time(selected.starts_at)} – {time(selected.ends_at)}
                  {calendarDay(selected.ends_at) !==
                    calendarDay(selected.starts_at) &&
                    ` · ${fmt(calendarDay(selected.ends_at), { day: "numeric", month: "short" })}`}
                </strong>
                <small>
                  {Math.round(
                    (Date.parse(selected.ends_at) -
                      Date.parse(selected.starts_at)) /
                      60000,
                  )}{" "}
                  {t("min", "دقيقة")}
                </small>
              </span>
            </div>
            <div>
              <UserRound size={19} />
              <span>
                <small>{t("Professeur", "الأستاذ")}</small>
                <strong>
                  {selected.teacher_name || t("À affecter", "غير محدد")}
                </strong>
              </span>
            </div>
            <div>
              <MapPin size={19} />
              <span>
                <small>{t("Salle", "القاعة")}</small>
                <strong>{selected.room || t("À définir", "غير محددة")}</strong>
              </span>
            </div>
            {!!(selected.subject || selectedGroup?.level) && (
              <div>
                <Users size={19} />
                <span>
                  <small>{t("Matière / niveau", "المادة / المستوى")}</small>
                  <strong>
                    {[selected.subject, selectedGroup?.level]
                      .filter(Boolean)
                      .join(" · ")}
                  </strong>
                  {selectedGroup && (
                    <small>
                      {selectedGroup.student_count} / {selectedGroup.capacity}{" "}
                      {t("élèves inscrits", "تلاميذ مسجلون")}
                    </small>
                  )}
                </span>
              </div>
            )}
          </div>
          {selected.notes && (
            <div className="cal-detail-notes">
              <h3>{t("Notes de la séance", "ملاحظات الحصة")}</h3>
              <p>{selected.notes}</p>
            </div>
          )}
          <div className="cal-detail-actions">
            <button
              className="button"
              onClick={() => {
                setSelectedId(null);
                onAttendance(selected);
              }}
            >
              {t("Ouvrir les présences", "فتح الحضور")}
              <ArrowUpRight size={16} />
            </button>
            {canEdit && (
              <>
                <button
                  className="button secondary"
                  disabled={busy || selected.status === "completed"}
                  onClick={() => {
                    setSelectedId(null);
                    onEdit(selected);
                  }}
                >
                  {t("Reprogrammer", "إعادة الجدولة")}
                </button>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => {
                    setSelectedId(null);
                    onStatus(selected);
                  }}
                >
                  {t("Changer le statut", "تغيير الحالة")}
                </button>
              </>
            )}
          </div>
          {selected.status === "completed" && canEdit && (
            <p className="cal-detail-help">
              {t(
                "Une séance terminée conserve son horaire pour l’historique et la paie.",
                "تحتفظ الحصة المكتملة بوقتها للسجل والأجور.",
              )}
            </p>
          )}
        </SessionDialog>
      )}
    </section>
  );
}
function SessionDialog({
  row,
  lang,
  color,
  close,
  children,
}: {
  row: Row;
  lang: "fr" | "ar";
  color: CSSProperties;
  close: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog cal-detail"
      aria-labelledby="calendar-session-title"
      dir={lang === "ar" ? "rtl" : "ltr"}
      onCancel={close}
    >
      <div className="cal-detail-header" style={color}>
        <div>
          <span>{lang === "fr" ? "DÉTAIL DE LA SÉANCE" : "تفاصيل الحصة"}</span>
          <h2 id="calendar-session-title">{row.group_name}</h2>
        </div>
        <button
          className="cal-arrow"
          aria-label={lang === "fr" ? "Fermer la séance" : "إغلاق الحصة"}
          onClick={close}
        >
          <X size={19} />
        </button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
