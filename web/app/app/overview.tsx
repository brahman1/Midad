"use client";
import {
  Users,
  BookOpen,
  Wallet,
  ArrowUpRight,
  Plus,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Receipt,
  Clock3,
  GraduationCap,
} from "lucide-react";
import { User, adminRoles, dinars } from "@midad/shared";
type Row = Record<string, any>;
export default function Overview({
  data,
  user,
  lang,
  navigate,
  onStudent,
  onSession,
  attendance,
}: {
  data: Row;
  user: User;
  lang: "fr" | "ar";
  navigate: (p: string) => void;
  onStudent: () => void;
  onSession: () => void;
  attendance: (r: Row) => void;
}) {
  const t = (f: string, a: string) => (lang === "fr" ? f : a);
  const money = (v: number) => dinars(v ?? 0, lang);
  const teacher = user.role === "TEACHER";
  const admin = adminRoles.includes(user.role);
  const attendanceRate = data.attendance?.total
    ? Math.round((data.attendance.present * 100) / data.attendance.total)
    : null;
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000);
    const day = d.toLocaleDateString("en-CA", { timeZone: "Africa/Algiers" });
    return {
      day,
      label: d.toLocaleDateString(lang === "fr" ? "fr-DZ" : "ar-DZ", {
        weekday: "short",
        timeZone: "Africa/Algiers",
      }),
      total: data.cashflow?.find((r: Row) => r.day === day)?.total ?? 0,
    };
  });
  const max = Math.max(1, ...week.map((d) => Math.abs(d.total)));
  const weekTotal = week.reduce((sum, d) => sum + d.total, 0);
  const cards = [
    {
      label: t("Élèves inscrits", "التلاميذ المسجلون"),
      value: data.students,
      detail: t("Dossiers actifs", "ملفات نشطة"),
      Icon: Users,
      color: "blue",
      page: "students",
    },
    {
      label: t("Groupes de cours", "مجموعات الدروس"),
      value: data.groups,
      detail: `${data.teachers ?? 0} ${t("enseignants associés", "أساتذة مرتبطون")}`,
      Icon: BookOpen,
      color: "purple",
      page: "groups",
    },
    {
      label: teacher
        ? t("Séances planifiées", "الحصص المبرمجة")
        : t("Encaissé ce mois", "تحصيل هذا الشهر"),
      value: teacher ? data.sessions : money(data.collected_centimes),
      detail: teacher
        ? t("Votre planning", "جدولك")
        : t("Encaissements nets", "صافي التحصيل"),
      Icon: Wallet,
      color: "green",
      page: teacher ? "sessions" : "payments",
    },
    {
      label: t("Présences · 30 jours", "الحضور · 30 يومًا"),
      value: attendanceRate === null ? "—" : `${attendanceRate}%`,
      detail: `${data.attendance?.present ?? 0} / ${data.attendance?.total ?? 0} ${t("présences et retards", "حضور وتأخر")}`,
      Icon: CheckCircle2,
      color: "orange",
      page: "sessions",
    },
  ];
  return (
    <div className="overview">
      {data.demo && (
        <div className="demo-ribbon">
          <span className="live-dot" />
          {t("ESPACE DE DÉMONSTRATION", "مساحة تجريبية")}
          <span>
            {t(
              "Toutes les données sont fictives. Vous pouvez tester les parcours.",
              "جميع البيانات وهمية. يمكنك تجربة الوظائف.",
            )}
          </span>
        </div>
      )}
      <section className="overview-hero">
        <div>
          <span className="hero-kicker">
            MIDAD · {t("VOTRE CENTRE, CONNECTÉ", "مركزك متصل")}
          </span>
          <h2>
            {t(
              `Bonjour, ${user.name.split(" ")[0]}.`,
              `مرحبًا، ${user.name.split(" ")[0]}.`,
            )}
            <br />
            {t("Une belle journée commence ici.", "يوم جميل يبدأ هنا.")}
          </h2>
          <p>
            {t(
              "Gardez le fil des cours, des familles et de votre équipe.",
              "تابع الدروس والعائلات وفريقك من مكان واحد.",
            )}
          </p>
          <div className="hero-actions">
            <button onClick={admin ? onStudent : () => navigate("sessions")}>
              <Plus size={17} />
              {admin
                ? t("Inscrire un élève", "تسجيل تلميذ")
                : t("Consulter le planning", "عرض الجدول")}
            </button>
            <button
              className="hero-secondary"
              onClick={() => navigate("groups")}
            >
              {t("Voir les groupes", "عرض المجموعات")}
              <ArrowUpRight size={17} />
            </button>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-orbit" />
          <GraduationCap size={80} strokeWidth={1} />
          <span className="hero-art-note">
            <CheckCircle2 size={16} />
            {t("Tout votre centre. Un seul espace.", "مركزك كله في مكان واحد.")}
          </span>
        </div>
      </section>
      <div className="overview-stats">
        {cards.map((c) => (
          <button
            className={`overview-stat ${c.color}`}
            key={c.page + c.label}
            onClick={() => navigate(c.page)}
          >
            <div className="stat-top">
              <span>{c.label}</span>
              <span className="stat-icon">
                <c.Icon size={20} />
              </span>
            </div>
            <strong>{c.value ?? 0}</strong>
            <small>
              {c.detail}
              <ArrowUpRight size={14} />
            </small>
          </button>
        ))}
      </div>
      <div className="overview-main-grid">
        <section className="overview-panel">
          <div className="overview-panel-head">
            <div>
              <h3>
                {teacher
                  ? t("Vos groupes", "مجموعاتك")
                  : t("Encaissements de la semaine", "تحصيل الأسبوع")}
              </h3>
              <p>
                {teacher
                  ? t(
                      "Effectifs et places disponibles",
                      "الأعداد والأماكن المتاحة",
                    )
                  : t(
                      "Les sept derniers jours · montants nets en DA",
                      "آخر سبعة أيام · مبالغ صافية بالدينار",
                    )}
              </p>
            </div>
            <span className="mini-label">
              {teacher ? "" : t("7 jours", "7 أيام")}
            </span>
          </div>
          {teacher ? (
            <GroupList data={data} lang={lang} navigate={navigate} />
          ) : (
            <>
              <div className="chart-total">
                {money(weekTotal)}
                <span>{t("sur la période", "خلال الفترة")}</span>
              </div>
              <div
                className="overview-bars"
                role="img"
                aria-label={t("Encaissements par jour", "التحصيل اليومي")}
              >
                {week.map((d, i) => (
                  <div
                    className="bar-column"
                    key={d.day}
                    title={`${d.day} : ${money(d.total)}`}
                  >
                    <div className="bar-space">
                      <span
                        className={
                          d.total < 0 ? "negative" : i === 6 ? "current" : ""
                        }
                        style={{
                          height: `${d.total === 0 ? 3 : Math.max(8, (Math.abs(d.total) / max) * 130)}px`,
                        }}
                      />
                    </div>
                    <small>{d.label}</small>
                  </div>
                ))}
              </div>
              {week.every((d) => !d.total) && (
                <p className="chart-empty">
                  {t(
                    "Aucun mouvement enregistré sur cette période.",
                    "لم تسجل حركات خلال هذه الفترة.",
                  )}
                </p>
              )}
              <div className="chart-foot">
                <span>
                  <i />
                  {t(
                    "Encaissements moins remboursements",
                    "التحصيل ناقص الاستردادات",
                  )}
                </span>
                <button onClick={() => navigate("payments")}>
                  {t("Ouvrir la caisse", "فتح الصندوق")}
                  <ArrowUpRight size={14} />
                </button>
              </div>
            </>
          )}
        </section>
        <section className="overview-panel agenda-panel">
          <div className="overview-panel-head">
            <div>
              <h3>{t("Prochaines séances", "الحصص القادمة")}</h3>
              <p>
                {t("Votre agenda · heure d’Alger", "جدولك · توقيت الجزائر")}
              </p>
            </div>
            <button
              className="circle-action"
              onClick={
                admin || teacher ? onSession : () => navigate("sessions")
              }
              aria-label={t("Planifier une séance", "جدولة حصة")}
            >
              <Plus size={18} />
            </button>
          </div>
          {data.upcoming?.length ? (
            data.upcoming.slice(0, 4).map((s: Row, i: number) => (
              <button
                key={s.id}
                className="overview-agenda-row"
                onClick={() => attendance(s)}
              >
                <span className={`agenda-icon tone-${i % 3}`}>
                  <BookOpen size={20} />
                </span>
                <span className="agenda-body">
                  <strong>{s.group_name}</strong>
                  <small>
                    {new Date(s.starts_at).toLocaleDateString(
                      lang === "fr" ? "fr-DZ" : "ar-DZ",
                      {
                        day: "numeric",
                        month: "short",
                        timeZone: "Africa/Algiers",
                      },
                    )}{" "}
                    ·{" "}
                    {s.teacher_name ||
                      t("Enseignant à affecter", "أستاذ غير معين")}
                  </small>
                </span>
                <span className="agenda-hour">
                  {new Date(s.starts_at).toLocaleTimeString("fr-DZ", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hourCycle: "h23",
                    timeZone: "Africa/Algiers",
                  })}
                  <small>{s.room}</small>
                </span>
              </button>
            ))
          ) : (
            <div className="overview-empty">
              <CalendarDays size={30} />
              <strong>
                {t(
                  "Votre prochaine séance se prépare ici",
                  "جهز حصتك القادمة هنا",
                )}
              </strong>
              <p>
                {t(
                  "Planifiez un cours pour le retrouver dans votre agenda.",
                  "جدول درسًا لعرضه في هذا المكان.",
                )}
              </p>
            </div>
          )}
          <button
            className="overview-panel-link"
            onClick={() => navigate("sessions")}
          >
            {t("Tout le planning", "الجدول الكامل")}
            <ArrowUpRight size={15} />
          </button>
        </section>
      </div>
      <div className="overview-bottom-grid">
        <section className="overview-panel">
          <div className="overview-panel-head">
            <div>
              <h3>{t("Les groupes du centre", "مجموعات المركز")}</h3>
              <p>{t("Une vue sur vos effectifs", "نظرة على الأعداد")}</p>
            </div>
            <BookOpen size={19} />
          </div>
          <GroupList data={data} lang={lang} navigate={navigate} />
        </section>
        <section className="overview-panel">
          <div className="overview-panel-head">
            <div>
              <h3>
                {teacher
                  ? t("Élèves de vos groupes", "تلاميذ مجموعاتك")
                  : t("Échéances à suivre", "مستحقات للمتابعة")}
              </h3>
              <p>
                {teacher
                  ? t("Dossiers récemment créés", "ملفات أنشئت مؤخرًا")
                  : `${data.overdue ?? 0} ${t("échéances en retard", "مستحقات متأخرة")}`}
              </p>
            </div>
            {teacher ? <Users size={19} /> : <Receipt size={19} />}
          </div>
          {(teacher ? data.recent_students : data.outstanding)
            ?.slice(0, 4)
            .map((r: Row, i: number) => (
              <button
                className="overview-person"
                key={r.id}
                onClick={() => navigate(teacher ? "students" : "invoices")}
              >
                <span className={`person-avatar tone-${i % 3}`}>
                  {(r.student_name || r.name)
                    .split(" ")
                    .slice(0, 2)
                    .map((n: string) => n[0])
                    .join("")}
                </span>
                <span>
                  <strong>{r.student_name || r.name}</strong>
                  <small>{teacher ? r.level : r.group_name || r.label}</small>
                </span>
                <span className="person-amount">
                  {teacher ? r.level : money(r.balance_centimes)}
                  {!teacher && <small>{r.due_date}</small>}
                </span>
              </button>
            ))}
          {!(teacher ? data.recent_students : data.outstanding)?.length && (
            <div className="overview-empty">
              <CheckCircle2 size={28} />
              <p>{t("Tout est à jour.", "كل شيء محدث.")}</p>
            </div>
          )}
          <button
            className="overview-panel-link"
            onClick={() => navigate(teacher ? "students" : "invoices")}
          >
            {teacher
              ? t("Tous les élèves", "كل التلاميذ")
              : t("Toutes les échéances", "كل المستحقات")}
            <ArrowUpRight size={15} />
          </button>
        </section>
      </div>
      {!teacher && (
        <section className="overview-panel recent-payments">
          <div className="overview-panel-head">
            <div>
              <h3>{t("Derniers règlements", "آخر الدفعات")}</h3>
              <p>
                {t("Chaque mouvement, avec son reçu", "كل حركة مع إيصالها")}
              </p>
            </div>
            <button
              className="text-button"
              onClick={() => navigate("payments")}
            >
              {t("Voir tout", "عرض الكل")}
              <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="recent-payment-table">
            {data.recent_payments?.map((r: Row) => (
              <button
                key={r.id}
                className="overview-payment"
                onClick={() => navigate("payments")}
              >
                <span className="payment-mark">
                  <Wallet size={18} />
                </span>
                <span>
                  <strong>{r.student_name}</strong>
                  <small>
                    #{r.receipt_number} ·{" "}
                    {new Date(r.created_at).toLocaleDateString(
                      lang === "fr" ? "fr-DZ" : "ar-DZ",
                      {
                        day: "numeric",
                        month: "short",
                        timeZone: "Africa/Algiers",
                      },
                    )}
                  </small>
                </span>
                <span className="method-tag">
                  {r.method === "cash"
                    ? t("Espèces", "نقد")
                    : r.method === "ccp"
                      ? "CCP"
                      : t("Virement / carte", "تحويل / بطاقة")}
                </span>
                <strong
                  className={
                    r.kind === "refund" ? "refund-amount" : "paid-amount"
                  }
                >
                  {r.kind === "refund" ? "−" : "+"}
                  {money(r.amount_centimes)}
                </strong>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
          {!data.recent_payments?.length && (
            <p className="chart-empty">
              {t(
                "Vos premiers règlements apparaîtront ici.",
                "ستظهر دفعاتك الأولى هنا.",
              )}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
function GroupList({
  data,
  lang,
  navigate,
}: {
  data: Row;
  lang: "fr" | "ar";
  navigate: (p: string) => void;
}) {
  return (
    <div className="overview-groups">
      {data.group_overview?.slice(0, 4).map((g: Row, i: number) => (
        <button
          className="overview-group"
          key={g.id}
          onClick={() => navigate("groups")}
        >
          <span className={`group-initial tone-${i % 3}`}>
            {g.subject.slice(0, 1)}
          </span>
          <span className="group-info">
            <strong>{g.name}</strong>
            <span className="capacity-track">
              <i
                style={{
                  width: `${Math.min(100, (g.student_count / g.capacity) * 100)}%`,
                }}
              />
            </span>
          </span>
          <span className="group-capacity">
            <strong>
              {g.student_count}
              <small> / {g.capacity}</small>
            </strong>
            <small>{lang === "fr" ? "élèves" : "تلاميذ"}</small>
          </span>
        </button>
      ))}
      {!data.group_overview?.length && (
        <p className="chart-empty">
          {lang === "fr"
            ? "Créez votre premier groupe pour commencer."
            : "أنشئ مجموعتك الأولى للبدء."}
        </p>
      )}
    </div>
  );
}
