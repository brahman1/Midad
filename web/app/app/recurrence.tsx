"use client";
import { useEffect, useRef, useState } from "react";
import {
  Repeat2,
  CalendarOff,
  X,
  Plus,
  Check,
  AlertTriangle,
  Trash2,
  CalendarDays,
} from "lucide-react";
import {
  calendarDay,
  shiftDay,
  recurrenceInput,
  RecurrenceRule,
  ClosurePeriod,
} from "@midad/shared";
import { api, localDate } from "../../lib/api";
import "./recurrence.css";
type Row = Record<string, any>;
type Preview = {
  accepted: Row[];
  excluded: Row[];
  conflicts: Row[];
  room: string;
  group_name: string;
};
export default function RecurringPlanning({
  groups,
  closures,
  admin,
  lang,
  onChanged,
}: {
  groups: Row[];
  closures: Row[];
  admin: boolean;
  lang: "fr" | "ar";
  onChanged: () => void;
}) {
  const t = (fr: string, ar: string) => (lang === "fr" ? fr : ar);
  const [open, setOpen] = useState(false),
    [tab, setTab] = useState("repeat"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [preview, setPreview] = useState<Preview | null>(null),
    [series, setSeries] = useState<Row[]>([]),
    [confirm, setConfirm] = useState<{ kind: string; row: Row } | null>(null);
  const [draft, setDraft] = useState<RecurrenceRule>({
    group_id: groups[0]?.id ?? "",
    from: calendarDay(new Date()),
    to: shiftDay(calendarDay(new Date()), 90),
    weekdays: [0],
    start_time: "09:00",
    duration_minutes: 60,
    interval_weeks: 1,
    room: "",
    notes: "",
    excluded_months: [],
    excluded_dates: [],
    excluded_periods: [],
    skip_conflicts: false,
  });
  const [dateText, setDateText] = useState("");
  const [closure, setClosure] = useState<ClosurePeriod>({
      label: "",
      from: calendarDay(new Date()),
      to: calendarDay(new Date()),
    }),
    [closurePreview, setClosurePreview] = useState<Row[] | null>(null),
    [cancelLessons, setCancelLessons] = useState(false);
  const [localClosures, setLocalClosures] = useState(closures);
  const dialog = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    requestId = useRef("");
  useEffect(() => setLocalClosures(closures), [closures]);
  useEffect(() => {
    if (!open) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) setOpen(false);
      if (e.key !== "Tab") return;
      const elements = Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        ) ?? [],
      );
      if (!elements.length) return;
      const first = elements[0],
        last = elements.at(-1)!;
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialog.current)
      ) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keys);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", keys);
      trigger.current?.focus();
    };
  }, [open, busy]);
  async function refresh() {
    const [s, c] = await Promise.all([
      api("planning/series"),
      api("planning/closures"),
    ]);
    setSeries(s);
    setLocalClosures(c);
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function update(change: Partial<RecurrenceRule>) {
    setDraft((v) => ({ ...v, ...change }));
    setPreview(null);
    requestId.current = "";
    setNotice("");
  }
  function updateClosure(change: Partial<ClosurePeriod>) {
    setClosure((v) => ({ ...v, ...change }));
    setClosurePreview(null);
    setCancelLessons(false);
  }
  function payload() {
    return recurrenceInput.parse({
      ...draft,
      excluded_dates: dateText.split(/[\s,;]+/).filter(Boolean),
    });
  }
  function show(mode: string) {
    setTab(mode);
    setOpen(true);
    setError("");
    setNotice("");
    setConfirm(null);
    setDraft((v) => ({
      ...v,
      group_id: groups.some((g) => g.id === v.group_id)
        ? v.group_id
        : (groups[0]?.id ?? ""),
    }));
    void run(refresh);
  }
  const weekdays = [
    t("Dim", "الأحد"),
    t("Lun", "الإثنين"),
    t("Mar", "الثلاثاء"),
    t("Mer", "الأربعاء"),
    t("Jeu", "الخميس"),
    t("Ven", "الجمعة"),
    t("Sam", "السبت"),
  ];
  const reason = (r: Row) =>
    r.reason === "past"
      ? t("Déjà passée", "حصة مضت")
      : r.reason === "month"
        ? t("Mois exclu", "شهر مستثنى")
        : r.reason === "date"
          ? t("Date exclue", "تاريخ مستثنى")
          : r.label || t("Période exclue", "فترة مستثناة");
  const displayDate = (d: string) =>
    new Date(d + "T12:00:00Z").toLocaleDateString(
      lang === "fr" ? "fr-DZ" : "ar-DZ",
      { weekday: "short", day: "numeric", month: "short", year: "numeric" },
    );
  return (
    <>
      <div className="rp-toolbar">
        <div>
          <Repeat2 size={20} />
          <span>
            <strong>{t("Le rythme de votre école", "وتيرة مدرستك")}</strong>
            <small>
              {t(
                "Des cours réguliers, un calendrier qui respecte les pauses.",
                "حصص منتظمة وجدول يحترم فترات التوقف.",
              )}
            </small>
          </span>
        </div>
        <div className="rp-actions">
          <button
            ref={trigger}
            className="button"
            onClick={() => show("repeat")}
          >
            <Repeat2 size={16} />
            {t("Cours récurrents", "حصص متكررة")}
          </button>
          <button className="button secondary" onClick={() => show("manage")}>
            <CalendarOff size={16} />
            {t("Fermetures & séries", "الإغلاقات والسلاسل")}
          </button>
        </div>
      </div>
      {!!notice && !open && (
        <div className="rp-success" role="status">
          <Check size={17} />
          {notice}
        </div>
      )}
      {open && (
        <div className="rp-overlay">
          <div
            className="rp-dialog"
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rp-title"
            tabIndex={-1}
            dir={lang === "ar" ? "rtl" : "ltr"}
          >
            <header className="rp-header">
              <div className="rp-title-icon">
                <Repeat2 size={23} />
              </div>
              <div>
                <span>{t("PLANNING INTELLIGENT", "جدولة ذكية")}</span>
                <h2 id="rp-title">
                  {t(
                    "Programmer une fois. Avancer toute l’année.",
                    "برمج مرة واحدة. واصل طوال السنة.",
                  )}
                </h2>
                <p>
                  {t(
                    "Horaires en heure d’Alger · fin de période incluse",
                    "التوقيت بتوقيت الجزائر · نهاية الفترة مشمولة",
                  )}
                </p>
              </div>
              <button
                className="rp-icon-button"
                aria-label={t("Fermer la programmation", "إغلاق الجدولة")}
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                <X size={20} />
              </button>
            </header>
            <div className="rp-tabs" role="tablist">
              <button
                role="tab"
                aria-selected={tab === "repeat"}
                disabled={busy}
                onClick={() => {
                  setTab("repeat");
                  setConfirm(null);
                  setError("");
                }}
              >
                {t("Nouvelle série", "سلسلة جديدة")}
              </button>
              <button
                role="tab"
                aria-selected={tab === "manage"}
                disabled={busy}
                onClick={() => {
                  setTab("manage");
                  setError("");
                }}
              >
                {t("Vacances & séries", "العطل والسلاسل")}
              </button>
            </div>
            {error && (
              <div className="rp-error" role="alert">
                <AlertTriangle size={18} />
                {error.startsWith("[")
                  ? t(
                      "Vérifiez les dates, les horaires et le groupe (période maximale : un an).",
                      "تحقق من التواريخ والتوقيت والمجموعة (الحد الأقصى سنة).",
                    )
                  : error}
              </div>
            )}
            {notice && (
              <div className="rp-success" role="status">
                <Check size={18} />
                {notice}
              </div>
            )}
            <div className="rp-body" aria-busy={busy}>
              {tab === "repeat" ? (
                <div className="rp-layout">
                  <fieldset disabled={busy} className="rp-fields">
                    <div className="rp-section-title">
                      <b>01</b>
                      <h3>{t("Votre cours", "درسك")}</h3>
                    </div>
                    <label>
                      {t("Groupe / matière", "المجموعة / المادة")}
                      <select
                        value={draft.group_id}
                        onChange={(e) => update({ group_id: e.target.value })}
                      >
                        <option value="">
                          {t("Choisir un groupe", "اختر مجموعة")}
                        </option>
                        {groups.map((g) => (
                          <option value={g.id} key={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="rp-grid">
                      <label>
                        {t("Du (premier jour)", "من (اليوم الأول)")}
                        <input
                          type="date"
                          value={draft.from}
                          onInput={(e) =>
                            update({ from: e.currentTarget.value })
                          }
                          onChange={(e) => update({ from: e.target.value })}
                        />
                      </label>
                      <label>
                        {t("Au (dernier jour)", "إلى (اليوم الأخير)")}
                        <input
                          type="date"
                          value={draft.to}
                          onInput={(e) => update({ to: e.currentTarget.value })}
                          min={draft.from}
                          onChange={(e) => update({ to: e.target.value })}
                        />
                      </label>
                    </div>
                    <div>
                      <span className="rp-label">
                        {t("Les jours de cours", "أيام الدروس")}
                      </span>
                      <div className="rp-pills">
                        {weekdays.map((w, i) => (
                          <label
                            key={i}
                            className={
                              draft.weekdays.includes(i) ? "selected" : ""
                            }
                          >
                            <input
                              type="checkbox"
                              checked={draft.weekdays.includes(i)}
                              onChange={(e) =>
                                update({
                                  weekdays: e.target.checked
                                    ? [...draft.weekdays, i].sort()
                                    : draft.weekdays.filter((d) => d !== i),
                                })
                              }
                            />
                            {w}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="rp-grid">
                      <label>
                        {t("Heure de début", "وقت البداية")}
                        <input
                          dir="ltr"
                          type="time"
                          value={draft.start_time}
                          onInput={(e) =>
                            update({ start_time: e.currentTarget.value })
                          }
                          onChange={(e) =>
                            update({ start_time: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        {t("Durée en minutes", "المدة بالدقائق")}
                        <input
                          type="number"
                          min={5}
                          max={720}
                          step={5}
                          value={draft.duration_minutes}
                          onChange={(e) =>
                            update({ duration_minutes: Number(e.target.value) })
                          }
                        />
                      </label>
                    </div>
                    <label>
                      {t("Répéter", "التكرار")}
                      <select
                        value={draft.interval_weeks}
                        onChange={(e) =>
                          update({ interval_weeks: Number(e.target.value) })
                        }
                      >
                        {[1, 2, 3, 4].map((n) => (
                          <option value={n} key={n}>
                            {n === 1
                              ? t("Chaque semaine", "كل أسبوع")
                              : t(`Toutes les ${n} semaines`, `كل ${n} أسابيع`)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {t(
                        "Salle (vide = salle du groupe)",
                        "القاعة (فارغ = قاعة المجموعة)",
                      )}
                      <input
                        value={draft.room}
                        onChange={(e) => update({ room: e.target.value })}
                        maxLength={100}
                      />
                    </label>
                    <div className="rp-section-title">
                      <b>02</b>
                      <h3>{t("Les pauses à respecter", "فترات التوقف")}</h3>
                    </div>
                    <p className="rp-help">
                      {t(
                        "Les fermetures enregistrées pour l’école sont exclues automatiquement. Ajoutez ici les exceptions de cette série.",
                        "تُستثنى إغلاقات المدرسة المسجلة تلقائيًا. أضف هنا استثناءات هذه السلسلة.",
                      )}
                    </p>
                    <div>
                      <span className="rp-label">
                        {t("Mois sans cours", "أشهر بدون دروس")}
                      </span>
                      <div className="rp-months">
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(
                          (m) => (
                            <label
                              key={m}
                              className={
                                draft.excluded_months.includes(m)
                                  ? "selected"
                                  : ""
                              }
                            >
                              <input
                                type="checkbox"
                                checked={draft.excluded_months.includes(m)}
                                onChange={(e) =>
                                  update({
                                    excluded_months: e.target.checked
                                      ? [...draft.excluded_months, m].sort(
                                          (a, b) => a - b,
                                        )
                                      : draft.excluded_months.filter(
                                          (v) => v !== m,
                                        ),
                                  })
                                }
                              />
                              {new Date(
                                `2026-${String(m).padStart(2, "0")}-01T12:00:00Z`,
                              ).toLocaleDateString(
                                lang === "fr" ? "fr-DZ" : "ar-DZ",
                                { month: "short" },
                              )}
                            </label>
                          ),
                        )}
                      </div>
                    </div>
                    <label>
                      {t("Dates à exclure", "تواريخ مستثناة")}
                      <textarea
                        rows={2}
                        placeholder="2026-11-01, 2026-12-25"
                        value={dateText}
                        onChange={(e) => {
                          setDateText(e.target.value);
                          setPreview(null);
                          requestId.current = "";
                        }}
                      />
                      <small>
                        {t(
                          "Format AAAA-MM-JJ, séparées par des virgules ou une nouvelle ligne.",
                          "بصيغة AAAA-MM-JJ، مفصولة بفواصل أو أسطر جديدة.",
                        )}
                      </small>
                    </label>
                    {draft.excluded_periods.map((p, i) => (
                      <div className="rp-period" key={i}>
                        <label>
                          {t("Motif de la pause", "سبب التوقف")}
                          <input
                            value={p.label}
                            onChange={(e) =>
                              update({
                                excluded_periods: draft.excluded_periods.map(
                                  (v, n) =>
                                    n === i
                                      ? { ...v, label: e.target.value }
                                      : v,
                                ),
                              })
                            }
                          />
                        </label>
                        <div className="rp-grid">
                          <label>
                            {t("Début de la pause", "بداية التوقف")}
                            <input
                              type="date"
                              value={p.from}
                              onInput={(e) =>
                                update({
                                  excluded_periods: draft.excluded_periods.map(
                                    (v, n) =>
                                      n === i
                                        ? { ...v, from: e.currentTarget.value }
                                        : v,
                                  ),
                                })
                              }
                              onChange={(e) =>
                                update({
                                  excluded_periods: draft.excluded_periods.map(
                                    (v, n) =>
                                      n === i
                                        ? { ...v, from: e.target.value }
                                        : v,
                                  ),
                                })
                              }
                            />
                          </label>
                          <label>
                            {t("Fin de la pause", "نهاية التوقف")}
                            <input
                              type="date"
                              value={p.to}
                              onInput={(e) =>
                                update({
                                  excluded_periods: draft.excluded_periods.map(
                                    (v, n) =>
                                      n === i
                                        ? { ...v, to: e.currentTarget.value }
                                        : v,
                                  ),
                                })
                              }
                              min={p.from}
                              onChange={(e) =>
                                update({
                                  excluded_periods: draft.excluded_periods.map(
                                    (v, n) =>
                                      n === i
                                        ? { ...v, to: e.target.value }
                                        : v,
                                  ),
                                })
                              }
                            />
                          </label>
                        </div>
                        <button
                          className="rp-text-button"
                          onClick={() =>
                            update({
                              excluded_periods: draft.excluded_periods.filter(
                                (_, n) => i !== n,
                              ),
                            })
                          }
                        >
                          <Trash2 size={14} />
                          {t("Retirer cette pause", "حذف هذه الفترة")}
                        </button>
                      </div>
                    ))}
                    {draft.excluded_periods.length < 24 && (
                      <button
                        className="button secondary"
                        onClick={() =>
                          update({
                            excluded_periods: [
                              ...draft.excluded_periods,
                              {
                                label: t("Vacances", "عطلة"),
                                from: draft.from,
                                to: draft.from,
                              },
                            ],
                          })
                        }
                      >
                        <Plus size={15} />
                        {t("Ajouter une période de pause", "إضافة فترة توقف")}
                      </button>
                    )}
                    <label>
                      {t("Notes communes aux séances", "ملاحظات مشتركة للحصص")}
                      <textarea
                        rows={2}
                        value={draft.notes}
                        maxLength={2000}
                        onChange={(e) => update({ notes: e.target.value })}
                      />
                    </label>
                    <label className="rp-check">
                      <input
                        type="checkbox"
                        checked={draft.skip_conflicts}
                        onChange={(e) =>
                          update({ skip_conflicts: e.target.checked })
                        }
                      />
                      <span>
                        {t(
                          "Exclure les créneaux en conflit",
                          "استثناء الأوقات المتعارضة",
                        )}
                        <small>
                          {t(
                            "Sinon, aucun cours n’est créé tant qu’un conflit subsiste.",
                            "وإلا لن يتم إنشاء أي حصة مع وجود تعارض.",
                          )}
                        </small>
                      </span>
                    </label>
                    <button
                      className="button"
                      onClick={() =>
                        void run(async () => {
                          const data = await api(
                            "planning/preview",
                            "POST",
                            payload(),
                          );
                          setPreview(data);
                          if (!requestId.current)
                            requestId.current = crypto.randomUUID();
                        })
                      }
                    >
                      <CalendarDays size={16} />
                      {busy
                        ? t("Un instant…", "لحظة…")
                        : t(
                            "Vérifier et afficher l’aperçu",
                            "التحقق وعرض المعاينة",
                          )}
                    </button>
                  </fieldset>
                  <aside className="rp-preview">
                    <div className="rp-preview-heading">
                      <CalendarDays size={22} />
                      <h3>{t("Avant de programmer", "قبل الجدولة")}</h3>
                    </div>
                    {!preview ? (
                      <div className="rp-placeholder">
                        <Repeat2 size={38} />
                        <strong>
                          {t(
                            "Une série, toutes vos séances",
                            "سلسلة واحدة، كل حصصك",
                          )}
                        </strong>
                        <p>
                          {t(
                            "Choisissez votre rythme, puis vérifiez les dates. Vous gardez le contrôle avant la création.",
                            "اختر الوتيرة ثم تحقق من التواريخ قبل الإنشاء.",
                          )}
                        </p>
                      </div>
                    ) : (
                      <>
                        <strong className="rp-group-name">
                          {preview.group_name}
                        </strong>
                        <span className="rp-help">
                          {preview.room ||
                            t("Salle à définir", "قاعة غير محددة")}{" "}
                          · {draft.duration_minutes} min
                        </span>
                        <div className="rp-stats">
                          <div>
                            <strong>{preview.accepted.length}</strong>
                            <span>{t("à créer", "للإنشاء")}</span>
                          </div>
                          <div>
                            <strong>{preview.excluded.length}</strong>
                            <span>{t("exclues", "مستثناة")}</span>
                          </div>
                          <div
                            className={
                              preview.conflicts.length ? "warning" : ""
                            }
                          >
                            <strong>{preview.conflicts.length}</strong>
                            <span>{t("conflits", "تعارضات")}</span>
                          </div>
                        </div>
                        {!!preview.conflicts.length && (
                          <p className="rp-warning">
                            {draft.skip_conflicts
                              ? t(
                                  "Les créneaux en conflit seront ignorés.",
                                  "سيتم تجاهل الأوقات المتعارضة.",
                                )
                              : t(
                                  "Changez les horaires ou cochez l’exclusion des conflits pour continuer.",
                                  "غيّر التوقيت أو اختر استثناء التعارضات للمتابعة.",
                                )}
                          </p>
                        )}
                        <div className="rp-date-list">
                          {preview.accepted.map((o) => (
                            <div key={o.date}>
                              <Check size={14} />
                              <span>
                                {displayDate(o.date)}
                                <small dir="ltr">
                                  {localDate(o.starts_at).split(" ").at(-1)} ·{" "}
                                  {draft.duration_minutes} min
                                </small>
                              </span>
                            </div>
                          ))}
                        </div>
                        {!!preview.excluded.length && (
                          <details>
                            <summary>
                              {t(
                                "Voir les dates exclues",
                                "عرض التواريخ المستثناة",
                              )}{" "}
                              ({preview.excluded.length})
                            </summary>
                            <div className="rp-date-list">
                              {preview.excluded.map((o) => (
                                <div key={o.date}>
                                  <CalendarOff size={14} />
                                  <span>
                                    {displayDate(o.date)}
                                    <small>{reason(o)}</small>
                                  </span>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                        {!!preview.conflicts.length && (
                          <details open>
                            <summary>
                              {t("Détail des conflits", "تفاصيل التعارضات")}
                            </summary>
                            <div className="rp-date-list">
                              {preview.conflicts.map((o) => (
                                <div key={o.date}>
                                  <AlertTriangle size={14} />
                                  <span>
                                    {displayDate(o.date)}
                                    <small>
                                      {o.conflicts
                                        .map(
                                          (c: Row) =>
                                            c.group_name + " · " + c.room,
                                        )
                                        .join(" / ")}
                                    </small>
                                  </span>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                        <button
                          className="button rp-create"
                          disabled={
                            busy ||
                            !preview.accepted.length ||
                            !!(
                              preview.conflicts.length && !draft.skip_conflicts
                            )
                          }
                          onClick={() =>
                            void run(async () => {
                              const result = await api(
                                "planning/series",
                                "POST",
                                { ...payload(), request_id: requestId.current },
                              );
                              setNotice(
                                t(
                                  `${result.created} séances programmées.`,
                                  `${result.created} حصة تمت جدولتها.`,
                                ),
                              );
                              setPreview(null);
                              requestId.current = "";
                              onChanged();
                              await refresh();
                              setOpen(false);
                            })
                          }
                        >
                          <Check size={17} />
                          {t(
                            `Programmer les ${preview.accepted.length} séances`,
                            `جدولة ${preview.accepted.length} حصة`,
                          )}
                        </button>
                        <p className="rp-help">
                          {t(
                            "Les disponibilités sont vérifiées à nouveau lors de l’enregistrement.",
                            "تتم إعادة التحقق من التوفر عند الحفظ.",
                          )}
                        </p>
                      </>
                    )}
                  </aside>
                </div>
              ) : (
                <div className="rp-management">
                  <section>
                    <div className="rp-section-title">
                      <CalendarOff size={21} />
                      <h3>
                        {t("Fermetures de l’établissement", "إغلاقات المؤسسة")}
                      </h3>
                    </div>
                    <p className="rp-help">
                      {t(
                        "Vacances, fermeture d’été, jours fériés : renseignez les dates propres à votre école. Aucun calendrier de vacances n’est imposé.",
                        "سجّل تواريخ العطل والإغلاق الصيفي والأعياد الخاصة بمدرستك. لا يتم فرض رزنامة عطل.",
                      )}
                    </p>
                    {localClosures.length ? (
                      localClosures.map((c) => (
                        <div className="rp-entry" key={c.id}>
                          <div>
                            <strong>{c.label}</strong>
                            <small>
                              {displayDate(c.from)} → {displayDate(c.to)}
                            </small>
                          </div>
                          {admin && (
                            <button
                              aria-label={t(
                                `Retirer ${c.label}`,
                                `حذف ${c.label}`,
                              )}
                              className="rp-icon-button"
                              disabled={busy}
                              onClick={() =>
                                setConfirm({ kind: "closure", row: c })
                              }
                            >
                              <Trash2 size={17} />
                            </button>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="rp-help">
                        {t(
                          "Aucune fermeture enregistrée.",
                          "لا توجد إغلاقات مسجلة.",
                        )}
                      </p>
                    )}
                    {admin && (
                      <fieldset
                        disabled={busy}
                        className="rp-fields rp-closure-form"
                      >
                        <label>
                          {t("Motif de fermeture", "سبب الإغلاق")}
                          <input
                            value={closure.label}
                            maxLength={120}
                            placeholder={t("Vacances d’été", "العطلة الصيفية")}
                            onChange={(e) =>
                              updateClosure({ label: e.target.value })
                            }
                          />
                        </label>
                        <div className="rp-grid">
                          <label>
                            {t("Fermeture du", "الإغلاق من")}
                            <input
                              type="date"
                              value={closure.from}
                              onInput={(e) =>
                                updateClosure({ from: e.currentTarget.value })
                              }
                              onChange={(e) =>
                                updateClosure({ from: e.target.value })
                              }
                            />
                          </label>
                          <label>
                            {t("Fermeture au", "الإغلاق إلى")}
                            <input
                              type="date"
                              value={closure.to}
                              onInput={(e) =>
                                updateClosure({ to: e.currentTarget.value })
                              }
                              min={closure.from}
                              onChange={(e) =>
                                updateClosure({ to: e.target.value })
                              }
                            />
                          </label>
                        </div>
                        <button
                          className="button secondary"
                          onClick={() =>
                            void run(async () => {
                              const v = await api(
                                "planning/closures/preview",
                                "POST",
                                closure,
                              );
                              setClosurePreview(v.affected);
                            })
                          }
                        >
                          {t(
                            "Vérifier les séances concernées",
                            "التحقق من الحصص المعنية",
                          )}
                        </button>
                        {closurePreview && (
                          <div className="rp-closure-impact">
                            <strong>
                              {t(
                                `${closurePreview.length} séances à venir concernées.`,
                                `${closurePreview.length} حصة قادمة معنية.`,
                              )}
                            </strong>
                            <p className="rp-help">
                              {t(
                                "Les séances en cours, passées et terminées sont conservées. Les nouveaux cours seront bloqués pendant cette période.",
                                "تُحفظ الحصص الجارية والسابقة والمكتملة. تُمنع الحصص الجديدة خلال هذه الفترة.",
                              )}
                            </p>
                            {closurePreview.length > 0 && (
                              <label className="rp-check">
                                <input
                                  type="checkbox"
                                  checked={cancelLessons}
                                  onChange={(e) =>
                                    setCancelLessons(e.target.checked)
                                  }
                                />
                                <span>
                                  {t(
                                    "Annuler ces séances à venir et informer les utilisateurs concernés dans Midad",
                                    "إلغاء هذه الحصص القادمة وإشعار المستخدمين المعنيين في مداد",
                                  )}
                                </span>
                              </label>
                            )}
                            <button
                              className="button"
                              disabled={
                                !!closurePreview.length && !cancelLessons
                              }
                              onClick={() =>
                                void run(async () => {
                                  const r = await api(
                                    "planning/closures",
                                    "POST",
                                    {
                                      ...closure,
                                      cancel_sessions: cancelLessons,
                                    },
                                  );
                                  setNotice(
                                    t(
                                      `Fermeture enregistrée · ${r.cancelled} séances annulées.`,
                                      `تم تسجيل الإغلاق · ${r.cancelled} حصة ملغاة.`,
                                    ),
                                  );
                                  setClosurePreview(null);
                                  setCancelLessons(false);
                                  setPreview(null);
                                  onChanged();
                                  await refresh();
                                })
                              }
                            >
                              {t("Enregistrer la fermeture", "حفظ الإغلاق")}
                            </button>
                          </div>
                        )}
                      </fieldset>
                    )}
                  </section>
                  <section>
                    <div className="rp-section-title">
                      <Repeat2 size={21} />
                      <h3>{t("Séries programmées", "السلاسل المجدولة")}</h3>
                    </div>
                    <p className="rp-help">
                      {t(
                        "Chaque séance reste modifiable individuellement dans le calendrier.",
                        "يمكن تعديل كل حصة بشكل مستقل في التقويم.",
                      )}
                    </p>
                    {series.length ? (
                      series.map((s) => (
                        <div className="rp-entry" key={s.id}>
                          <div>
                            <strong>{s.group_name}</strong>
                            <small>
                              {s.rule.weekdays
                                .map((d: number) => weekdays[d])
                                .join(" · ")}{" "}
                              · <span dir="ltr">{s.rule.start_time}</span> ·{" "}
                              {s.rule.duration_minutes} min
                            </small>
                            <small>
                              {displayDate(s.rule.from)} →{" "}
                              {displayDate(s.rule.to)}
                            </small>
                            <small>
                              {t(
                                `${s.total} séances · ${s.future} à venir`,
                                `${s.total} حصة · ${s.future} قادمة`,
                              )}
                            </small>
                          </div>
                          <button
                            className="button secondary"
                            disabled={busy || !s.future}
                            onClick={() =>
                              setConfirm({ kind: "series", row: s })
                            }
                          >
                            {t("Arrêter la série", "إيقاف السلسلة")}
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="rp-help">
                        {t(
                          "Aucune série programmée pour l’instant.",
                          "لا توجد سلاسل مجدولة حاليًا.",
                        )}
                      </p>
                    )}
                  </section>
                  {confirm && (
                    <section className="rp-confirm" role="alert">
                      <strong>
                        {confirm.kind === "series"
                          ? t(
                              `Annuler les séances à venir de ${confirm.row.group_name} ?`,
                              `إلغاء الحصص القادمة لـ ${confirm.row.group_name}؟`,
                            )
                          : t(
                              `Retirer la fermeture « ${confirm.row.label} » ?`,
                              `حذف الإغلاق « ${confirm.row.label} »؟`,
                            )}
                      </strong>
                      <p>
                        {confirm.kind === "series"
                          ? t(
                              "Les séances passées et terminées restent dans l’historique.",
                              "تُحفظ الحصص السابقة والمكتملة في السجل.",
                            )
                          : t(
                              "Les séances déjà annulées ne seront pas rétablies. Vous pourrez les reprogrammer individuellement.",
                              "لن تُستعاد الحصص الملغاة تلقائيًا. يمكنك إعادة جدولتها بشكل مستقل.",
                            )}
                      </p>
                      <div className="rp-actions">
                        <button
                          className="button secondary"
                          disabled={busy}
                          onClick={() => setConfirm(null)}
                        >
                          {t("Garder", "الاحتفاظ")}
                        </button>
                        <button
                          className="button"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              if (confirm.kind === "series")
                                await api(
                                  `planning/series/${confirm.row.id}/cancel`,
                                  "POST",
                                  {},
                                );
                              else
                                await api(
                                  `planning/closures/${confirm.row.id}`,
                                  "DELETE",
                                );
                              setConfirm(null);
                              setPreview(null);
                              setNotice(
                                t(
                                  "Calendrier mis à jour.",
                                  "تم تحديث التقويم.",
                                ),
                              );
                              await refresh();
                              onChanged();
                            })
                          }
                        >
                          {t("Confirmer", "تأكيد")}
                        </button>
                      </div>
                    </section>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
