import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { User, adminRoles, dinars } from "@midad/shared";
type Row = Record<string, any>;
export default function MobileOverview({
  data,
  user,
  ar,
  wide,
  nav,
  onStudent,
  onSession,
  onAttendance,
}: {
  data: Row;
  user: User;
  ar: boolean;
  wide: boolean;
  nav: (p: string) => void;
  onStudent: () => void;
  onSession: () => void;
  onAttendance: (r: Row) => void;
}) {
  const t = (f: string, a: string) => (ar ? a : f);
  const money = (n: number) => dinars(n ?? 0, ar ? "ar" : "fr");
  const teacher = user.role === "TEACHER",
    admin = adminRoles.includes(user.role);
  const rate = data.attendance?.total
    ? Math.round((data.attendance.present * 100) / data.attendance.total)
    : null;
  const align = ar ? { textAlign: "right" as const } : {};
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.now() - (6 - i) * 86400000),
      day = date.toLocaleDateString("en-CA", { timeZone: "Africa/Algiers" });
    return {
      day,
      label: date.toLocaleDateString(ar ? "ar-DZ" : "fr-DZ", {
        weekday: "short",
        timeZone: "Africa/Algiers",
      }),
      total: data.cashflow?.find((x: Row) => x.day === day)?.total ?? 0,
    };
  });
  const max = Math.max(1, ...week.map((x) => Math.abs(x.total)));
  const statCards = [
    {
      label: t("Élèves inscrits", "التلاميذ المسجلون"),
      value: data.students,
      sub: t("Dossiers actifs", "ملفات نشطة"),
      page: "students",
      color: "#617ae7",
      bg: "#eef2ff",
      symbol: "◉",
    },
    {
      label: t("Groupes de cours", "مجموعات الدروس"),
      value: data.groups,
      sub: `${data.teachers ?? 0} ${t("enseignants", "أساتذة")}`,
      page: "groups",
      color: "#a47ada",
      bg: "#f5efff",
      symbol: "▦",
    },
    {
      label: teacher
        ? t("Séances prévues", "الحصص المبرمجة")
        : t("Encaissé ce mois", "تحصيل هذا الشهر"),
      value: teacher ? data.sessions : money(data.collected_centimes),
      sub: t("Selon votre espace", "حسب مساحتك"),
      page: teacher ? "sessions" : "payments",
      color: "#4eaa8c",
      bg: "#ecf8f3",
      symbol: "↗",
    },
    {
      label: t("Présences · 30 jours", "الحضور · 30 يومًا"),
      value: rate === null ? "—" : `${rate}%`,
      sub: t("Présents et retards", "حضور وتأخر"),
      page: "sessions",
      color: "#d6a265",
      bg: "#fff4e8",
      symbol: "✓",
    },
  ];
  return (
    <View style={{ gap: 20, direction: ar ? "rtl" : "ltr" }}>
      {data.demo && (
        <View style={o.demo}>
          <View style={o.demoDot} />
          <Text style={[o.demoText, align]}>
            {t("DÉMONSTRATION · données fictives", "عرض تجريبي · بيانات وهمية")}
          </Text>
        </View>
      )}
      <View style={o.hero}>
        <View style={o.heroCircle} />
        <Text style={[o.kicker, align]}>
          MIDAD · {t("VOTRE CENTRE, CONNECTÉ", "مركزك متصل")}
        </Text>
        <Text style={[o.heroTitle, align]}>
          {t(
            `Bonjour, ${user.name.split(" ")[0]}.`,
            `مرحبًا، ${user.name.split(" ")[0]}.`,
          )}
          {"\n"}
          {t("Une belle journée commence ici.", "يوم جميل يبدأ هنا.")}
        </Text>
        <Text style={[o.heroSub, align]}>
          {t(
            "Vos cours, vos familles et votre équipe. Au même endroit.",
            "دروسك وعائلاتك وفريقك. في مكان واحد.",
          )}
        </Text>
        <View style={o.heroActions}>
          <Pressable
            accessibilityRole="button"
            style={o.heroButton}
            onPress={admin ? onStudent : () => nav("sessions")}
          >
            <Text style={o.heroButtonText}>
              ＋{" "}
              {admin
                ? t("Inscrire un élève", "تسجيل تلميذ")
                : t("Mon planning", "جدولي")}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={o.heroSecondary}
            onPress={() => nav("groups")}
          >
            <Text style={o.heroSecondaryText}>
              {t("Voir les groupes", "عرض المجموعات")} ↗
            </Text>
          </Pressable>
        </View>
      </View>
      <View style={o.stats}>
        {statCards.map((c) => (
          <Pressable
            accessibilityRole="button"
            key={c.label}
            onPress={() => nav(c.page)}
            style={[o.stat, { width: wide ? "23.5%" : "48%" }]}
          >
            <View style={o.statHead}>
              <Text style={[o.statLabel, align]}>{c.label}</Text>
              <Text
                style={[
                  o.statSymbol,
                  { color: c.color, backgroundColor: c.bg },
                ]}
              >
                {c.symbol}
              </Text>
            </View>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
              style={[
                o.statValue,
                typeof c.value === "string" &&
                  c.value.length > 9 && { fontSize: wide ? 22 : 16 },
                align,
              ]}
            >
              {c.value ?? 0}
            </Text>
            <Text style={[o.statSub, align]}>{c.sub}</Text>
          </Pressable>
        ))}
      </View>
      <View style={[o.columns, wide && { flexDirection: "row" }]}>
        <View style={[o.panel, wide && { flex: 1.05 }]}>
          <View style={o.panelHead}>
            <View>
              <Text style={[o.panelTitle, align]}>
                {teacher
                  ? t("Vos groupes", "مجموعاتك")
                  : t("Encaissements de la semaine", "تحصيل الأسبوع")}
              </Text>
              <Text style={[o.caption, align]}>
                {teacher
                  ? t("Effectifs et capacité", "الأعداد والسعة")
                  : t(
                      "Les sept derniers jours · nets en DA",
                      "آخر سبعة أيام · الصافي بالدينار",
                    )}
              </Text>
            </View>
            <Text style={o.pill}>7 {t("jours", "أيام")}</Text>
          </View>
          {!teacher ? (
            <>
              <Text style={[o.total, align]}>
                {money(week.reduce((n, x) => n + x.total, 0))}
              </Text>
              <View style={o.chart}>
                {week.map((d, i) => (
                  <View key={d.day} style={o.chartColumn}>
                    <View style={o.chartSpace}>
                      <View
                        style={{
                          height:
                            d.total === 0
                              ? 3
                              : Math.max(8, (Math.abs(d.total) / max) * 105),
                          width: "68%",
                          maxWidth: 40,
                          borderTopLeftRadius: 5,
                          borderTopRightRadius: 5,
                          backgroundColor:
                            d.total < 0
                              ? "#efafbc"
                              : i === 6
                                ? "#627df0"
                                : "#dee6fc",
                        }}
                      />
                    </View>
                    <Text style={o.day}>{d.label}</Text>
                  </View>
                ))}
              </View>
              <Pressable
                accessibilityRole="button"
                style={o.panelLink}
                onPress={() => nav("payments")}
              >
                <Text style={o.link}>
                  {t("Voir les règlements", "عرض الدفعات")} ↗
                </Text>
              </Pressable>
            </>
          ) : (
            data.group_overview?.slice(0, 4).map((g: Row) => (
              <Pressable
                accessibilityRole="button"
                key={g.id}
                style={o.line}
                onPress={() => nav("groups")}
              >
                <Text style={o.groupIcon}>{g.subject.slice(0, 1)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={o.rowTitle}>{g.name}</Text>
                  <Text style={o.caption}>{g.teacher_name}</Text>
                </View>
                <Text style={o.rowAmount}>
                  {g.student_count}/{g.capacity}
                </Text>
              </Pressable>
            ))
          )}
        </View>
        <View style={[o.panel, wide && { flex: 1 }]}>
          <View style={o.panelHead}>
            <View>
              <Text style={[o.panelTitle, align]}>
                {t("Prochaines séances", "الحصص القادمة")}
              </Text>
              <Text style={[o.caption, align]}>
                {t("Votre agenda · heure d’Alger", "جدولك · توقيت الجزائر")}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Planifier", "جدولة")}
              onPress={admin || teacher ? onSession : () => nav("sessions")}
            >
              <Text style={o.add}>＋</Text>
            </Pressable>
          </View>
          {data.upcoming?.length ? (
            data.upcoming.slice(0, 4).map((r: Row, i: number) => (
              <Pressable
                accessibilityRole="button"
                onPress={() => onAttendance(r)}
                style={o.line}
                key={r.id}
              >
                <Text
                  style={[
                    o.agendaIcon,
                    {
                      backgroundColor: ["#eef2ff", "#fff4e8", "#ecf8f3"][i % 3],
                      color: ["#788ce5", "#d0a26d", "#589e87"][i % 3],
                    },
                  ]}
                >
                  {new Date(r.starts_at).getDate()}
                </Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={[o.rowTitle, align]}>
                    {r.group_name}
                  </Text>
                  <Text numberOfLines={1} style={o.caption}>
                    {new Date(r.starts_at).toLocaleDateString(
                      ar ? "ar-DZ" : "fr-DZ",
                      {
                        day: "numeric",
                        month: "short",
                        timeZone: "Africa/Algiers",
                      },
                    )}{" "}
                    · {r.teacher_name}
                  </Text>
                </View>
                <View>
                  <Text style={o.hour}>
                    {new Date(r.starts_at).toLocaleTimeString("fr-DZ", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hourCycle: "h23",
                      timeZone: "Africa/Algiers",
                    })}
                  </Text>
                  <Text style={o.caption}>{r.room}</Text>
                </View>
              </Pressable>
            ))
          ) : (
            <View style={o.empty}>
              <Text style={o.emptyTitle}>
                {t("Planifiez votre prochain cours", "جدول درسك القادم")}
              </Text>
              <Text style={o.caption}>
                {t(
                  "Il apparaîtra ici avec sa salle et son enseignant.",
                  "سيظهر هنا مع القاعة والأستاذ.",
                )}
              </Text>
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            style={o.panelLink}
            onPress={() => nav("sessions")}
          >
            <Text style={o.link}>
              {t("Tout le planning", "الجدول الكامل")} ↗
            </Text>
          </Pressable>
        </View>
      </View>
      <View style={o.shortcuts}>
        {(admin
          ? [
              ["students", "Élèves & familles", "التلاميذ والعائلات", "◉"],
              ["groups", "Groupes de cours", "مجموعات الدروس", "▦"],
              ["invoices", "Échéances", "المستحقات", "▤"],
              ["announcements", "Annonces", "الإعلانات", "↗"],
            ]
          : teacher
            ? [
                ["groups", "Mes groupes", "مجموعاتي", "▦"],
                ["materials", "Documents", "الوثائق", "▤"],
                ["announcements", "Annonces", "الإعلانات", "↗"],
              ]
            : [
                ["students", "Mes enfants", "أبنائي", "◉"],
                ["invoices", "Échéances", "المستحقات", "▤"],
                ["materials", "Documents", "الوثائق", "▦"],
              ]
        ).map(([p, f, a, icon]) => (
          <Pressable
            accessibilityRole="button"
            style={[o.shortcut, { width: wide ? "23.5%" : "48%" }]}
            key={p}
            onPress={() => nav(p)}
          >
            <Text style={o.shortcutIcon}>{icon}</Text>
            <Text style={o.shortcutText}>{t(f, a)}</Text>
            <Text style={o.shortcutArrow}>↗</Text>
          </Pressable>
        ))}
      </View>
      {!teacher && (
        <View style={[o.columns, wide && { flexDirection: "row" }]}>
          <View style={[o.panel, wide && { flex: 1 }]}>
            <View style={o.panelHead}>
              <View>
                <Text style={o.panelTitle}>
                  {t("Échéances à suivre", "مستحقات للمتابعة")}
                </Text>
                <Text style={o.caption}>
                  {data.overdue ?? 0}{" "}
                  {t("échéances en retard", "مستحقات متأخرة")}
                </Text>
              </View>
              <Text style={o.balance}>{money(data.due_centimes)}</Text>
            </View>
            {data.outstanding?.slice(0, 4).map((r: Row, i: number) => (
              <Pressable
                accessibilityRole="button"
                key={r.id}
                style={o.line}
                onPress={() => nav("invoices")}
              >
                <Text style={o.person}>
                  {r.student_name
                    .split(" ")
                    .slice(0, 2)
                    .map((n: string) => n[0])
                    .join("")}
                </Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={o.rowTitle}>
                    {r.student_name}
                  </Text>
                  <Text numberOfLines={1} style={o.caption}>
                    {r.group_name}
                  </Text>
                </View>
                <Text style={o.dueAmount}>{money(r.balance_centimes)}</Text>
              </Pressable>
            ))}
            {!data.outstanding?.length && (
              <Text style={o.caption}>
                {t("Tout est à jour.", "كل شيء محدث.")}
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              style={o.panelLink}
              onPress={() => nav("invoices")}
            >
              <Text style={o.link}>
                {t("Toutes les échéances", "كل المستحقات")} ↗
              </Text>
            </Pressable>
          </View>
          <View style={[o.panel, wide && { flex: 1 }]}>
            <View style={o.panelHead}>
              <View>
                <Text style={o.panelTitle}>
                  {t("Derniers règlements", "آخر الدفعات")}
                </Text>
                <Text style={o.caption}>
                  {t("Chaque mouvement, avec son reçu", "كل حركة مع إيصالها")}
                </Text>
              </View>
              <Text style={o.add}>↗</Text>
            </View>
            {data.recent_payments?.slice(0, 4).map((r: Row) => (
              <Pressable
                accessibilityRole="button"
                key={r.id}
                style={o.line}
                onPress={() => nav("payments")}
              >
                <Text style={o.paymentIcon}>✓</Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={o.rowTitle}>
                    {r.student_name}
                  </Text>
                  <Text style={o.caption}>
                    #{r.receipt_number} ·{" "}
                    {r.method === "ccp"
                      ? "CCP"
                      : r.method === "cash"
                        ? t("Espèces", "نقد")
                        : t("Virement / carte", "تحويل / بطاقة")}
                  </Text>
                </View>
                <Text
                  style={[
                    o.paidAmount,
                    r.kind === "refund" && { color: "#cc657e" },
                  ]}
                >
                  {r.kind === "refund" ? "−" : "+"}
                  {money(r.amount_centimes)}
                </Text>
              </Pressable>
            ))}
            {!data.recent_payments?.length && (
              <Text style={o.caption}>
                {t("Aucun règlement enregistré.", "لا توجد دفعات مسجلة.")}
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              style={o.panelLink}
              onPress={() => nav("payments")}
            >
              <Text style={o.link}>
                {t("Tous les règlements", "كل الدفعات")} ↗
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
const o = StyleSheet.create({
  demo: { flexDirection: "row", alignItems: "center", gap: 7 },
  demoDot: { height: 6, width: 6, borderRadius: 6, backgroundColor: "#5aaf9b" },
  demoText: { fontSize: 10, color: "#7f9aab", letterSpacing: 0.5 },
  hero: {
    backgroundColor: "#4866e8",
    padding: 24,
    borderRadius: 16,
    overflow: "hidden",
  },
  heroCircle: {
    position: "absolute",
    height: 210,
    width: 210,
    right: -70,
    top: -70,
    borderWidth: 26,
    borderColor: "#ffffff0c",
    borderRadius: 120,
  },
  kicker: { fontSize: 9, letterSpacing: 1.5, color: "#c7d3ff" },
  heroTitle: {
    fontSize: 24,
    lineHeight: 33,
    fontWeight: "700",
    color: "#fff",
    marginVertical: 10,
  },
  heroSub: { color: "#d6dfff", fontSize: 11, lineHeight: 18, marginBottom: 19 },
  heroActions: { flexDirection: "row", gap: 9, flexWrap: "wrap" },
  heroButton: {
    backgroundColor: "#fff",
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  heroButtonText: { color: "#4b64d8", fontSize: 11, fontWeight: "600" },
  heroSecondary: {
    backgroundColor: "#ffffff16",
    borderWidth: 1,
    borderColor: "#ffffff22",
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  heroSecondaryText: { color: "#e9edff", fontSize: 11 },
  stats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },
  stat: {
    backgroundColor: "#fff",
    padding: 16,
    borderWidth: 1,
    borderColor: "#e7edf5",
    borderRadius: 13,
  },
  statHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  statLabel: { fontSize: 10, color: "#8b96a9", flex: 1 },
  statSymbol: {
    fontSize: 19,
    height: 29,
    width: 29,
    lineHeight: 28,
    textAlign: "center",
    overflow: "hidden",
    borderRadius: 8,
  },
  statValue: {
    fontSize: 25,
    fontWeight: "600",
    color: "#2f405f",
    marginVertical: 12,
  },
  statSub: { fontSize: 9, color: "#a4afbf" },
  columns: { gap: 18 },
  panel: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e7edf5",
    minWidth: 0,
  },
  panelHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  panelTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#314562",
    marginBottom: 5,
  },
  caption: { fontSize: 10, lineHeight: 16, color: "#9aa7ba" },
  pill: {
    fontSize: 9,
    padding: 6,
    borderRadius: 5,
    color: "#8799b3",
    backgroundColor: "#f4f7fc",
  },
  total: {
    fontSize: 25,
    fontWeight: "600",
    color: "#2f4262",
    marginVertical: 4,
  },
  chart: {
    height: 151,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 9,
    borderBottomWidth: 1,
    borderColor: "#eff2f8",
  },
  chartColumn: { flex: 1, alignItems: "center" },
  chartSpace: {
    height: 120,
    width: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  day: { fontSize: 9, color: "#9cabc0", paddingVertical: 8 },
  panelLink: { paddingTop: 17, alignItems: "center" },
  link: { fontSize: 11, color: "#6982e5" },
  line: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 13,
    borderTopWidth: 1,
    borderColor: "#f0f3f8",
  },
  groupIcon: {
    height: 33,
    width: 33,
    lineHeight: 32,
    textAlign: "center",
    backgroundColor: "#eef2ff",
    color: "#7d91e5",
    overflow: "hidden",
    borderRadius: 8,
  },
  rowTitle: {
    fontSize: 12,
    fontWeight: "500",
    color: "#546a8b",
    marginBottom: 4,
  },
  rowAmount: { fontSize: 12, color: "#8597b3" },
  agendaIcon: {
    height: 36,
    width: 36,
    lineHeight: 35,
    textAlign: "center",
    overflow: "hidden",
    borderRadius: 9,
    fontSize: 16,
    fontWeight: "600",
  },
  hour: {
    fontSize: 12,
    fontWeight: "500",
    color: "#647c9f",
    textAlign: "right",
  },
  add: {
    width: 29,
    height: 29,
    lineHeight: 28,
    textAlign: "center",
    overflow: "hidden",
    borderRadius: 7,
    color: "#7790e9",
    backgroundColor: "#f0f4ff",
    fontSize: 20,
  },
  empty: { paddingVertical: 25, gap: 8, alignItems: "center" },
  emptyTitle: { fontSize: 12, color: "#8599b5" },
  shortcuts: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  shortcut: {
    backgroundColor: "#fff",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: "#e7edf5",
    borderRadius: 10,
  },
  shortcutIcon: { fontSize: 17, color: "#758de6" },
  shortcutText: { flex: 1, fontSize: 11, color: "#6d81a1" },
  shortcutArrow: { fontSize: 14, color: "#a1b0c8" },
  balance: { fontSize: 12, fontWeight: "600", color: "#bb9666" },
  person: {
    width: 33,
    height: 33,
    lineHeight: 32,
    textAlign: "center",
    fontSize: 10,
    backgroundColor: "#f3effb",
    color: "#a891c3",
    borderRadius: 20,
    overflow: "hidden",
  },
  dueAmount: { fontSize: 11, color: "#c09b69" },
  paidAmount: { fontSize: 11, color: "#5aa58d" },
  paymentIcon: {
    width: 32,
    height: 32,
    lineHeight: 31,
    textAlign: "center",
    borderRadius: 8,
    overflow: "hidden",
    fontSize: 15,
    color: "#70ac98",
    backgroundColor: "#eef8f3",
  },
});
