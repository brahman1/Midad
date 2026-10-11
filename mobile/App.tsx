import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  RefreshControl,
  Linking,
  Platform,
  Share,
  KeyboardAvoidingView,
  AppState,
  useWindowDimensions,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { User, adminRoles, financeRoles, dinars, labels } from "@midad/shared";
import { api, raw, restore, setSession, WEBSITE, centimes } from "./api";
import MobileOverview from "./Overview";
type Row = Record<string, any>;
type Field = {
  key: string;
  label: string;
  value?: string;
  secure?: boolean;
  multiline?: boolean;
  numeric?: boolean;
  options?: { value: string; label: string }[];
  optional?: boolean;
};
type Editor = {
  title: string;
  fields: Field[];
  save: (values: Record<string, string>) => Promise<unknown>;
};
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
const status: Record<string, [string, string]> = {
  scheduled: ["Prévue", "مبرمجة"],
  completed: ["Terminée", "مكتملة"],
  cancelled: ["Annulée", "ملغاة"],
  present: ["Présent", "حاضر"],
  absent: ["Absent", "غائب"],
  late: ["Retard", "متأخر"],
  unmarked: ["Non renseigné", "غير مسجل"],
  payment: ["Versement", "دفع"],
  refund: ["Remboursement", "استرداد"],
  cash: ["Espèces", "نقد"],
  ccp: ["CCP", "حساب بريدي"],
  bank_transfer: ["Virement", "تحويل"],
  card_external: ["Carte externe", "بطاقة خارجية"],
  pending: ["En attente", "قيد الانتظار"],
  accepted: ["Accepté", "مقبول"],
  rejected: ["Refusé", "مرفوض"],
};
const day = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Algiers" });
const month = () => day().slice(0, 7);
const key = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
export default function App() {
  return (
    <SafeAreaProvider>
      <Midad />
    </SafeAreaProvider>
  );
}
function Midad() {
  const { width } = useWindowDimensions();
  const wide = width >= 1000;
  const [user, setUser] = useState<User | null>(null),
    [ar, setAr] = useState(false),
    [boot, setBoot] = useState(true),
    [page, setPage] = useState("dashboard"),
    [rows, setRows] = useState<Row[]>([]),
    [home, setHome] = useState<Row>({}),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [editor, setEditor] = useState<Editor | null>(null),
    [detail, setDetail] = useState<{
      kind: string;
      row: Row;
      rows: Row[];
    } | null>(null),
    [menu, setMenu] = useState(false),
    [search, setSearch] = useState(""),
    [cash, setCash] = useState<Row | null>(null),
    [lookup, setLookup] = useState<{
      students: Row[];
      groups: Row[];
      users: Row[];
    }>({ students: [], groups: [], users: [] });
  const t = (f: string, a: string) => (ar ? a : f),
    tr = (v: string) => status[v]?.[ar ? 1 : 0] ?? v,
    money = (v: number) => dinars(v ?? 0, ar ? "ar" : "fr"),
    date = (v: string) =>
      new Date(v).toLocaleString(ar ? "ar-DZ" : "fr-DZ", {
        timeZone: "Africa/Algiers",
        dateStyle: "medium",
        timeStyle: "short",
        hourCycle: "h23",
      });
  const admin = !!user && adminRoles.includes(user.role),
    finance = !!user && financeRoles.includes(user.role),
    teacher = user?.role === "TEACHER",
    teach = admin || teacher,
    family = user?.role === "PARENT" || user?.role === "STUDENT";
  useEffect(() => {
    restore()
      .then(async (s) => {
        if (s) {
          try {
            const u = await api("auth/me");
            setUser(u);
            setAr(u.locale === "ar");
          } catch (e) {
            setError((e as Error).message);
          }
        }
      })
      .finally(() => setBoot(false));
  }, []);
  async function load() {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      if (page === "account") {
        setLoading(false);
        return;
      }
      const r = await api(
        page === "payroll" ? `payroll?month=${month()}` : page,
      );
      page === "dashboard" ? setHome(r) : setRows(r);
      if (page === "payments" && finance) setCash(await api("cash"));
      if (teach || finance) {
        const [students, groups, users] = await Promise.all([
          api("students"),
          api("groups"),
          admin ? api("users") : Promise.resolve([]),
        ]);
        setLookup({ students, groups, users });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [user, page]);
  useEffect(() => {
    const listener = Notifications.addNotificationResponseReceivedListener(
      () => {
        setPage("notifications");
      },
    );
    const active = AppState.addEventListener("change", (s) => {
      if (s === "active" && user) void load();
    });
    return () => {
      listener.remove();
      active.remove();
    };
  }, [user, page]);
  async function action(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      setMessage(t("Enregistré", "تم الحفظ"));
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function nav(p: string) {
    setPage(p);
    setRows([]);
    setSearch("");
    setMenu(false);
    setDetail(null);
    setMessage("");
  }
  const options = (r: Row[]) => r.map((x) => ({ value: x.id, label: x.name }));
  const field = (
    key: string,
    f: string,
    a: string,
    value?: string,
    extra: Partial<Field> = {},
  ): Field => ({ key, label: t(f, a), value, ...extra });
  const choose = (
    key: string,
    f: string,
    a: string,
    list: Row[],
    v?: string,
    optional = false,
  ) => field(key, f, a, v, { options: options(list), optional });
  const form = (title: string, fields: Field[], save: Editor["save"]) =>
    setEditor({ title, fields, save });
  function studentForm(r: Row = {}) {
    form(
      t("Dossier élève", "ملف التلميذ"),
      [
        field("name", "Nom complet", "الاسم الكامل", r.name),
        field("level", "Niveau", "المستوى", r.level, { optional: true }),
        field("phone", "Téléphone", "الهاتف", r.phone, { optional: true }),
        field(
          "birth_date",
          "Naissance AAAA-MM-JJ",
          "الميلاد YYYY-MM-DD",
          r.birth_date,
          { optional: true },
        ),
        choose(
          "parent_id",
          "Compte parent",
          "حساب الولي",
          lookup.users.filter((x) => x.role === "PARENT" && x.active),
          r.parent_id,
          true,
        ),
        choose(
          "user_id",
          "Compte élève",
          "حساب التلميذ",
          lookup.users.filter((x) => x.role === "STUDENT" && x.active),
          r.user_id,
          true,
        ),
      ],
      (v) =>
        api(r.id ? `students/${r.id}` : "students", r.id ? "PATCH" : "POST", {
          ...v,
          parent_id: v.parent_id || null,
          user_id: v.user_id || null,
          birth_date: v.birth_date || null,
        }),
    );
  }
  function groupForm(r: Row = {}) {
    form(
      t("Groupe de cours", "مجموعة دروس"),
      [
        field("name", "Nom", "الاسم", r.name),
        field("subject", "Matière", "المادة", r.subject),
        field("level", "Niveau", "المستوى", r.level, { optional: true }),
        choose(
          "teacher_id",
          "Enseignant",
          "الأستاذ",
          lookup.users.filter((x) => x.role === "TEACHER" && x.active),
          r.teacher_id,
          true,
        ),
        field("room", "Salle", "القاعة", r.room, { optional: true }),
        field("capacity", "Capacité", "السعة", String(r.capacity ?? 20), {
          numeric: true,
        }),
        field(
          "fee",
          "Tarif mensuel DA",
          "التعريفة الشهرية دج",
          String((r.fee_centimes ?? 0) / 100),
          { numeric: true },
        ),
        field("pay_mode", "Rémunération", "الأجر", r.pay_mode ?? "session", {
          options: [
            { value: "session", label: t("Par séance", "لكل حصة") },
            { value: "hour", label: t("Par heure", "لكل ساعة") },
            {
              value: "percent",
              label: t("% des encaissements", "نسبة التحصيل"),
            },
          ],
        }),
        field(
          "pay_value",
          "Montant DA ou %",
          "المبلغ دج أو النسبة",
          String((r.pay_value ?? 0) / 100),
          { numeric: true },
        ),
      ],
      (v) =>
        api(r.id ? `groups/${r.id}` : "groups", r.id ? "PATCH" : "POST", {
          name: v.name,
          subject: v.subject,
          level: v.level,
          room: v.room,
          teacher_id: v.teacher_id || null,
          capacity: Number(v.capacity),
          fee_centimes: centimes(v.fee),
          pay_mode: v.pay_mode,
          pay_value: centimes(v.pay_value),
        }),
    );
  }
  function sessionForm(r: Row = {}) {
    const local = (v: string) =>
      new Date(v)
        .toLocaleString("sv-SE", { timeZone: "Africa/Algiers" })
        .slice(0, 16);
    form(
      t("Planifier une séance", "جدولة حصة"),
      [
        choose("group_id", "Groupe", "المجموعة", lookup.groups, r.group_id),
        field(
          "start",
          "Début AAAA-MM-JJ HH:MM (Alger)",
          "البداية YYYY-MM-DD HH:MM (الجزائر)",
          r.starts_at ? local(r.starts_at) : `${day()} 09:00`,
        ),
        field(
          "end",
          "Fin AAAA-MM-JJ HH:MM (Alger)",
          "النهاية YYYY-MM-DD HH:MM (الجزائر)",
          r.ends_at ? local(r.ends_at) : `${day()} 10:00`,
        ),
        field("room", "Salle", "القاعة", r.room, { optional: true }),
        field("notes", "Notes", "ملاحظات", r.notes, {
          optional: true,
          multiline: true,
        }),
      ],
      (v) => {
        const iso = (s: string) => {
          if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s))
            throw new Error(
              t("Format de date invalide", "تنسيق تاريخ غير صحيح"),
            );
          return new Date(`${s.replace(" ", "T")}:00+01:00`).toISOString();
        };
        return api(
          r.id ? `sessions/${r.id}` : "sessions",
          r.id ? "PATCH" : "POST",
          {
            group_id: v.group_id,
            starts_at: iso(v.start),
            ends_at: iso(v.end),
            room: v.room,
            notes: v.notes,
          },
        );
      },
    );
  }
  function invoiceForm() {
    form(
      t("Nouvelle échéance", "مستحق جديد"),
      [
        choose("student_id", "Élève", "التلميذ", lookup.students),
        choose(
          "group_id",
          "Groupe facultatif",
          "المجموعة اختياري",
          lookup.groups,
          undefined,
          true,
        ),
        field("label", "Libellé", "الوصف"),
        field("amount", "Montant DA", "المبلغ دج", undefined, {
          numeric: true,
        }),
        field(
          "due_date",
          "Date limite AAAA-MM-JJ",
          "تاريخ الاستحقاق YYYY-MM-DD",
          day(),
        ),
      ],
      (v) =>
        api("invoices", "POST", {
          student_id: v.student_id,
          group_id: v.group_id || null,
          label: v.label,
          amount_centimes: centimes(v.amount),
          due_date: v.due_date,
        }),
    );
  }
  function paymentForm(r: Row) {
    const id = key();
    form(
      t("Encaisser un versement", "تحصيل دفع"),
      [
        field(
          "amount",
          `Montant DA · solde ${r.balance_centimes / 100}`,
          `المبلغ دج · الرصيد ${r.balance_centimes / 100}`,
          String(r.balance_centimes / 100),
          { numeric: true },
        ),
        field("method", "Mode", "الوسيلة", "cash", {
          options: ["cash", "ccp", "bank_transfer", "card_external"].map(
            (value) => ({ value, label: tr(value) }),
          ),
        }),
        field(
          "reference",
          "Référence hors espèces",
          "المرجع لغير النقد",
          undefined,
          { optional: true },
        ),
      ],
      (v) =>
        api(
          "payments",
          "POST",
          {
            invoice_id: r.id,
            amount_centimes: centimes(v.amount),
            method: v.method,
            reference: v.reference,
          },
          id,
        ),
    );
  }
  function refundForm(r: Row) {
    const id = key();
    form(
      t("Rembourser le versement", "استرداد الدفع"),
      [
        field(
          "amount",
          "Montant DA",
          "المبلغ دج",
          String(r.amount_centimes / 100),
          { numeric: true },
        ),
        field("reference", "Motif / référence", "السبب / المرجع"),
      ],
      (v) =>
        api(
          "refunds",
          "POST",
          {
            payment_id: r.id,
            amount_centimes: centimes(v.amount),
            reference: v.reference,
          },
          id,
        ),
    );
  }
  async function attendance(r: Row) {
    try {
      setDetail({
        kind: "attendance",
        row: r,
        rows: await api(`sessions/${r.id}/attendance`),
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function roster(r: Row) {
    try {
      setDetail({
        kind: "roster",
        row: r,
        rows: await api(`groups/${r.id}/students`),
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function download(r: Row) {
    await action(async () => {
      const response = await raw(`materials/${r.id}`);
      if (!response.ok)
        throw new Error(t("Document indisponible", "الوثيقة غير متاحة"));
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (Platform.OS === "web") {
        const url = URL.createObjectURL(new Blob([bytes], { type: r.mime }));
        const a = document.createElement("a");
        a.href = url;
        a.download = r.filename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const safe = r.filename.replace(/[^\p{L}\p{N}._-]/gu, "_");
        const file = new File(Paths.cache, `${Date.now()}-${safe}`);
        file.create();
        file.write(bytes);
        if (await Sharing.isAvailableAsync())
          await Sharing.shareAsync(file.uri, { mimeType: r.mime });
        else
          throw new Error(
            t(
              "Le partage est indisponible sur cet appareil",
              "المشاركة غير متاحة على الجهاز",
            ),
          );
        file.delete();
      }
    });
  }
  function documentForm() {
    form(
      t("Partager un document", "مشاركة وثيقة"),
      [
        choose("group_id", "Groupe", "المجموعة", lookup.groups),
        field("title", "Titre", "العنوان"),
      ],
      async (v) => {
        const result = await DocumentPicker.getDocumentAsync({
          type: ["application/pdf", "image/png", "image/jpeg", "text/plain"],
          copyToCacheDirectory: true,
        });
        if (result.canceled)
          throw new Error(t("Sélection annulée", "تم إلغاء الاختيار"));
        const asset = result.assets[0];
        const file = new File(asset.uri);
        if ((file.size ?? 0) > 5_000_000)
          throw new Error(t("Maximum 5 Mo", "5 ميغابايت كحد أقصى"));
        const base64 = await file.base64();
        return api("materials", "POST", {
          group_id: v.group_id,
          title: v.title,
          filename: asset.name,
          mime: asset.mimeType ?? "text/plain",
          base64,
        });
      },
    );
  }
  function invite() {
    form(
      t("Inviter un utilisateur", "دعوة مستخدم"),
      [
        field("name", "Nom", "الاسم"),
        field("email", "Email", "البريد"),
        field("role", "Rôle", "الدور", "TEACHER", {
          options: (user?.role === "OWNER"
            ? ["MANAGER", "CASHIER", "TEACHER", "PARENT", "STUDENT"]
            : ["CASHIER", "TEACHER", "PARENT", "STUDENT"]
          ).map((value) => ({ value, label: value })),
        }),
      ],
      (v) => api("auth/invite", "POST", { ...v, locale: ar ? "ar" : "fr" }),
    );
  }
  async function pushes() {
    await action(async () => {
      if (Platform.OS === "web" || !Device.isDevice)
        throw new Error(
          t("Un téléphone physique est nécessaire", "يلزم هاتف فعلي"),
        );
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId;
      if (!projectId)
        throw new Error(
          t(
            "Les notifications push seront disponibles après la configuration du service mobile. Votre boîte de notifications fonctionne déjà.",
            "تتوفر التنبيهات بعد إعداد خدمة الهاتف. صندوق الإشعارات يعمل الآن.",
          ),
        );
      if (Platform.OS === "android")
        await Notifications.setNotificationChannelAsync("default", {
          name: "Midad",
          importance: Notifications.AndroidImportance.HIGH,
        });
      let permission = await Notifications.getPermissionsAsync();
      if (permission.status !== "granted")
        permission = await Notifications.requestPermissionsAsync();
      if (permission.status !== "granted")
        throw new Error(
          t(
            "Permission refusée. Vos messages restent accessibles ici.",
            "تم رفض الإذن. رسائلك متاحة هنا.",
          ),
        );
      const token = (await Notifications.getExpoPushTokenAsync({ projectId }))
        .data;
      await api("devices", "POST", { token });
      const storage = await import("expo-secure-store");
      await storage.setItemAsync("midad_push", token);
    });
  }
  async function logout() {
    await action(async () => {
      if (Platform.OS !== "web") {
        const storage = await import("expo-secure-store");
        const token = await storage.getItemAsync("midad_push");
        if (token) {
          await api("devices", "DELETE", { token });
          await storage.deleteItemAsync("midad_push");
        }
      }
      await api("auth/logout", "POST", {});
      await setSession("");
      setUser(null);
      setRows([]);
      setPage("dashboard");
    });
  }
  const menus = Object.keys(labels).filter(
    (p) =>
      p !== "settings" &&
      !(p === "users" && !admin) &&
      !(p === "audit" && !admin) &&
      !(["invoices", "payments"].includes(p) && !finance && !family) &&
      !(p === "payroll" && !finance && !teacher),
  );
  const shown = rows.filter((r) =>
    Object.values(r).some(
      (v) =>
        typeof v === "string" && v.toLowerCase().includes(search.toLowerCase()),
    ),
  );
  const rtl = ar
    ? { writingDirection: "rtl" as const, textAlign: "right" as const }
    : {};
  const button = (label: string, onPress: () => void, secondary = false) => (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={onPress}
      style={[s.button, secondary && s.secondary, busy && s.disabled]}
    >
      <Text style={[s.buttonText, secondary && s.secondaryText]}>{label}</Text>
    </Pressable>
  );
  if (boot)
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <Text style={s.mark}>م</Text>
          <ActivityIndicator color="#285238" />
        </View>
      </SafeAreaView>
    );
  if (!user)
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={s.login}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable
              onPress={() => setAr(!ar)}
              style={{ alignSelf: "flex-end" }}
            >
              <Text style={s.link}>{ar ? "Français" : "العربية"}</Text>
            </Pressable>
            <Text style={s.mark}>م</Text>
            <Text style={s.brand}>Midad · مداد</Text>
            <Text style={[s.hero, rtl]}>
              {t("Retrouvez votre centre.", "عد إلى مركزك.")}
            </Text>
            <Text style={[s.muted, rtl]}>
              {t(
                "Un espace pour les cours, les familles et toute votre équipe.",
                "مساحة للدروس والعائلات وفريقك.",
              )}
            </Text>
            {error && (
              <Text accessibilityRole="alert" style={s.error}>
                {error}
              </Text>
            )}
            <Login
              ar={ar}
              busy={busy}
              submit={(v) =>
                void action(async () => {
                  const r = await api("auth/login", "POST", v);
                  await setSession(r.token);
                  const u = await api("auth/me");
                  setUser(u);
                  setAr(u.locale === "ar");
                })
              }
            />
            {button(
              t("Mot de passe oublié", "نسيت كلمة المرور"),
              () =>
                form(
                  t("Récupérer mon accès", "استعادة الوصول"),
                  [
                    field("slug", "Identifiant du centre", "معرف المركز"),
                    field("email", "Email", "البريد"),
                  ],
                  async (v) => {
                    await api("auth/forgot", "POST", v);
                    setMessage(
                      t(
                        "Si le compte existe, un email a été envoyé.",
                        "إذا كان الحساب موجودًا، تم إرسال بريد.",
                      ),
                    );
                  },
                ),
              true,
            )}
            {message && <Text style={s.success}>{message}</Text>}
            <Pressable
              onPress={() =>
                void Linking.openURL(`${WEBSITE}/auth?mode=register`)
              }
            >
              <Text style={[s.link, { textAlign: "center", marginTop: 20 }]}>
                {t(
                  "Créer un établissement sur le site",
                  "إنشاء مؤسسة على الموقع",
                )}
              </Text>
            </Pressable>
            <Pressable onPress={() => void Linking.openURL(`${WEBSITE}/legal`)}>
              <Text style={[s.small, { textAlign: "center", marginTop: 25 }]}>
                {t("Confidentialité & conditions", "الخصوصية والشروط")}
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
        {editor && (
          <EditorModal
            editor={editor}
            ar={ar}
            close={() => setEditor(null)}
            save={async (v) => {
              await editor.save(v);
              setEditor(null);
            }}
          />
        )}
      </SafeAreaView>
    );
  return (
    <SafeAreaView
      style={[s.safe, wide && { flexDirection: ar ? "row-reverse" : "row" }]}
    >
      <StatusBar style="dark" />
      {wide && (
        <View style={r.sidebar}>
          <View style={r.sideBrand}>
            <Text style={r.sideMark}>م</Text>
            <Text style={r.sideBrandText}>
              Midad <Text style={r.sideArabic}>مداد</Text>
            </Text>
          </View>
          <Text style={r.sideSchool}>{user.school}</Text>
          <Text style={r.sideCaption}>
            {t("VOTRE ÉTABLISSEMENT", "مؤسستك")}
          </Text>
          <ScrollView style={{ flex: 1 }}>
            {menus.map((p) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: page === p }}
                key={p}
                onPress={() => nav(p)}
                style={[r.sideItem, page === p && r.sideActive]}
              >
                <Text style={[r.sideItemIcon, page === p && r.sideActiveText]}>
                  {p === "dashboard"
                    ? "▦"
                    : p === "sessions"
                      ? "◷"
                      : p === "students"
                        ? "◉"
                        : p === "payments"
                          ? "↗"
                          : "▤"}
                </Text>
                <Text style={[r.sideItemText, page === p && r.sideActiveText]}>
                  {labels[p][ar ? "ar" : "fr"]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            style={r.sideProfile}
            onPress={() => nav("account")}
          >
            <Text style={r.sideAvatar}>{user.name.slice(0, 1)}</Text>
            <View>
              <Text style={r.sideName}>{user.name}</Text>
              <Text style={r.sideRole}>{t("Mon compte", "حسابي")}</Text>
            </View>
            <Text style={r.sideChevron}>›</Text>
          </Pressable>
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={s.top}>
          <View>
            <Text style={s.topBrand}>
              Midad <Text style={s.topArabic}>مداد</Text>
            </Text>
            <Text numberOfLines={1} style={s.small}>
              {user.school}
            </Text>
          </View>
          <View style={s.inline}>
            <Pressable onPress={() => setAr(!ar)}>
              <Text style={s.link}>{ar ? "FR" : "ع"}</Text>
            </Pressable>
            {wide ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => nav("account")}
              >
                <Text style={r.headerAvatar}>{user.name.slice(0, 1)}</Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Menu", "القائمة")}
                onPress={() => setMenu(true)}
              >
                <Text style={s.menuIcon}>☰</Text>
              </Pressable>
            )}
          </View>
        </View>
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => void load()}
              tintColor="#345b3d"
            />
          }
          contentContainerStyle={[
            s.content,
            wide && { maxWidth: 1400, padding: 28 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[s.small, rtl]}>
            {day()} · {user.name}
          </Text>
          <Text style={[s.title, rtl]}>
            {page === "account"
              ? t("Mon compte", "حسابي")
              : page === "dashboard"
                ? t("Tableau de bord", "لوحة التحكم")
                : labels[page][ar ? "ar" : "fr"]}
          </Text>
          {!user.verified && (
            <View style={s.warning}>
              <Text style={s.text}>
                {t(
                  "Vérifiez votre email pour modifier les données.",
                  "أكد بريدك لتعديل البيانات.",
                )}
              </Text>
              {button(
                t("Renvoyer le lien", "إعادة إرسال الرابط"),
                () => void action(() => api("auth/resend", "POST", {})),
                true,
              )}
              {button(
                t("J’ai vérifié mon email", "أكدت بريدي"),
                () => void action(async () => setUser(await api("auth/me"))),
                true,
              )}
            </View>
          )}
          {error && (
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          )}
          {message && (
            <Pressable onPress={() => setMessage("")}>
              <Text style={s.success}>{message} ×</Text>
            </Pressable>
          )}
          {page === "dashboard" && (
            <MobileOverview
              data={home}
              user={user}
              ar={ar}
              wide={wide}
              nav={nav}
              onStudent={() => studentForm()}
              onSession={() => sessionForm()}
              onAttendance={(r) => void attendance(r)}
            />
          )}
          {page !== "dashboard" && page !== "account" && (
            <TextInput
              style={s.input}
              placeholder={t("Rechercher…", "بحث…")}
              value={search}
              onChangeText={setSearch}
              accessibilityLabel={t("Rechercher", "بحث")}
            />
          )}
          {page === "students" &&
            admin &&
            button(t("+ Nouvel élève", "+ تلميذ جديد"), () => studentForm())}
          {page === "groups" &&
            admin &&
            button(t("+ Nouveau groupe", "+ مجموعة جديدة"), () => groupForm())}
          {page === "sessions" &&
            teach &&
            button(t("+ Planifier une séance", "+ جدولة حصة"), () =>
              sessionForm(),
            )}
          {page === "invoices" && finance && (
            <>
              {button(t("+ Nouvelle échéance", "+ مستحق جديد"), invoiceForm)}
              {button(
                t("Facturation mensuelle", "الفوترة الشهرية"),
                () =>
                  form(
                    t("Facturer un groupe", "فوترة مجموعة"),
                    [
                      choose("group_id", "Groupe", "المجموعة", lookup.groups),
                      field("month", "Mois AAAA-MM", "الشهر YYYY-MM", month()),
                      field(
                        "due_date",
                        "Date limite AAAA-MM-JJ",
                        "الاستحقاق YYYY-MM-DD",
                        day(),
                      ),
                    ],
                    (v) => api("invoices/generate", "POST", v),
                  ),
                true,
              )}
            </>
          )}
          {page === "users" &&
            admin &&
            button(t("+ Inviter", "+ دعوة"), invite)}
          {page === "materials" &&
            teach &&
            button(t("+ Document", "+ وثيقة"), documentForm)}
          {page === "announcements" &&
            teach &&
            button(t("+ Annonce", "+ إعلان"), () =>
              form(
                t("Publier une annonce", "نشر إعلان"),
                [
                  choose(
                    "group_id",
                    "Groupe (vide = centre)",
                    "المجموعة (فارغة = المركز)",
                    lookup.groups,
                    undefined,
                    !teacher,
                  ),
                  field("title", "Titre", "العنوان"),
                  field("body", "Message", "الرسالة", undefined, {
                    multiline: true,
                  }),
                ],
                (v) =>
                  api("announcements", "POST", {
                    ...v,
                    group_id: v.group_id || null,
                  }),
              ),
            )}
          {page === "notifications" &&
            button(
              t("Tout marquer comme lu", "تحديد الكل كمقروء"),
              () => void action(() => api("notifications/read", "POST", {})),
              true,
            )}
          {page === "payments" && finance && cash && (
            <View style={s.featureCard}>
              <Text style={s.cardTitle}>
                {t("Caisse du jour", "صندوق اليوم")}
              </Text>
              <Text style={s.metricNumber}>
                {money(cash.expected_centimes)}
              </Text>
              <Text style={s.small}>
                {t("Fond initial", "الرصيد الافتتاحي")}:{" "}
                {money(cash.opening_centimes)} ·{" "}
                {t("Mouvements nets", "صافي الحركات")}:{" "}
                {money(cash.net_centimes)}
              </Text>
              <Text style={s.small}>
                {t("Mouvements nets en espèces", "صافي الحركات النقدية")} ·{" "}
                {cash.day}
              </Text>
              {!cash.closure &&
                !cash.opened &&
                button(
                  t("Fond de caisse initial", "الرصيد الافتتاحي"),
                  () =>
                    form(
                      t("Fond initial", "الرصيد الافتتاحي"),
                      [
                        field(
                          "amount",
                          "Montant initial DA",
                          "الرصيد الافتتاحي دج",
                          "0",
                          { numeric: true },
                        ),
                      ],
                      (v) =>
                        api("cash/open", "POST", {
                          amount_centimes: centimes(v.amount),
                        }),
                    ),
                  true,
                )}
              {cash.closure ? (
                <Text style={s.muted}>
                  {t("Clôturée", "مغلق")} · {t("écart", "الفرق")}{" "}
                  {money(
                    cash.closure.counted_centimes -
                      cash.closure.expected_centimes,
                  )}
                </Text>
              ) : (
                button(
                  t("Clôturer la caisse", "إغلاق الصندوق"),
                  () =>
                    form(
                      t("Clôture du jour", "إغلاق اليوم"),
                      [
                        field(
                          "counted",
                          "Espèces dans le tiroir DA",
                          "النقد الموجود في الصندوق دج",
                          String(cash.expected_centimes / 100),
                          { numeric: true },
                        ),
                        field(
                          "notes",
                          "Notes / écart",
                          "ملاحظات / الفرق",
                          undefined,
                          { optional: true, multiline: true },
                        ),
                      ],
                      (v) =>
                        api("cash/close", "POST", {
                          day: cash.day,
                          counted_centimes: centimes(v.counted),
                          notes: v.notes,
                        }),
                    ),
                  true,
                )
              )}
            </View>
          )}
          {page === "payroll" && (
            <Text style={s.muted}>
              {t("Rémunérations pour", "الأجور لشهر")} {month()}
            </Text>
          )}
          {page !== "dashboard" &&
            page !== "account" &&
            shown.map((r) => (
              <View
                style={[
                  s.card,
                  page === "notifications" && !r.seen && s.unread,
                ]}
                key={r.id}
              >
                {page === "students" && (
                  <>
                    <Text style={[s.cardTitle, rtl]}>{r.name}</Text>
                    <Text style={[s.muted, rtl]}>
                      {r.level || "—"} · {r.phone || "—"}
                    </Text>
                    <Text style={[s.small, rtl]}>
                      {r.parent_name ||
                        t(
                          "Aucun compte parent associé",
                          "لا يوجد حساب ولي مرتبط",
                        )}
                    </Text>
                    {admin &&
                      button(
                        t("Modifier", "تعديل"),
                        () => studentForm(r),
                        true,
                      )}
                  </>
                )}
                {page === "groups" && (
                  <>
                    <Text style={[s.cardTitle, rtl]}>{r.name}</Text>
                    <Text style={[s.muted, rtl]}>
                      {r.subject} · {r.teacher_name || "—"}
                    </Text>
                    <Text style={[s.text, rtl]}>
                      {r.student_count}/{r.capacity} · {r.room} ·{" "}
                      {money(r.fee_centimes)}
                    </Text>
                    {button(
                      t("Voir les inscrits", "عرض المسجلين"),
                      () => void roster(r),
                      true,
                    )}
                    {admin &&
                      button(t("Modifier", "تعديل"), () => groupForm(r), true)}
                  </>
                )}
                {page === "sessions" && (
                  <>
                    <View style={s.cardTop}>
                      <Text style={[s.cardTitle, rtl, { flex: 1 }]}>
                        {r.group_name}
                      </Text>
                      <Text style={s.pill}>{tr(r.status)}</Text>
                    </View>
                    <Text style={[s.text, rtl]}>{date(r.starts_at)}</Text>
                    <Text style={[s.small, rtl]}>
                      {t("Fin", "النهاية")} : {date(r.ends_at)} · {r.room}
                    </Text>
                    {button(
                      t("Présences", "الحضور"),
                      () => void attendance(r),
                      true,
                    )}
                    {teach && (
                      <>
                        {button(
                          t("Reprogrammer", "إعادة جدولة"),
                          () => sessionForm(r),
                          true,
                        )}
                        {button(
                          t("Changer le statut", "تغيير الحالة"),
                          () =>
                            form(
                              t("Statut de la séance", "حالة الحصة"),
                              [
                                field("status", "Statut", "الحالة", r.status, {
                                  options: [
                                    "scheduled",
                                    "completed",
                                    "cancelled",
                                  ].map((value) => ({
                                    value,
                                    label: tr(value),
                                  })),
                                }),
                              ],
                              (v) => api(`sessions/${r.id}/status`, "POST", v),
                            ),
                          true,
                        )}
                      </>
                    )}
                  </>
                )}
                {page === "invoices" && (
                  <>
                    <Text style={[s.cardTitle, rtl]}>{r.student_name}</Text>
                    <Text style={[s.muted, rtl]}>{r.label}</Text>
                    <Text style={[s.metricNumber, rtl]}>
                      {money(r.balance_centimes)}
                    </Text>
                    <Text style={[s.small, rtl]}>
                      {t("Montant", "المبلغ")} {money(r.amount_centimes)} ·{" "}
                      {t("Payé", "المدفوع")} {money(r.paid_centimes)}
                    </Text>
                    <Text style={[s.small, rtl]}>
                      {t("Date limite", "الاستحقاق")} {r.due_date} ·{" "}
                      {r.status === "cancelled"
                        ? tr("cancelled")
                        : t("Ouverte", "مفتوح")}
                    </Text>
                    {finance &&
                      r.status === "open" &&
                      r.balance_centimes > 0 &&
                      button(t("Encaisser", "تحصيل"), () => paymentForm(r))}
                  </>
                )}
                {page === "payments" && (
                  <>
                    <View style={s.cardTop}>
                      <Text style={s.cardTitle}>
                        #{r.receipt_number} · {r.student_name}
                      </Text>
                      <Text style={s.pill}>{tr(r.kind)}</Text>
                    </View>
                    <Text style={s.metricNumber}>
                      {r.kind === "refund" ? "−" : ""}
                      {money(r.amount_centimes)}
                    </Text>
                    <Text style={[s.muted, rtl]}>{r.invoice_label}</Text>
                    <Text style={[s.small, rtl]}>
                      {date(r.created_at)} · {tr(r.method)} · {r.reference}
                    </Text>
                    {button(
                      t("Partager le reçu", "مشاركة الإيصال"),
                      () =>
                        void Share.share({
                          message: `${user.school} — Midad\n${t("Reçu", "إيصال")} #${r.receipt_number}\n${r.student_name} · ${r.invoice_label}\n${tr(r.kind)} : ${money(r.amount_centimes)}\n${date(r.created_at)} · ${tr(r.method)}\n${r.reference}\n${t("Reçu de versement, sans valeur de facture fiscale.", "إيصال دفع، ليس فاتورة ضريبية.")}`,
                        }),
                      true,
                    )}
                    {finance &&
                      r.kind === "payment" &&
                      button(
                        t("Rembourser", "استرداد"),
                        () => refundForm(r),
                        true,
                      )}
                  </>
                )}
                {page === "payroll" && (
                  <>
                    <Text style={s.cardTitle}>{r.name}</Text>
                    <Text style={s.metricNumber}>
                      {money(r.balance_centimes)}
                    </Text>
                    <Text style={s.muted}>
                      {t("Calculé", "المحسوب")} {money(r.earned_centimes)} ·{" "}
                      {t("Réglé", "المسدد")} {money(r.paid_centimes)}
                    </Text>
                    {r.groups.map((g: Row) => (
                      <Text style={s.small} key={g.id}>
                        {g.name} · {g.session_count} {t("séances", "حصص")} ·{" "}
                        {g.hours.toFixed(1)} h
                      </Text>
                    ))}
                    {finance &&
                      r.balance_centimes > 0 &&
                      button(
                        t("Régler", "تسديد"),
                        () =>
                          form(
                            t("Régler la rémunération", "تسديد الأجر"),
                            [
                              field(
                                "amount",
                                "Montant DA",
                                "المبلغ دج",
                                String(r.balance_centimes / 100),
                                { numeric: true },
                              ),
                              field("reference", "Référence", "المرجع"),
                            ],
                            (v) =>
                              api("payroll", "POST", {
                                teacher_id: r.id,
                                month: month(),
                                amount_centimes: centimes(v.amount),
                                reference: v.reference,
                              }),
                          ),
                        true,
                      )}
                  </>
                )}
                {["announcements", "notifications"].includes(page) && (
                  <>
                    <Text style={s.small}>
                      {r.group_name || user.school} · {date(r.created_at)}
                    </Text>
                    <Text style={[s.cardTitle, rtl, { marginTop: 10 }]}>
                      {r.title}
                    </Text>
                    <Text style={[s.text, rtl]}>{r.body}</Text>
                    {page === "notifications" &&
                      !r.seen &&
                      button(
                        t("Marquer comme lu", "تحديد كمقروء"),
                        () =>
                          void action(() =>
                            api("notifications/read", "POST", { id: r.id }),
                          ),
                        true,
                      )}
                  </>
                )}
                {page === "materials" && (
                  <>
                    <Text style={[s.cardTitle, rtl]}>{r.title}</Text>
                    <Text style={[s.muted, rtl]}>
                      {r.group_name} · {r.filename}
                    </Text>
                    {button(
                      t("Télécharger / partager", "تحميل / مشاركة"),
                      () => void download(r),
                      true,
                    )}
                  </>
                )}
                {page === "users" && (
                  <>
                    <Text style={s.cardTitle}>{r.name}</Text>
                    <Text style={s.muted}>{r.email}</Text>
                    <Text style={s.pill}>
                      {r.role} ·{" "}
                      {r.active
                        ? r.verified
                          ? t("Actif", "نشط")
                          : t("Invitation en attente", "دعوة معلقة")
                        : t("Désactivé", "معطل")}
                    </Text>
                    {user.role === "OWNER" &&
                      r.id !== user.id &&
                      r.role !== "OWNER" &&
                      button(
                        r.active
                          ? t("Désactiver", "تعطيل")
                          : t("Réactiver", "تفعيل"),
                        () =>
                          void action(() =>
                            api(`users/${r.id}`, "PATCH", {
                              active: !r.active,
                            }),
                          ),
                        true,
                      )}
                  </>
                )}
                {page === "audit" && (
                  <>
                    <Text style={s.small}>
                      {date(r.created_at)} · {r.actor}
                    </Text>
                    <Text style={s.strong}>{r.action}</Text>
                    <Text style={s.small}>{JSON.stringify(r.detail)}</Text>
                  </>
                )}
              </View>
            ))}
          {!loading &&
            !["account", "dashboard"].includes(page) &&
            !shown.length && (
              <View style={s.emptyCard}>
                <Text style={[s.cardTitle, rtl]}>
                  {t("Aucune entrée pour le moment", "لا توجد سجلات حاليًا")}
                </Text>
                <Text style={[s.muted, rtl]}>
                  {t(
                    "Vos informations apparaîtront ici.",
                    "ستظهر معلوماتك هنا.",
                  )}
                </Text>
              </View>
            )}
          {page === "account" && (
            <>
              <View style={s.card}>
                <Text style={s.cardTitle}>{user.name}</Text>
                <Text style={s.muted}>{user.email}</Text>
                <Text style={s.small}>
                  {user.school} · {user.slug} · {user.role}
                </Text>
              </View>
              {button(
                t("Activer les notifications", "تفعيل الإشعارات"),
                () => void pushes(),
                true,
              )}
              {button(
                t("Changer mon mot de passe", "تغيير كلمة المرور"),
                () =>
                  form(
                    t("Mot de passe", "كلمة المرور"),
                    [
                      field(
                        "current",
                        "Mot de passe actuel",
                        "كلمة المرور الحالية",
                        undefined,
                        { secure: true },
                      ),
                      field(
                        "password",
                        "Nouveau (12 caractères minimum)",
                        "الجديدة (12 حرفًا على الأقل)",
                        undefined,
                        { secure: true },
                      ),
                    ],
                    (v) => api("auth/password", "POST", v),
                  ),
                true,
              )}
              {button(
                t("Ouvrir la gestion web", "فتح إدارة الويب"),
                () => void Linking.openURL(`${WEBSITE}/app`),
                true,
              )}
              {button(
                t("Confidentialité & conditions", "الخصوصية والشروط"),
                () => void Linking.openURL(`${WEBSITE}/legal`),
                true,
              )}
              {user.role !== "OWNER" &&
                button(
                  t("Supprimer mon compte", "حذف حسابي"),
                  () =>
                    form(
                      t("Suppression du compte personnel", "حذف الحساب الشخصي"),
                      [
                        field(
                          "password",
                          "Mot de passe. Les écritures financières sont conservées.",
                          "كلمة المرور. السجلات المالية محفوظة.",
                          undefined,
                          { secure: true },
                        ),
                        field(
                          "confirm",
                          "Saisissez SUPPRIMER",
                          "اكتب SUPPRIMER",
                        ),
                      ],
                      async (v) => {
                        if (v.confirm !== "SUPPRIMER")
                          throw new Error(
                            t("Confirmation incorrecte", "تأكيد غير صحيح"),
                          );
                        await api("auth/delete-account", "POST", {
                          password: v.password,
                        });
                        await setSession("");
                        setUser(null);
                      },
                    ),
                  true,
                )}
              {button(t("Se déconnecter", "تسجيل الخروج"), () => void logout())}
            </>
          )}
          <Text style={s.foot}>Midad · مداد</Text>
        </ScrollView>
        {!wide && (
          <View style={s.bottom}>
            {[
              ["dashboard", "⌂", t("Accueil", "الرئيسية")],
              ["sessions", "▦", t("Planning", "الجدول")],
              ["notifications", "♧", t("Messages", "الرسائل")],
              ["account", "○", t("Compte", "الحساب")],
            ].map(([p, icon, label]) => (
              <Pressable
                style={s.tab}
                accessibilityRole="button"
                accessibilityState={{ selected: page === p }}
                key={p}
                onPress={() => nav(p)}
              >
                <Text style={[s.tabIcon, page === p && s.tabActive]}>
                  {icon}
                </Text>
                <Text style={[s.tabText, page === p && s.tabActive]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
      <Modal
        visible={menu}
        animationType="slide"
        onRequestClose={() => setMenu(false)}
      >
        <SafeAreaView style={s.safe}>
          <View style={s.modalTop}>
            <Text style={s.title}>{t("Votre espace", "مساحتك")}</Text>
            {button("×", () => setMenu(false), true)}
          </View>
          <ScrollView contentContainerStyle={s.content}>
            {menus.map((p) => (
              <Pressable style={s.menuRow} key={p} onPress={() => nav(p)}>
                <Text style={[s.strong, rtl]}>
                  {labels[p][ar ? "ar" : "fr"]}
                </Text>
                <Text>›</Text>
              </Pressable>
            ))}
            <Pressable style={s.menuRow} onPress={() => nav("account")}>
              <Text style={s.strong}>{t("Mon compte", "حسابي")}</Text>
              <Text>›</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
      {detail && (
        <Modal animationType="slide" onRequestClose={() => setDetail(null)}>
          <SafeAreaView style={s.safe}>
            <View style={s.modalTop}>
              <Text style={[s.cardTitle, { flex: 1 }]}>
                {detail.row.group_name || detail.row.name}
              </Text>
              {button("×", () => setDetail(null), true)}
            </View>
            <ScrollView contentContainerStyle={s.content}>
              {detail.kind === "attendance" && (
                <>
                  <Text style={s.muted}>{date(detail.row.starts_at)}</Text>
                  {detail.rows.map((r, i) => (
                    <View key={r.student_id} style={s.card}>
                      <Text style={s.cardTitle}>{r.name}</Text>
                      <View style={s.chips}>
                        {["unmarked", "present", "absent", "late"].map((st) => (
                          <Pressable
                            disabled={
                              !teach || detail.row.status === "cancelled"
                            }
                            key={st}
                            style={[s.chip, r.status === st && s.selected]}
                            onPress={() =>
                              setDetail({
                                ...detail,
                                rows: detail.rows.map((x, j) =>
                                  i === j ? { ...x, status: st } : x,
                                ),
                              })
                            }
                          >
                            <Text
                              style={[
                                s.chipText,
                                r.status === st && s.selectedText,
                              ]}
                            >
                              {tr(st)}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      {r.justification && (
                        <>
                          <Text style={s.muted}>{r.justification}</Text>
                          <Text style={s.small}>{tr(r.decision)}</Text>
                          {teach && r.decision === "pending" && (
                            <View style={s.inline}>
                              {["accepted", "rejected"].map((d) => (
                                <Pressable
                                  key={d}
                                  onPress={() =>
                                    void action(async () => {
                                      await api(
                                        `sessions/${detail.row.id}/decision`,
                                        "POST",
                                        {
                                          student_id: r.student_id,
                                          decision: d,
                                        },
                                      );
                                      await attendance(detail.row);
                                    })
                                  }
                                >
                                  <Text style={s.link}>{tr(d)}</Text>
                                </Pressable>
                              ))}
                            </View>
                          )}
                        </>
                      )}
                      {family &&
                        ["absent", "late"].includes(r.status) &&
                        button(
                          t("Justifier", "تبرير"),
                          () =>
                            form(
                              t("Justificatif", "تبرير"),
                              [
                                field(
                                  "justification",
                                  "Votre message",
                                  "رسالتك",
                                  r.justification,
                                  { multiline: true },
                                ),
                              ],
                              async (v) => {
                                await api(
                                  `sessions/${detail.row.id}/justify`,
                                  "POST",
                                  {
                                    student_id: r.student_id,
                                    justification: v.justification,
                                  },
                                );
                                await attendance(detail.row);
                              },
                            ),
                          true,
                        )}
                    </View>
                  ))}
                  {teach &&
                    detail.rows.length > 0 &&
                    detail.row.status !== "cancelled" &&
                    button(
                      t("Enregistrer les présences", "حفظ الحضور"),
                      () =>
                        void action(() =>
                          api(`sessions/${detail.row.id}/attendance`, "PUT", {
                            entries: detail.rows.map((r) => ({
                              student_id: r.student_id,
                              status: r.status,
                            })),
                          }),
                        ),
                    )}
                </>
              )}
              {detail.kind === "roster" && (
                <>
                  {detail.rows.map((r) => (
                    <View style={s.card} key={r.id}>
                      <Text style={s.cardTitle}>{r.name}</Text>
                      <Text style={s.small}>{r.level}</Text>
                      {admin &&
                        button(
                          t("Retirer du groupe", "إزالة من المجموعة"),
                          () =>
                            void action(async () => {
                              await api(
                                `groups/${detail.row.id}/enroll/${r.id}`,
                                "DELETE",
                              );
                              await roster(detail.row);
                            }),
                          true,
                        )}
                    </View>
                  ))}
                  {admin &&
                    button(t("+ Inscrire un élève", "+ تسجيل تلميذ"), () =>
                      form(
                        t("Inscrire au groupe", "التسجيل في المجموعة"),
                        [
                          choose(
                            "student_id",
                            "Élève",
                            "التلميذ",
                            lookup.students.filter(
                              (r) => !detail.rows.some((x) => x.id === r.id),
                            ),
                          ),
                        ],
                        async (v) => {
                          await api(
                            `groups/${detail.row.id}/enroll`,
                            "POST",
                            v,
                          );
                          await roster(detail.row);
                        },
                      ),
                    )}
                </>
              )}
              {error && <Text style={s.error}>{error}</Text>}
              {message && <Text style={s.success}>{message}</Text>}
            </ScrollView>
            {editor && (
              <EditorModal
                editor={editor}
                ar={ar}
                close={() => setEditor(null)}
                save={async (v) => {
                  await editor.save(v);
                  setEditor(null);
                  await load();
                }}
              />
            )}
          </SafeAreaView>
        </Modal>
      )}
      {editor && !detail && (
        <EditorModal
          editor={editor}
          ar={ar}
          close={() => setEditor(null)}
          save={async (v) => {
            await editor.save(v);
            setEditor(null);
            setMessage(t("Enregistré", "تم الحفظ"));
            await load();
          }}
        />
      )}
    </SafeAreaView>
  );
}
function Login({
  ar,
  busy,
  submit,
}: {
  ar: boolean;
  busy: boolean;
  submit: (v: Record<string, string>) => void;
}) {
  const [slug, setSlug] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  return (
    <View style={{ marginTop: 28 }}>
      {[
        [
          ar ? "معرف المؤسسة" : "Identifiant de l’établissement",
          slug,
          setSlug,
          false,
        ],
        [ar ? "البريد الإلكتروني" : "Email", email, setEmail, false],
        [ar ? "كلمة المرور" : "Mot de passe", password, setPassword, true],
      ].map(([label, value, change, secure]) => (
        <View key={label as string}>
          <Text style={s.label}>{label as string}</Text>
          <TextInput
            accessibilityLabel={label as string}
            style={s.input}
            value={value as string}
            onChangeText={change as (v: string) => void}
            secureTextEntry={secure as boolean}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType={
              secure ? "password" : label === "Email" ? "emailAddress" : "none"
            }
          />
        </View>
      ))}
      <Pressable
        disabled={busy || !slug || !email || !password}
        style={[s.button, busy && s.disabled]}
        onPress={() => submit({ slug, email, password })}
      >
        <Text style={s.buttonText}>
          {busy ? (ar ? "لحظة…" : "Un instant…") : ar ? "دخول" : "Se connecter"}
        </Text>
      </Pressable>
    </View>
  );
}
function EditorModal({
  editor,
  ar,
  close,
  save,
}: {
  editor: Editor;
  ar: boolean;
  close: () => void;
  save: (v: Record<string, string>) => Promise<void>;
}) {
  const [v, setV] = useState<Record<string, string>>(
      Object.fromEntries(editor.fields.map((f) => [f.key, f.value ?? ""])),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit() {
    setBusy(true);
    setError("");
    try {
      for (const f of editor.fields)
        if (!f.optional && !v[f.key]?.trim())
          throw new Error(`${f.label}: ${ar ? "مطلوب" : "requis"}`);
      await save(v);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={s.backdrop}
      >
        <View style={s.sheet}>
          <View style={s.modalTop}>
            <Text style={[s.cardTitle, { flex: 1 }]}>{editor.title}</Text>
            <Pressable
              accessibilityLabel="Fermer / إغلاق"
              disabled={busy}
              onPress={close}
            >
              <Text style={s.menuIcon}>×</Text>
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 22 }}
            keyboardShouldPersistTaps="handled"
          >
            {editor.fields.map((f) => (
              <View key={f.key}>
                <Text style={[s.label, ar && { textAlign: "right" }]}>
                  {f.label}
                </Text>
                {f.options ? (
                  <View style={s.chips}>
                    {f.optional && (
                      <Pressable
                        style={[s.chip, !v[f.key] && s.selected]}
                        onPress={() => setV({ ...v, [f.key]: "" })}
                      >
                        <Text style={[s.chipText, !v[f.key] && s.selectedText]}>
                          —
                        </Text>
                      </Pressable>
                    )}
                    {f.options.map((o) => (
                      <Pressable
                        key={o.value}
                        style={[s.chip, v[f.key] === o.value && s.selected]}
                        onPress={() => setV({ ...v, [f.key]: o.value })}
                      >
                        <Text
                          style={[
                            s.chipText,
                            v[f.key] === o.value && s.selectedText,
                          ]}
                        >
                          {o.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <TextInput
                    accessibilityLabel={f.label}
                    value={v[f.key]}
                    onChangeText={(x) => setV({ ...v, [f.key]: x })}
                    style={[
                      s.input,
                      f.multiline && {
                        minHeight: 110,
                        textAlignVertical: "top",
                      },
                    ]}
                    secureTextEntry={f.secure}
                    autoCapitalize="none"
                    autoCorrect={false}
                    multiline={f.multiline}
                    keyboardType={f.numeric ? "decimal-pad" : "default"}
                  />
                )}
              </View>
            ))}
            {error && (
              <Text accessibilityRole="alert" style={s.error}>
                {error}
              </Text>
            )}
            <Pressable
              style={[s.button, busy && s.disabled]}
              disabled={busy}
              onPress={() => void submit()}
            >
              <Text style={s.buttonText}>
                {busy
                  ? ar
                    ? "جاري الحفظ…"
                    : "Enregistrement…"
                  : ar
                    ? "تأكيد"
                    : "Confirmer"}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f5f7fb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 20 },
  login: {
    padding: 28,
    paddingTop: 20,
    maxWidth: 500,
    width: "100%",
    alignSelf: "center",
  },
  mark: {
    backgroundColor: "#4362e8",
    color: "#e6ecff",
    height: 60,
    width: 60,
    borderRadius: 16,
    textAlign: "center",
    textAlignVertical: "center",
    fontSize: 40,
    overflow: "hidden",
    marginTop: 20,
    lineHeight: 55,
  },
  brand: {
    fontSize: 19,
    fontWeight: "700",
    color: "#253957",
    marginTop: 18,
    marginBottom: 20,
  },
  hero: {
    fontSize: 34,
    fontWeight: "600",
    color: "#263b5b",
    lineHeight: 42,
    marginBottom: 15,
  },
  muted: { fontSize: 13, lineHeight: 22, color: "#8595b0", marginBottom: 12 },
  text: { fontSize: 14, lineHeight: 23, color: "#596f91", marginBottom: 10 },
  small: { fontSize: 10, lineHeight: 18, color: "#94a2b9" },
  label: { fontSize: 12, fontWeight: "500", color: "#657b9e", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f3",
    borderRadius: 9,
    backgroundColor: "#fff",
    padding: 13,
    color: "#374e72",
    fontSize: 14,
    marginBottom: 19,
    minHeight: 48,
  },
  button: {
    backgroundColor: "#4362e8",
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 9,
    alignItems: "center",
    marginBottom: 12,
    minHeight: 45,
    justifyContent: "center",
  },
  buttonText: { color: "#ffffff", fontSize: 13, fontWeight: "600" },
  secondary: {
    backgroundColor: "#f5f7fc",
    borderWidth: 1,
    borderColor: "#e2e8f3",
  },
  secondaryText: { color: "#6680a7" },
  disabled: { opacity: 0.5 },
  link: { fontSize: 13, color: "#617ce1", fontWeight: "500" },
  error: {
    backgroundColor: "#fff0e9",
    color: "#9e563a",
    padding: 14,
    borderRadius: 8,
    marginVertical: 10,
    fontSize: 12,
    lineHeight: 20,
  },
  success: {
    backgroundColor: "#e9f4dd",
    color: "#537a3d",
    padding: 12,
    borderRadius: 8,
    marginVertical: 10,
    fontSize: 12,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingVertical: 13,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e8edf6",
  },
  topBrand: { fontSize: 21, fontWeight: "700", color: "#263a5d" },
  topArabic: { fontSize: 13, fontWeight: "400", color: "#8498be" },
  menuIcon: { fontSize: 24, color: "#647ba5" },
  inline: { flexDirection: "row", gap: 20, alignItems: "center" },
  content: {
    padding: 22,
    paddingBottom: 30,
    maxWidth: 850,
    width: "100%",
    alignSelf: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    color: "#253956",
    marginTop: 10,
    marginBottom: 26,
  },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  metric: {
    width: "47.5%",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e7edf5",
    padding: 17,
    borderRadius: 12,
    minHeight: 105,
  },
  metricNumber: {
    fontSize: 18,
    fontWeight: "600",
    color: "#4c6891",
    marginVertical: 8,
  },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e7edf5",
    borderRadius: 11,
    padding: 19,
    marginBottom: 16,
  },
  featureCard: {
    backgroundColor: "#edf3e4",
    borderWidth: 1,
    borderColor: "#dce7ce",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#546e97",
    marginBottom: 10,
  },
  strong: { fontSize: 13, fontWeight: "600", color: "#5c759d" },
  agenda: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#dce5cf",
  },
  agendaDay: {
    backgroundColor: "#dce8cd",
    color: "#507538",
    fontSize: 22,
    fontWeight: "600",
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 9,
    overflow: "hidden",
  },
  empty: {
    color: "#9baac1",
    textAlign: "center",
    fontSize: 12,
    paddingVertical: 25,
  },
  emptyCard: {
    padding: 35,
    backgroundColor: "#fff",
    borderRadius: 12,
    alignItems: "center",
  },
  foot: { textAlign: "center", fontSize: 10, color: "#acba9f", marginTop: 25 },
  cardTop: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    justifyContent: "space-between",
  },
  pill: {
    backgroundColor: "#f5f7fc",
    color: "#719252",
    borderRadius: 5,
    padding: 6,
    overflow: "hidden",
    fontSize: 10,
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  warning: {
    padding: 16,
    backgroundColor: "#fcf2d8",
    borderRadius: 10,
    marginBottom: 20,
  },
  unread: { borderColor: "#9dbd82", backgroundColor: "#fbfdf6" },
  bottom: {
    flexDirection: "row",
    paddingTop: 9,
    paddingBottom: 7,
    borderTopWidth: 1,
    borderTopColor: "#e0e8d5",
    backgroundColor: "#fff",
  },
  tab: { flex: 1, alignItems: "center", gap: 3 },
  tabIcon: { fontSize: 24, color: "#98ad85" },
  tabText: { fontSize: 9, color: "#91a47e" },
  tabActive: { color: "#365c31", fontWeight: "700" },
  modalTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 22,
    borderBottomWidth: 1,
    borderBottomColor: "#e1e9d6",
    gap: 18,
  },
  menuRow: {
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#e1e9d6",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  chip: {
    borderWidth: 1,
    borderColor: "#d6e2c8",
    borderRadius: 7,
    paddingHorizontal: 11,
    paddingVertical: 9,
    backgroundColor: "#f8faf2",
  },
  chipText: { fontSize: 11, color: "#789560" },
  selected: { backgroundColor: "#4e7440", borderColor: "#4e7440" },
  selectedText: { color: "#fff" },
  backdrop: {
    flex: 1,
    backgroundColor: "#19352577",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#f8faf5",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    minHeight: "40%",
  },
});

const r = StyleSheet.create({
  sidebar: {
    width: 248,
    backgroundColor: "#111d35",
    paddingHorizontal: 17,
    paddingTop: 25,
    paddingBottom: 20,
  },
  sideBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 27,
    paddingHorizontal: 10,
  },
  sideMark: {
    width: 38,
    height: 38,
    lineHeight: 37,
    textAlign: "center",
    backgroundColor: "#526ef2",
    color: "#fff",
    fontSize: 25,
    borderRadius: 10,
    overflow: "hidden",
  },
  sideBrandText: { color: "#fff", fontSize: 25, fontWeight: "700" },
  sideArabic: { fontSize: 12, color: "#8296bc", fontWeight: "400" },
  sideSchool: {
    fontSize: 12,
    color: "#b6c6e3",
    lineHeight: 20,
    paddingHorizontal: 11,
    marginBottom: 25,
  },
  sideCaption: {
    fontSize: 9,
    color: "#667ea8",
    letterSpacing: 1,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  sideItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    marginVertical: 2,
  },
  sideActive: { backgroundColor: "#4362e8" },
  sideItemIcon: {
    fontSize: 18,
    color: "#8198bf",
    width: 19,
    textAlign: "center",
  },
  sideItemText: { fontSize: 12, color: "#99aecf" },
  sideActiveText: { color: "#fff" },
  sideProfile: {
    paddingTop: 19,
    borderTopWidth: 1,
    borderColor: "#ffffff11",
    marginTop: 15,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  sideAvatar: {
    width: 33,
    height: 33,
    lineHeight: 32,
    textAlign: "center",
    fontSize: 14,
    color: "#bacbeb",
    backgroundColor: "#2c4165",
    borderRadius: 17,
    overflow: "hidden",
  },
  sideName: { fontSize: 11, color: "#d2ddf2" },
  sideRole: { fontSize: 10, color: "#7c94bc", marginTop: 3 },
  sideChevron: { marginLeft: "auto", color: "#95aace", fontSize: 19 },
  headerAvatar: {
    height: 31,
    width: 31,
    lineHeight: 30,
    textAlign: "center",
    color: "#7e93d5",
    backgroundColor: "#f0f3fe",
    borderRadius: 17,
    overflow: "hidden",
    fontSize: 13,
  },
});
