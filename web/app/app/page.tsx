"use client";
import {
  useEffect,
  useState,
  useRef,
  useCallback,
  FormEvent,
  ReactNode,
} from "react";
import Link from "next/link";
import Overview from "./overview";
import PlanningCalendar from "./calendar";
import RecurringPlanning from "./recurrence";
import "./workspace.css";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  CalendarDays,
  Wallet,
  Receipt,
  GraduationCap,
  Megaphone,
  Files,
  Bell,
  Shield,
  History,
  Settings,
  LogOut,
  Plus,
  Search,
  ArrowUpRight,
  Menu,
  X,
  Check,
  Download,
  ChevronRight,
} from "lucide-react";
import {
  User,
  adminRoles,
  financeRoles,
  labels,
  dinars,
  calendarWeek,
  shiftDay,
} from "@midad/shared";
import { api, cents, localDate, API } from "../../lib/api";
type Row = Record<string, any>;
type Field = {
  key: string;
  fr: string;
  ar: string;
  type?: string;
  required?: boolean;
  value?: unknown;
  options?: { value: string; label: string }[];
};
type Editor = {
  title: string;
  fields: Field[];
  save: (f: FormData) => Promise<unknown>;
};
const icons: Record<string, typeof Users> = {
  dashboard: LayoutDashboard,
  students: Users,
  groups: BookOpen,
  sessions: CalendarDays,
  invoices: Receipt,
  payments: Wallet,
  payroll: GraduationCap,
  announcements: Megaphone,
  materials: Files,
  notifications: Bell,
  users: Shield,
  audit: History,
  settings: Settings,
};
const strings: Record<string, [string, string]> = {
  OWNER: ["Propriétaire", "المالك"],
  MANAGER: ["Responsable", "المسؤول"],
  CASHIER: ["Caissier", "أمين الصندوق"],
  TEACHER: ["Enseignant", "أستاذ"],
  PARENT: ["Parent", "ولي"],
  STUDENT: ["Élève", "تلميذ"],
  present: ["Présent", "حاضر"],
  absent: ["Absent", "غائب"],
  late: ["En retard", "متأخر"],
  unmarked: ["Non renseigné", "غير مسجل"],
  scheduled: ["Prévue", "مبرمجة"],
  completed: ["Terminée", "مكتملة"],
  cancelled: ["Annulée", "ملغاة"],
  payment: ["Versement", "دفع"],
  refund: ["Remboursement", "استرداد"],
  cash: ["Espèces", "نقدًا"],
  ccp: ["CCP", "حساب بريدي"],
  bank_transfer: ["Virement", "تحويل"],
  card_external: ["Carte (paiement externe)", "بطاقة (دفع خارجي)"],
  pending: ["En attente", "قيد الانتظار"],
  accepted: ["Accepté", "مقبول"],
  rejected: ["Refusé", "مرفوض"],
};
const value = (f: FormData, k: string) => String(f.get(k) ?? "");
const nullable = (f: FormData, k: string) => value(f, k) || null;
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Algiers" });
function iso(f: FormData, k: string) {
  const s = value(f, k);
  return new Date(`${s}:00+01:00`).toISOString();
}
function localInput(v: string) {
  return new Date(v)
    .toLocaleString("sv-SE", { timeZone: "Africa/Algiers" })
    .replace(" ", "T")
    .slice(0, 16);
}
export default function Workspace() {
  const [user, setUser] = useState<User | null>(null),
    [lang, setLang] = useState<"fr" | "ar">("fr"),
    [page, setPage] = useState("dashboard"),
    [rows, setRows] = useState<Row[]>([]),
    [dashboard, setDashboard] = useState<Row>({}),
    [settings, setSettings] = useState<Row>({}),
    [lookup, setLookup] = useState<{
      students: Row[];
      groups: Row[];
      users: Row[];
    }>({ students: [], groups: [], users: [] }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [editor, setEditor] = useState<Editor | null>(null),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(""),
    [drawer, setDrawer] = useState(false),
    [detail, setDetail] = useState<{
      kind: string;
      row: Row;
      rows: Row[];
    } | null>(null),
    [cash, setCash] = useState<Row | null>(null),
    [month, setMonth] = useState(today().slice(0, 7));
  const request = useRef(0);
  const [schoolClosures, setSchoolClosures] = useState<Row[]>([]);
  const [sessionRange, setSessionRange] = useState(() => {
    const days = calendarWeek(today());
    return { from: days[0], to: shiftDay(days[6], 1) };
  });
  const calendarRange = useCallback((from: string, to: string) => {
    setSessionRange((old) =>
      old.from === from && old.to === to ? old : { from, to },
    );
  }, []);
  const t = (fr: string, ar: string) => (lang === "fr" ? fr : ar);
  const tr = (s: string) => strings[s]?.[lang === "fr" ? 0 : 1] ?? s;
  const admin = !!user && adminRoles.includes(user.role),
    finance = !!user && financeRoles.includes(user.role),
    teacher = user?.role === "TEACHER",
    family = user?.role === "PARENT" || user?.role === "STUDENT";
  const teach = admin || teacher;
  const money = (n: number) => dinars(n ?? 0, lang);
  const opts = (list: Row[], label = "name") =>
    list.map((r) => ({ value: r.id, label: r[label] }));
  useEffect(() => {
    api("auth/me")
      .then((u) => {
        setUser(u);
        setLang(u.locale);
        const p = new URLSearchParams(location.search).get("view");
        if (p && labels[p]) setPage(p);
      })
      .catch(() => location.replace("/auth"));
  }, []);
  async function load() {
    if (!user) return;
    const seq = ++request.current;
    setLoading(true);
    setError("");
    try {
      const data = await api(
        page === "payroll"
          ? `payroll?month=${month}`
          : page === "sessions"
            ? `sessions?from=${sessionRange.from}&to=${sessionRange.to}`
            : page,
      );
      if (seq !== request.current) return;
      if (page === "dashboard") setDashboard(data);
      else if (page === "settings") setSettings(data);
      else setRows(data);
      if (page === "sessions") {
        const closures = await api("planning/closures");
        if (seq === request.current) setSchoolClosures(closures);
      }
      if (page === "payments" && finance) setCash(await api("cash"));
      if (admin || finance || teach || page === "sessions") {
        const [students, groups, users] = await Promise.all([
          api("students"),
          api("groups"),
          admin ? api("users") : Promise.resolve([]),
        ]);
        if (seq === request.current) setLookup({ students, groups, users });
      }
    } catch (e) {
      if (seq === request.current) setError((e as Error).message);
    } finally {
      if (seq === request.current) setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [user, page, month, sessionRange]);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 6000);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  function navigate(p: string) {
    setPage(p);
    setSearch("");
    setDetail(null);
    setDrawer(false);
    history.replaceState(null, "", `/app?view=${p}`);
  }
  async function action(
    fn: () => Promise<unknown>,
    message = t("Enregistré", "تم الحفظ"),
  ) {
    setBusy(true);
    setError("");
    try {
      await fn();
      setNotice(message);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function form(title: string, fields: Field[], save: Editor["save"]) {
    setError("");
    setEditor({ title, fields, save });
  }
  const text = (
    key: string,
    fr: string,
    ar: string,
    v?: unknown,
    required = true,
    type = "text",
  ): Field => ({ key, fr, ar, value: v, required, type });
  const select = (
    key: string,
    fr: string,
    ar: string,
    options: Field["options"],
    v?: unknown,
    required = false,
  ): Field => ({ key, fr, ar, type: "select", options, value: v, required });
  function studentForm(r: Row = {}) {
    form(
      t(
        r.id ? "Modifier le dossier" : "Nouvel élève",
        r.id ? "تعديل الملف" : "تلميذ جديد",
      ),
      [
        text("name", "Nom complet", "الاسم الكامل", r.name),
        text("phone", "Téléphone", "الهاتف", r.phone, false, "tel"),
        text("level", "Niveau", "المستوى", r.level, false),
        text(
          "birth_date",
          "Date de naissance",
          "تاريخ الميلاد",
          r.birth_date,
          false,
          "date",
        ),
        select(
          "parent_id",
          "Compte parent",
          "حساب الولي",
          opts(lookup.users.filter((u) => u.role === "PARENT" && u.active)),
          r.parent_id,
        ),
        select(
          "user_id",
          "Compte élève",
          "حساب التلميذ",
          opts(lookup.users.filter((u) => u.role === "STUDENT" && u.active)),
          r.user_id,
        ),
      ],
      (f) =>
        api(r.id ? `students/${r.id}` : "students", r.id ? "PATCH" : "POST", {
          name: value(f, "name"),
          phone: value(f, "phone"),
          level: value(f, "level"),
          birth_date: nullable(f, "birth_date"),
          parent_id: nullable(f, "parent_id"),
          user_id: nullable(f, "user_id"),
        }),
    );
  }
  function groupForm(r: Row = {}) {
    form(
      t(
        r.id ? "Modifier le groupe" : "Nouveau groupe",
        r.id ? "تعديل المجموعة" : "مجموعة جديدة",
      ),
      [
        text("name", "Nom du groupe", "اسم المجموعة", r.name),
        text("subject", "Matière", "المادة", r.subject),
        text("level", "Niveau", "المستوى", r.level, false),
        select(
          "teacher_id",
          "Enseignant",
          "الأستاذ",
          opts(lookup.users.filter((u) => u.role === "TEACHER" && u.active)),
          r.teacher_id,
        ),
        text("room", "Salle", "القاعة", r.room, false),
        text("capacity", "Capacité", "السعة", r.capacity ?? 20, true, "number"),
        text(
          "fee",
          "Tarif mensuel (DA)",
          "التعريفة الشهرية (دج)",
          (r.fee_centimes ?? 0) / 100,
          true,
          "money",
        ),
        select(
          "pay_mode",
          "Rémunération",
          "طريقة الأجر",
          [
            { value: "session", label: t("Par séance", "لكل حصة") },
            { value: "hour", label: t("Par heure", "لكل ساعة") },
            {
              value: "percent",
              label: t("% des encaissements nets", "نسبة من التحصيل الصافي"),
            },
          ],
          r.pay_mode ?? "session",
          true,
        ),
        text(
          "pay_value",
          "Montant DA ou pourcentage (0 à 100)",
          "المبلغ بالدينار أو النسبة (0 إلى 100)",
          (r.pay_value ?? 0) / 100,
          true,
          "money",
        ),
      ],
      (f) =>
        api(r.id ? `groups/${r.id}` : "groups", r.id ? "PATCH" : "POST", {
          name: value(f, "name"),
          subject: value(f, "subject"),
          level: value(f, "level"),
          teacher_id: nullable(f, "teacher_id"),
          room: value(f, "room"),
          capacity: Number(value(f, "capacity")),
          fee_centimes: cents(f.get("fee")),
          pay_mode: value(f, "pay_mode"),
          pay_value: cents(f.get("pay_value")),
        }),
    );
  }
  function sessionForm(r: Row = {}) {
    form(
      t(
        r.id ? "Reprogrammer la séance" : "Nouvelle séance",
        r.id ? "إعادة جدولة الحصة" : "حصة جديدة",
      ),
      [
        select(
          "group_id",
          "Groupe",
          "المجموعة",
          opts(lookup.groups),
          r.group_id,
          true,
        ),
        text(
          "starts_at",
          "Début — heure d’Alger",
          "البداية — توقيت الجزائر",
          r.starts_at ? localInput(r.starts_at) : undefined,
          true,
          "datetime-local",
        ),
        text(
          "ends_at",
          "Fin — heure d’Alger",
          "النهاية — توقيت الجزائر",
          r.ends_at ? localInput(r.ends_at) : undefined,
          true,
          "datetime-local",
        ),
        text(
          "room",
          "Salle (vide = salle du groupe)",
          "القاعة (فارغة = قاعة المجموعة)",
          r.room,
          false,
        ),
        text("notes", "Notes", "ملاحظات", r.notes, false, "textarea"),
      ],
      (f) =>
        api(r.id ? `sessions/${r.id}` : "sessions", r.id ? "PATCH" : "POST", {
          group_id: value(f, "group_id"),
          starts_at: iso(f, "starts_at"),
          ends_at: iso(f, "ends_at"),
          room: value(f, "room"),
          notes: value(f, "notes"),
        }),
    );
  }
  function sessionStatus(r: Row) {
    form(
      t("Changer le statut", "تغيير الحالة"),
      [
        select(
          "status",
          "Statut",
          "الحالة",
          ["scheduled", "completed", "cancelled"].map((value) => ({
            value,
            label: tr(value),
          })),
          r.status,
          true,
        ),
      ],
      (f) =>
        api(`sessions/${r.id}/status`, "POST", { status: value(f, "status") }),
    );
  }
  function invoiceForm() {
    form(
      t("Créer une échéance", "إنشاء مستحق"),
      [
        select(
          "student_id",
          "Élève",
          "التلميذ",
          opts(lookup.students),
          undefined,
          true,
        ),
        select(
          "group_id",
          "Groupe (facultatif)",
          "المجموعة (اختياري)",
          opts(lookup.groups),
        ),
        text("label", "Libellé", "الوصف"),
        text("amount", "Montant DA", "المبلغ دج", undefined, true, "money"),
        text(
          "due_date",
          "Date limite",
          "تاريخ الاستحقاق",
          today(),
          true,
          "date",
        ),
      ],
      (f) =>
        api("invoices", "POST", {
          student_id: value(f, "student_id"),
          group_id: nullable(f, "group_id"),
          label: value(f, "label"),
          amount_centimes: cents(f.get("amount")),
          due_date: value(f, "due_date"),
        }),
    );
  }
  function generate() {
    form(
      t("Facturation mensuelle du groupe", "الفوترة الشهرية للمجموعة"),
      [
        select(
          "group_id",
          "Groupe",
          "المجموعة",
          opts(lookup.groups),
          undefined,
          true,
        ),
        text("month", "Mois", "الشهر", month, true, "month"),
        text(
          "due_date",
          "Date limite",
          "تاريخ الاستحقاق",
          today(),
          true,
          "date",
        ),
      ],
      async (f) => {
        const r = await api("invoices/generate", "POST", {
          group_id: value(f, "group_id"),
          month: value(f, "month"),
          due_date: value(f, "due_date"),
        });
        setNotice(
          t(
            `${r.created} échéances créées. Les doublons sont ignorés.`,
            `تم إنشاء ${r.created} مستحقات. تم تجاهل المكررة.`,
          ),
        );
        return r;
      },
    );
  }
  function paymentForm(i: Row) {
    const key = crypto.randomUUID();
    form(
      t(`Versement · ${i.student_name}`, `دفع · ${i.student_name}`),
      [
        text(
          "amount",
          `Montant DA — solde ${(i.balance_centimes / 100).toFixed(2)}`,
          `المبلغ دج — الرصيد ${(i.balance_centimes / 100).toFixed(2)}`,
          i.balance_centimes / 100,
          true,
          "money",
        ),
        select(
          "method",
          "Mode de règlement",
          "وسيلة الدفع",
          ["cash", "ccp", "bank_transfer", "card_external"].map((value) => ({
            value,
            label: tr(value),
          })),
          "cash",
          true,
        ),
        text(
          "reference",
          "Référence (obligatoire hors espèces)",
          "المرجع (مطلوب لغير النقد)",
          undefined,
          false,
        ),
      ],
      async (f) => {
        const p = await api(
          "payments",
          "POST",
          {
            invoice_id: i.id,
            amount_centimes: cents(f.get("amount")),
            method: value(f, "method"),
            reference: value(f, "reference"),
          },
          { "Idempotency-Key": key },
        );
        setDetail({
          kind: "receipt",
          row: { ...p, student_name: i.student_name, label: i.label },
          rows: [],
        });
        return p;
      },
    );
  }
  function refundForm(p: Row) {
    const key = crypto.randomUUID();
    form(
      t("Enregistrer un remboursement", "تسجيل استرداد"),
      [
        text(
          "amount",
          "Montant à rembourser DA",
          "مبلغ الاسترداد دج",
          p.amount_centimes / 100,
          true,
          "money",
        ),
        text("reference", "Motif / référence", "السبب / المرجع"),
      ],
      (f) =>
        api(
          "refunds",
          "POST",
          {
            payment_id: p.id,
            amount_centimes: cents(f.get("amount")),
            reference: value(f, "reference"),
          },
          { "Idempotency-Key": key },
        ),
    );
  }
  async function attendance(r: Row) {
    setError("");
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
    setError("");
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
  function announcement() {
    form(
      t("Publier une annonce", "نشر إعلان"),
      [
        select(
          "group_id",
          teacher ? "Groupe" : "Groupe (vide = tout le centre)",
          teacher ? "المجموعة" : "المجموعة (فارغة = جميع المركز)",
          opts(lookup.groups),
          undefined,
          teacher,
        ),
        text("title", "Titre", "العنوان"),
        text("body", "Message", "الرسالة", undefined, true, "textarea"),
      ],
      (f) =>
        api("announcements", "POST", {
          group_id: nullable(f, "group_id"),
          title: value(f, "title"),
          body: value(f, "body"),
        }),
    );
  }
  function material() {
    form(
      t("Partager un document", "مشاركة وثيقة"),
      [
        select(
          "group_id",
          "Groupe",
          "المجموعة",
          opts(lookup.groups),
          undefined,
          true,
        ),
        text("title", "Titre", "العنوان"),
        text(
          "file",
          "PDF, image ou texte — 5 Mo maximum",
          "PDF أو صورة أو نص — 5 ميغابايت كحد أقصى",
          undefined,
          true,
          "file",
        ),
      ],
      async (f) => {
        const file = f.get("file") as File;
        if (file.size > 5_000_000)
          throw new Error(
            t("Fichier limité à 5 Mo", "الملف أكبر من 5 ميغابايت"),
          );
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        return api("materials", "POST", {
          group_id: value(f, "group_id"),
          title: value(f, "title"),
          filename: file.name,
          mime: file.type || "text/plain",
          base64,
        });
      },
    );
  }
  function invite() {
    form(
      t("Inviter un utilisateur", "دعوة مستخدم"),
      [
        text("name", "Nom complet", "الاسم الكامل"),
        text("email", "Email", "البريد", undefined, true, "email"),
        select(
          "role",
          "Rôle",
          "الدور",
          (user?.role === "OWNER"
            ? ["MANAGER", "CASHIER", "TEACHER", "PARENT", "STUDENT"]
            : ["CASHIER", "TEACHER", "PARENT", "STUDENT"]
          ).map((value) => ({ value, label: tr(value) })),
          "TEACHER",
          true,
        ),
        select(
          "locale",
          "Langue",
          "اللغة",
          [
            { value: "fr", label: "Français" },
            { value: "ar", label: "العربية" },
          ],
          "fr",
          true,
        ),
      ],
      (f) =>
        api("auth/invite", "POST", {
          name: value(f, "name"),
          email: value(f, "email"),
          role: value(f, "role"),
          locale: value(f, "locale"),
        }),
    );
  }
  function closeCash() {
    form(
      t("Clôturer la caisse du jour", "إغلاق صندوق اليوم"),
      [
        text(
          "counted",
          "Espèces présentes dans le tiroir DA",
          "النقد الموجود في الصندوق دج",
          (cash?.expected_centimes ?? 0) / 100,
          true,
          "money",
        ),
        text(
          "notes",
          "Justification d’écart / notes",
          "تبرير الفرق / ملاحظات",
          undefined,
          false,
          "textarea",
        ),
      ],
      (f) =>
        api("cash/close", "POST", {
          day: cash?.day ?? today(),
          counted_centimes: cents(f.get("counted")),
          notes: value(f, "notes"),
        }),
    );
  }
  function payTeacher(r: Row) {
    form(
      t(`Régler · ${r.name}`, `تسديد · ${r.name}`),
      [
        text(
          "amount",
          "Montant DA",
          "المبلغ دج",
          Math.max(0, r.balance_centimes) / 100,
          true,
          "money",
        ),
        text("reference", "Référence / reçu", "المرجع / الإيصال"),
      ],
      (f) =>
        api("payroll", "POST", {
          teacher_id: r.id,
          month,
          amount_centimes: cents(f.get("amount")),
          reference: value(f, "reference"),
        }),
    );
  }
  function changePassword() {
    form(
      t("Changer mon mot de passe", "تغيير كلمة المرور"),
      [
        text(
          "current",
          "Mot de passe actuel",
          "كلمة المرور الحالية",
          undefined,
          true,
          "password",
        ),
        text(
          "password",
          "Nouveau mot de passe (12 caractères minimum)",
          "كلمة جديدة (12 حرفًا على الأقل)",
          undefined,
          true,
          "password",
        ),
      ],
      (f) =>
        api("auth/password", "POST", {
          current: value(f, "current"),
          password: value(f, "password"),
        }),
    );
  }
  function deleteAccount() {
    form(
      t("Supprimer mon compte personnel", "حذف حسابي الشخصي"),
      [
        text(
          "password",
          "Confirmez votre mot de passe. Les écritures financières sont conservées.",
          "أكد كلمة المرور. يتم الاحتفاظ بالسجلات المالية.",
          undefined,
          true,
          "password",
        ),
      ],
      async (f) => {
        await api("auth/delete-account", "POST", {
          password: value(f, "password"),
        });
        location.href = "/";
      },
    );
  }
  const filtered = rows.filter((r) =>
    Object.values(r).some(
      (v) =>
        typeof v === "string" && v.toLowerCase().includes(search.toLowerCase()),
    ),
  );
  function table(columns: string[], render: (r: Row) => ReactNode) {
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>{render(r)}</tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && (
          <div className="empty">
            <BookOpen size={30} />
            <h3>
              {t(
                search ? "Aucun résultat" : "Votre espace est prêt",
                search ? "لا توجد نتائج" : "مساحتك جاهزة",
              )}
            </h3>
            <p>
              {t(
                search
                  ? "Essayez un autre mot."
                  : "Ajoutez votre première entrée pour commencer.",
                search ? "جرب كلمة أخرى." : "أضف أول سجل للبدء.",
              )}
            </p>
          </div>
        )}
      </div>
    );
  }
  const editButton = (fn: () => void, label = t("Modifier", "تعديل")) => (
    <button className="text-button" onClick={fn} disabled={busy}>
      {label}
      <ChevronRight size={14} />
    </button>
  );
  const available = Object.keys(labels).filter(
    (p) =>
      !(["users", "audit", "settings"].includes(p) && !admin) &&
      !(["invoices", "payments"].includes(p) && !finance && !family) &&
      !(p === "payroll" && !finance && !teacher),
  );
  if (!user)
    return (
      <main className="boot">
        <span className="logo-mark">م</span>
        <p>{t("Ouverture de votre espace…", "جاري فتح المساحة…")}</p>
      </main>
    );
  return (
    <div className="workspace" dir={lang === "ar" ? "rtl" : "ltr"}>
      <aside className={`sidebar ${drawer ? "open" : ""}`}>
        <Link href="/" className="brand">
          <span className="logo-mark">م</span>
          <span>
            Midad<small>مداد</small>
          </span>
        </Link>
        <div className="school-tag">
          <span>{user.school.slice(0, 1)}</span>
          <div>
            {user.school}
            <small>{user.slug}</small>
          </div>
        </div>
        <div className="nav-caption">{t("VOTRE ÉTABLISSEMENT", "مؤسستك")}</div>
        <nav aria-label={t("Navigation principale", "التنقل الرئيسي")}>
          {available.map((p) => {
            const Icon = icons[p];
            return (
              <button
                key={p}
                aria-current={p === page ? "page" : undefined}
                className={p === page ? "active" : ""}
                onClick={() => navigate(p)}
              >
                <Icon size={19} />
                {labels[p][lang]}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="avatar">{user.name.slice(0, 1)}</div>
          <div>
            {user.name}
            <small>{tr(user.role)}</small>
          </div>
          <button
            title={t("Se déconnecter", "تسجيل الخروج")}
            onClick={() =>
              void action(async () => {
                await api("auth/logout", "POST", {});
                location.href = "/auth";
              })
            }
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      {drawer && (
        <button
          className="sidebar-shade"
          aria-label="Fermer"
          onClick={() => setDrawer(false)}
        />
      )}
      <div className="workspace-main">
        <header className="app-header">
          <button
            className="icon-button mobile-menu"
            onClick={() => setDrawer(!drawer)}
            aria-label="Menu"
          >
            <Menu />
          </button>
          <span className="breadcrumb">
            Midad <ChevronRight size={14} />
            <strong>{labels[page][lang]}</strong>
          </span>
          <div className="header-actions">
            <span className="connected">
              <i />
              {t("Espace sécurisé", "مساحة آمنة")}
            </span>
            <button
              className="lang-button"
              onClick={() => setLang(lang === "fr" ? "ar" : "fr")}
            >
              {lang === "fr" ? "العربية" : "Français"}
            </button>
            <button
              className="icon-button"
              title={labels.notifications[lang]}
              onClick={() => navigate("notifications")}
            >
              <Bell size={19} />
            </button>
          </div>
        </header>
        <main className="app-content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {today()} · {user.school}
              </p>
              <h1>
                {page === "dashboard"
                  ? t("Tableau de bord", "لوحة التحكم")
                  : labels[page][lang]}
              </h1>
              <p>
                {page === "dashboard"
                  ? t(
                      "Tout ce qui compte pour votre journée, au même endroit.",
                      "كل ما تحتاجه ليومك في مكان واحد.",
                    )
                  : t(
                      "Des informations à jour, partagées avec les bonnes personnes.",
                      "معلومات محدثة، متاحة للأشخاص المناسبين.",
                    )}
              </p>
            </div>
            <div className="page-actions">
              {page === "dashboard" && (
                <button
                  className="button secondary"
                  onClick={() => void load()}
                >
                  <CalendarDays size={16} />
                  {new Date().toLocaleDateString(
                    lang === "fr" ? "fr-DZ" : "ar-DZ",
                    {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      timeZone: "Africa/Algiers",
                    },
                  )}
                </button>
              )}
              {page === "students" && admin && (
                <button className="button" onClick={() => studentForm()}>
                  <Plus size={17} />
                  {t("Nouvel élève", "تلميذ جديد")}
                </button>
              )}
              {page === "groups" && admin && (
                <button className="button" onClick={() => groupForm()}>
                  <Plus size={17} />
                  {t("Nouveau groupe", "مجموعة جديدة")}
                </button>
              )}
              {page === "sessions" && teach && (
                <button className="button" onClick={() => sessionForm()}>
                  <Plus size={17} />
                  {t("Planifier", "جدولة")}
                </button>
              )}
              {page === "invoices" && finance && (
                <>
                  <button className="button secondary" onClick={generate}>
                    {t("Générer le mois", "فوترة الشهر")}
                  </button>
                  <button className="button" onClick={invoiceForm}>
                    <Plus size={17} />
                    {t("Échéance", "مستحق")}
                  </button>
                </>
              )}
              {page === "announcements" && teach && (
                <button className="button" onClick={announcement}>
                  <Plus size={17} />
                  {t("Annonce", "إعلان")}
                </button>
              )}
              {page === "materials" && teach && (
                <button className="button" onClick={material}>
                  <Plus size={17} />
                  {t("Document", "وثيقة")}
                </button>
              )}
              {page === "users" && admin && (
                <button className="button" onClick={invite}>
                  <Plus size={17} />
                  {t("Inviter", "دعوة")}
                </button>
              )}
              {page === "notifications" && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    void action(() => api("notifications/read", "POST", {}))
                  }
                >
                  {t("Tout marquer comme lu", "تحديد الكل كمقروء")}
                </button>
              )}
            </div>
          </div>
          {!user.verified && (
            <div className="verification">
              <Shield size={22} />
              <div>
                <strong>
                  {t(
                    "Vérifiez votre adresse email pour commencer.",
                    "أكد بريدك الإلكتروني للبدء.",
                  )}
                </strong>
                <p>
                  {t(
                    `Un lien a été envoyé à ${user.email}.`,
                    `تم إرسال رابط إلى ${user.email}.`,
                  )}
                </p>
              </div>
              <button
                className="text-button"
                disabled={busy}
                onClick={() =>
                  void action(
                    () => api("auth/resend", "POST", {}),
                    t("Email envoyé", "تم إرسال البريد"),
                  )
                }
              >
                {t("Renvoyer le lien", "إعادة إرسال الرابط")}
              </button>
              <button
                className="text-button"
                onClick={() => void api("auth/me").then(setUser)}
              >
                {t("Actualiser", "تحديث")}
              </button>
            </div>
          )}
          {error && (
            <div className="alert error" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Fermer">
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="alert success" role="status">
              <Check size={18} />
              {notice}
            </div>
          )}
          {loading && page !== "sessions" ? (
            <div className="loading-panel" aria-live="polite">
              <span className="spinner" />
              {t("Chargement…", "جاري التحميل…")}
            </div>
          ) : (
            <>
              {page === "dashboard" && (
                <Overview
                  data={dashboard}
                  user={user}
                  lang={lang}
                  navigate={navigate}
                  onStudent={() => studentForm()}
                  onSession={() => sessionForm()}
                  attendance={(r) => void attendance(r)}
                />
              )}
              {![
                "dashboard",
                "settings",
                "sessions",
                "announcements",
                "notifications",
              ].includes(page) && (
                <div className="toolbar">
                  <label className="search">
                    <Search size={18} />
                    <input
                      aria-label={t("Rechercher", "بحث")}
                      placeholder={t(
                        "Rechercher dans cette liste…",
                        "البحث في القائمة…",
                      )}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <span>
                    {filtered.length} {t("résultat(s)", "نتائج")}
                  </span>
                  {page === "payroll" && (
                    <input
                      aria-label="Mois"
                      type="month"
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                    />
                  )}
                  <button className="text-button" onClick={() => void load()}>
                    {t("Actualiser", "تحديث")}
                  </button>
                </div>
              )}
              {page === "students" &&
                table(
                  [
                    t("Élève", "التلميذ"),
                    t("Niveau", "المستوى"),
                    t("Contact", "التواصل"),
                    t("Parent", "الولي"),
                    "",
                  ],
                  (r) => (
                    <>
                      <td>
                        <div className="person">
                          <span className="avatar light">
                            {r.name.slice(0, 1)}
                          </span>
                          <strong>{r.name}</strong>
                        </div>
                      </td>
                      <td>{r.level || "—"}</td>
                      <td>{r.phone || "—"}</td>
                      <td>{r.parent_name || "—"}</td>
                      <td className="actions">
                        {admin && (
                          <>
                            {editButton(() => studentForm(r))}
                            {editButton(
                              () =>
                                form(
                                  t("Archiver le dossier", "أرشفة الملف"),
                                  [
                                    text(
                                      "confirm",
                                      `Saisissez « ${r.name} » pour archiver ce dossier (factures conservées)`,
                                      `اكتب « ${r.name} » لأرشفة الملف (الفواتير محفوظة)`,
                                    ),
                                  ],
                                  (f) => {
                                    if (value(f, "confirm") !== r.name)
                                      throw new Error(
                                        t(
                                          "Le nom ne correspond pas",
                                          "الاسم غير مطابق",
                                        ),
                                      );
                                    return api(`students/${r.id}`, "DELETE");
                                  },
                                ),
                              t("Archiver", "أرشفة"),
                            )}
                          </>
                        )}
                      </td>
                    </>
                  ),
                )}
              {page === "groups" &&
                table(
                  [
                    t("Groupe", "المجموعة"),
                    t("Enseignant", "الأستاذ"),
                    t("Inscrits", "المسجلون"),
                    t("Salle", "القاعة"),
                    t("Tarif / mois", "التعريفة / الشهر"),
                    "",
                  ],
                  (r) => (
                    <>
                      <td>
                        <strong>{r.name}</strong>
                        <small className="subtext">
                          {r.subject} · {r.level}
                        </small>
                      </td>
                      <td>{r.teacher_name || "—"}</td>
                      <td>
                        <span className="badge">
                          {r.student_count} / {r.capacity}
                        </span>
                      </td>
                      <td>{r.room || "—"}</td>
                      <td>{money(r.fee_centimes)}</td>
                      <td className="actions">
                        {editButton(
                          () => void roster(r),
                          t("Inscrits", "المسجلون"),
                        )}
                        {admin && editButton(() => groupForm(r))}
                      </td>
                    </>
                  ),
                )}
              {page === "sessions" && (
                <>
                  {teach && (
                    <RecurringPlanning
                      groups={lookup.groups}
                      closures={schoolClosures}
                      admin={admin}
                      lang={lang}
                      onChanged={() => void load()}
                    />
                  )}
                  <PlanningCalendar
                    closures={schoolClosures}
                    rows={rows.filter((r) => r.starts_at && r.ends_at)}
                    groups={lookup.groups}
                    lang={lang}
                    canEdit={teach}
                    busy={busy || loading}
                    onCreate={sessionForm}
                    onEdit={sessionForm}
                    onStatus={sessionStatus}
                    onAttendance={(r) => void attendance(r)}
                    onRefresh={() => void load()}
                    onRangeChange={calendarRange}
                  />
                </>
              )}
              {page === "invoices" &&
                table(
                  [
                    t("Élève / échéance", "التلميذ / المستحق"),
                    t("Date limite", "تاريخ الاستحقاق"),
                    t("Montant", "المبلغ"),
                    t("Payé", "المدفوع"),
                    t("Solde", "الرصيد"),
                    "",
                  ],
                  (r) => (
                    <>
                      <td>
                        <strong>{r.student_name}</strong>
                        <small className="subtext">{r.label}</small>
                      </td>
                      <td>{r.due_date}</td>
                      <td>{money(r.amount_centimes)}</td>
                      <td>{money(r.paid_centimes)}</td>
                      <td>
                        <span
                          className={`badge ${r.status === "cancelled" ? "cancelled" : r.balance_centimes > 0 ? "pending" : "completed"}`}
                        >
                          {r.status === "cancelled"
                            ? tr("cancelled")
                            : money(r.balance_centimes)}
                        </span>
                      </td>
                      <td className="actions">
                        {finance && r.status === "open" && (
                          <>
                            {r.balance_centimes > 0 &&
                              editButton(
                                () => paymentForm(r),
                                t("Encaisser", "تحصيل"),
                              )}
                            {r.paid_centimes === 0 &&
                              editButton(
                                () =>
                                  form(
                                    t(
                                      "Annuler cette échéance",
                                      "إلغاء هذا المستحق",
                                    ),
                                    [
                                      text(
                                        "confirm",
                                        "Saisissez ANNULER",
                                        "اكتب ANNULER",
                                      ),
                                    ],
                                    (f) => {
                                      if (value(f, "confirm") !== "ANNULER")
                                        throw new Error(
                                          t(
                                            "Confirmation incorrecte",
                                            "تأكيد غير صحيح",
                                          ),
                                        );
                                      return api(
                                        `invoices/${r.id}/cancel`,
                                        "POST",
                                        {},
                                      );
                                    },
                                  ),
                                t("Annuler", "إلغاء"),
                              )}
                          </>
                        )}
                      </td>
                    </>
                  ),
                )}
              {page === "payments" && (
                <>
                  {finance && cash && (
                    <section className="cash-panel">
                      <Wallet />
                      <div>
                        <strong>
                          {t("Caisse du jour", "صندوق اليوم")} · {cash.day}
                        </strong>
                        <p>
                          {t(
                            "Mouvements nets en espèces",
                            "صافي الحركات النقدية",
                          )}{" "}
                          : {money(cash.net_centimes)}
                          <small className="subtext">
                            {t("Fond initial", "الرصيد الافتتاحي")}:{" "}
                            {money(cash.opening_centimes)} ·{" "}
                            {t("Attendu dans le tiroir", "المتوقع في الصندوق")}:{" "}
                            {money(cash.expected_centimes)}
                          </small>
                        </p>
                        {cash.closure && (
                          <small>
                            {t("Clôturée — écart", "مغلق — الفرق")} :{" "}
                            {money(
                              cash.closure.counted_centimes -
                                cash.closure.expected_centimes,
                            )}
                          </small>
                        )}
                      </div>
                      {!cash.closure && !cash.opened && (
                        <button
                          className="button secondary"
                          onClick={() =>
                            form(
                              t(
                                "Fond de caisse initial",
                                "الرصيد الافتتاحي للصندوق",
                              ),
                              [
                                text(
                                  "amount",
                                  "Fond initial DA (enregistré une seule fois)",
                                  "الرصيد الافتتاحي دج (يسجل مرة واحدة)",
                                  0,
                                  true,
                                  "money",
                                ),
                              ],
                              (f) =>
                                api("cash/open", "POST", {
                                  amount_centimes: cents(f.get("amount")),
                                }),
                            )
                          }
                        >
                          {t("Fond initial", "الرصيد الافتتاحي")}
                        </button>
                      )}
                      {!cash.closure && (
                        <button
                          className="button secondary"
                          onClick={closeCash}
                        >
                          {t("Clôturer", "إغلاق")}
                        </button>
                      )}
                    </section>
                  )}
                  {table(
                    [
                      t("Reçu", "الإيصال"),
                      t("Élève", "التلميذ"),
                      t("Date", "التاريخ"),
                      t("Mode", "الوسيلة"),
                      t("Montant", "المبلغ"),
                      "",
                    ],
                    (r) => (
                      <>
                        <td>
                          #{r.receipt_number}
                          <small className="subtext">{tr(r.kind)}</small>
                        </td>
                        <td>
                          <strong>{r.student_name}</strong>
                          <small className="subtext">{r.invoice_label}</small>
                        </td>
                        <td>{localDate(r.created_at)}</td>
                        <td>
                          {tr(r.method)}
                          <small className="subtext">{r.reference}</small>
                        </td>
                        <td className={r.kind === "refund" ? "negative" : ""}>
                          {r.kind === "refund" ? "−" : ""}
                          {money(r.amount_centimes)}
                        </td>
                        <td className="actions">
                          {editButton(
                            () =>
                              setDetail({
                                kind: "receipt",
                                row: { ...r, label: r.invoice_label },
                                rows: [],
                              }),
                            t("Reçu", "إيصال"),
                          )}
                          {finance &&
                            r.kind === "payment" &&
                            editButton(
                              () => refundForm(r),
                              t("Rembourser", "استرداد"),
                            )}
                        </td>
                      </>
                    ),
                  )}
                </>
              )}
              {page === "payroll" &&
                table(
                  [
                    t("Enseignant", "الأستاذ"),
                    t("Calculé", "المحسوب"),
                    t("Réglé", "المسدد"),
                    t("Restant", "المتبقي"),
                    "",
                  ],
                  (r) => (
                    <>
                      <td>
                        <strong>{r.name}</strong>
                        <small className="subtext">
                          {r.groups
                            .map(
                              (g: Row) =>
                                `${g.name}: ${g.session_count} ${t("séances", "حصص")} / ${g.hours.toFixed(1)} h`,
                            )
                            .join(" · ")}
                        </small>
                      </td>
                      <td>{money(r.earned_centimes)}</td>
                      <td>{money(r.paid_centimes)}</td>
                      <td>{money(r.balance_centimes)}</td>
                      <td>
                        {finance &&
                          r.balance_centimes > 0 &&
                          editButton(() => payTeacher(r), t("Régler", "تسديد"))}
                      </td>
                    </>
                  ),
                )}
              {page === "users" && (
                <>
                  <p className="help-note">
                    {t(
                      "Invitez les parents et enseignants, puis associez leurs comptes aux dossiers élèves et groupes.",
                      "ادعُ الأولياء والأساتذة ثم اربط حساباتهم بملفات التلاميذ والمجموعات.",
                    )}
                  </p>
                  {table(
                    [
                      t("Utilisateur", "المستخدم"),
                      t("Email", "البريد"),
                      t("Rôle", "الدور"),
                      t("Statut", "الحالة"),
                      "",
                    ],
                    (r) => (
                      <>
                        <td>
                          <strong>{r.name}</strong>
                        </td>
                        <td>{r.email}</td>
                        <td>
                          <span className="badge">{tr(r.role)}</span>
                        </td>
                        <td>
                          {r.active
                            ? r.verified
                              ? t("Actif", "نشط")
                              : t("Invitation en attente", "دعوة معلقة")
                            : t("Désactivé", "معطل")}
                        </td>
                        <td>
                          {user.role === "OWNER" &&
                            r.id !== user.id &&
                            r.role !== "OWNER" &&
                            editButton(
                              () =>
                                void action(() =>
                                  api(`users/${r.id}`, "PATCH", {
                                    active: !r.active,
                                  }),
                                ),
                              r.active
                                ? t("Désactiver", "تعطيل")
                                : t("Réactiver", "تفعيل"),
                            )}
                        </td>
                      </>
                    ),
                  )}
                </>
              )}
              {page === "audit" &&
                table(
                  [
                    t("Date", "التاريخ"),
                    t("Utilisateur", "المستخدم"),
                    t("Action", "الإجراء"),
                    t("Détails", "التفاصيل"),
                  ],
                  (r) => (
                    <>
                      <td>{localDate(r.created_at)}</td>
                      <td>{r.actor}</td>
                      <td>
                        <code>{r.action}</code>
                      </td>
                      <td>
                        <small>{JSON.stringify(r.detail)}</small>
                      </td>
                    </>
                  ),
                )}
              {page === "materials" &&
                table(
                  [
                    t("Document", "الوثيقة"),
                    t("Groupe", "المجموعة"),
                    t("Ajouté le", "تاريخ الإضافة"),
                    "",
                  ],
                  (r) => (
                    <>
                      <td>
                        <strong>{r.title}</strong>
                        <small className="subtext">{r.filename}</small>
                      </td>
                      <td>{r.group_name}</td>
                      <td>{localDate(r.created_at)}</td>
                      <td className="actions">
                        <a
                          className="text-button"
                          href={`${API}/materials/${r.id}`}
                          download
                        >
                          <Download size={16} />
                          {t("Télécharger", "تحميل")}
                        </a>
                        {teach &&
                          editButton(
                            () =>
                              form(
                                t("Supprimer le document", "حذف الوثيقة"),
                                [
                                  text(
                                    "confirm",
                                    "Saisissez SUPPRIMER",
                                    "اكتب SUPPRIMER",
                                  ),
                                ],
                                (f) => {
                                  if (value(f, "confirm") !== "SUPPRIMER")
                                    throw new Error("Confirmation incorrecte");
                                  return api(`materials/${r.id}`, "DELETE");
                                },
                              ),
                            t("Supprimer", "حذف"),
                          )}
                      </td>
                    </>
                  ),
                )}
              {["announcements", "notifications"].includes(page) && (
                <div className="message-grid">
                  {rows.length ? (
                    rows.map((r) => (
                      <article
                        className={`panel message ${page === "notifications" && !r.seen ? "unread" : ""}`}
                        key={r.id}
                      >
                        <div className="message-meta">
                          <span className="badge">
                            {r.group_name || t("Établissement", "المؤسسة")}
                          </span>
                          <small>{localDate(r.created_at)}</small>
                        </div>
                        <h2>{r.title}</h2>
                        <p>{r.body}</p>
                        <div className="message-footer">
                          <small>{r.author || ""}</small>
                          {page === "notifications" && !r.seen && (
                            <button
                              className="text-button"
                              disabled={busy}
                              onClick={() =>
                                void action(() =>
                                  api("notifications/read", "POST", {
                                    id: r.id,
                                  }),
                                )
                              }
                            >
                              {t("Marquer comme lu", "تحديد كمقروء")}
                              <Check size={16} />
                            </button>
                          )}
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="panel empty">
                      <Megaphone size={32} />
                      <h3>
                        {t(
                          "Aucun message pour le moment",
                          "لا توجد رسائل حاليًا",
                        )}
                      </h3>
                    </div>
                  )}
                </div>
              )}
              {page === "settings" && (
                <div className="settings-grid">
                  <section className="panel">
                    <h2>{t("Votre établissement", "مؤسستك")}</h2>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        void action(() =>
                          api("settings", "PATCH", {
                            name: value(f, "name"),
                            phone: value(f, "phone"),
                            address: value(f, "address"),
                            locale: value(f, "locale"),
                          }),
                        );
                      }}
                    >
                      <label>
                        {t("Nom", "الاسم")}
                        <input
                          name="name"
                          required
                          defaultValue={settings.name}
                        />
                      </label>
                      <label>
                        {t("Téléphone", "الهاتف")}
                        <input name="phone" defaultValue={settings.phone} />
                      </label>
                      <label>
                        {t("Adresse", "العنوان")}
                        <textarea
                          name="address"
                          defaultValue={settings.address}
                        />
                      </label>
                      <label>
                        {t("Langue par défaut", "اللغة الافتراضية")}
                        <select name="locale" defaultValue={settings.locale}>
                          <option value="fr">Français</option>
                          <option value="ar">العربية</option>
                        </select>
                      </label>
                      <label>
                        {t("Identifiant de connexion", "معرف الدخول")}
                        <input readOnly value={settings.slug ?? ""} />
                      </label>
                      <button className="button" disabled={busy}>
                        {t("Enregistrer", "حفظ")}
                      </button>
                    </form>
                  </section>
                  <section className="panel">
                    <h2>{t("Données & compte", "البيانات والحساب")}</h2>
                    <p>
                      {t(
                        "Exportez les données de gestion de votre centre dans un fichier JSON. Les sauvegardes complètes sont gérées sur le serveur.",
                        "صدّر بيانات تسيير مركزك بصيغة JSON. تُدار النسخ الاحتياطية الكاملة على الخادم.",
                      )}
                    </p>
                    <a
                      className="button secondary"
                      href={`${API}/export`}
                      download
                    >
                      <Download size={16} />
                      {t("Exporter les données", "تصدير البيانات")}
                    </a>
                    <div className="settings-separator" />
                    <button
                      className="button secondary"
                      onClick={changePassword}
                    >
                      {t("Changer mon mot de passe", "تغيير كلمة المرور")}
                    </button>
                    {user.role === "OWNER" && (
                      <>
                        <h3>{t("Transférer la propriété", "نقل الملكية")}</h3>
                        <p>
                          {t(
                            "Le nouveau propriétaire doit être un responsable actif. Vous deviendrez responsable.",
                            "يجب أن يكون المالك الجديد مسؤولًا نشطًا. ستصبح مسؤولًا.",
                          )}
                        </p>
                        <button
                          className="text-button"
                          onClick={() =>
                            form(
                              t("Transférer la propriété", "نقل الملكية"),
                              [
                                select(
                                  "user_id",
                                  "Nouveau propriétaire",
                                  "المالك الجديد",
                                  opts(
                                    lookup.users.filter(
                                      (u) =>
                                        u.role === "MANAGER" &&
                                        u.active &&
                                        u.verified,
                                    ),
                                  ),
                                  undefined,
                                  true,
                                ),
                                text(
                                  "confirm",
                                  "Saisissez TRANSFERER",
                                  "اكتب TRANSFERER",
                                ),
                              ],
                              async (f) => {
                                if (value(f, "confirm") !== "TRANSFERER")
                                  throw new Error("Confirmation incorrecte");
                                await api("ownership", "POST", {
                                  user_id: value(f, "user_id"),
                                });
                                setUser(await api("auth/me"));
                              },
                            )
                          }
                        >
                          {t("Choisir un responsable", "اختيار مسؤول")}
                        </button>
                      </>
                    )}
                  </section>
                </div>
              )}
            </>
          )}
          <footer className="app-footer">
            <span>Midad · مداد</span>
            <div>
              <button onClick={changePassword}>
                {t("Mon mot de passe", "كلمة المرور")}
              </button>
              {user.role !== "OWNER" && (
                <button onClick={deleteAccount}>
                  {t("Supprimer mon compte", "حذف حسابي")}
                </button>
              )}
              <Link href="/legal">{t("Confidentialité", "الخصوصية")}</Link>
            </div>
          </footer>
        </main>
      </div>
      {editor && (
        <EditorDialog
          editor={editor}
          lang={lang}
          close={() => setEditor(null)}
          save={async (f) => {
            await editor.save(f);
            setEditor(null);
            setNotice(t("Enregistré", "تم الحفظ"));
            await load();
          }}
        />
      )}
      {detail && (
        <Dialog
          title={
            detail.kind === "attendance"
              ? t("Feuille de présence", "ورقة الحضور")
              : detail.kind === "roster"
                ? detail.row.name
                : t("Reçu de paiement", "إيصال الدفع")
          }
          close={() => setDetail(null)}
        >
          {detail.kind === "attendance" && (
            <>
              <p className="help-note">
                {detail.row.group_name} · {localDate(detail.row.starts_at)}
              </p>
              <div className="attendance-list">
                {detail.rows.map((s, i) => (
                  <div key={s.student_id} className="attendance-person">
                    <strong>{s.name}</strong>
                    <select
                      aria-label={`${t("Présence", "الحضور")} ${s.name}`}
                      disabled={!teach || detail.row.status === "cancelled"}
                      value={s.status}
                      onChange={(e) =>
                        setDetail({
                          ...detail,
                          rows: detail.rows.map((x, j) =>
                            j === i ? { ...x, status: e.target.value } : x,
                          ),
                        })
                      }
                    >
                      {["unmarked", "present", "absent", "late"].map(
                        (status) => (
                          <option key={status} value={status}>
                            {tr(status)}
                          </option>
                        ),
                      )}
                    </select>
                    {s.justification && (
                      <div className="justification">
                        <p>{s.justification}</p>
                        <small>{tr(s.decision)}</small>
                        {teach && s.decision === "pending" && (
                          <div className="actions">
                            {["accepted", "rejected"].map((d) => (
                              <button
                                className="text-button"
                                key={d}
                                disabled={busy}
                                onClick={() =>
                                  void action(async () => {
                                    await api(
                                      `sessions/${detail.row.id}/decision`,
                                      "POST",
                                      { student_id: s.student_id, decision: d },
                                    );
                                    await attendance(detail.row);
                                  })
                                }
                              >
                                {tr(d)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {family && ["absent", "late"].includes(s.status) && (
                      <button
                        className="text-button"
                        onClick={() =>
                          form(
                            t("Justifier une absence", "تبرير غياب"),
                            [
                              text(
                                "justification",
                                "Votre justificatif",
                                "تبريرك",
                                s.justification,
                                true,
                                "textarea",
                              ),
                            ],
                            async (f) => {
                              await api(
                                `sessions/${detail.row.id}/justify`,
                                "POST",
                                {
                                  student_id: s.student_id,
                                  justification: value(f, "justification"),
                                },
                              );
                              await attendance(detail.row);
                            },
                          )
                        }
                      >
                        {t("Justifier", "تبرير")}
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {!detail.rows.length && (
                <p>{t("Aucun élève inscrit.", "لا يوجد تلاميذ مسجلون.")}</p>
              )}
              {teach &&
                detail.rows.length > 0 &&
                detail.row.status !== "cancelled" && (
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() =>
                      void action(() =>
                        api(`sessions/${detail.row.id}/attendance`, "PUT", {
                          entries: detail.rows.map((s) => ({
                            student_id: s.student_id,
                            status: s.status,
                          })),
                        }),
                      )
                    }
                  >
                    {t("Enregistrer les présences", "حفظ الحضور")}
                  </button>
                )}
            </>
          )}
          {detail.kind === "roster" && (
            <>
              <p>
                {detail.rows.length} / {detail.row.capacity}{" "}
                {t("places", "أماكن")}
              </p>
              {detail.rows.map((s) => (
                <div className="roster-person" key={s.id}>
                  <strong>{s.name}</strong>
                  <small>{s.level}</small>
                  {admin && (
                    <button
                      disabled={busy}
                      className="text-button"
                      onClick={() =>
                        void action(async () => {
                          await api(
                            `groups/${detail.row.id}/enroll/${s.id}`,
                            "DELETE",
                          );
                          await roster(detail.row);
                        })
                      }
                    >
                      {t("Retirer du groupe", "إزالة من المجموعة")}
                    </button>
                  )}
                </div>
              ))}
              {admin && (
                <button
                  className="button"
                  onClick={() =>
                    form(
                      t("Inscrire au groupe", "التسجيل في المجموعة"),
                      [
                        select(
                          "student_id",
                          "Élève",
                          "التلميذ",
                          opts(
                            lookup.students.filter(
                              (s) => !detail.rows.some((r) => r.id === s.id),
                            ),
                          ),
                          undefined,
                          true,
                        ),
                      ],
                      async (f) => {
                        await api(`groups/${detail.row.id}/enroll`, "POST", {
                          student_id: value(f, "student_id"),
                        });
                        await roster(detail.row);
                      },
                    )
                  }
                >
                  <Plus size={16} />
                  {t("Inscrire un élève", "تسجيل تلميذ")}
                </button>
              )}
            </>
          )}
          {detail.kind === "receipt" && (
            <div className="receipt">
              <div className="receipt-brand">
                <span className="logo-mark">م</span>
                <h2>{user.school}</h2>
              </div>
              <span className="eyebrow">
                {t("REÇU", "إيصال")} #{detail.row.receipt_number}
              </span>
              <h2>{money(detail.row.amount_centimes)}</h2>
              <dl>
                {[
                  [t("Nature", "النوع"), tr(detail.row.kind)],
                  [t("Élève", "التلميذ"), detail.row.student_name],
                  [t("Libellé", "الوصف"), detail.row.label],
                  [t("Date", "التاريخ"), localDate(detail.row.created_at)],
                  [t("Mode", "الوسيلة"), tr(detail.row.method)],
                  [t("Référence", "المرجع"), detail.row.reference || "—"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              <p>
                {t(
                  "Paiement enregistré par l’établissement. Ce reçu ne constitue pas une facture fiscale.",
                  "دفع مسجل من المؤسسة. هذا الإيصال ليس فاتورة ضريبية.",
                )}
              </p>
              <button
                className="button print-hidden"
                onClick={() => window.print()}
              >
                {t("Imprimer / PDF", "طباعة / PDF")}
              </button>
            </div>
          )}
        </Dialog>
      )}
    </div>
  );
}
function Dialog({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog ref={ref} className="dialog" onCancel={close}>
      <div className="dialog-header">
        <h2>{title}</h2>
        <button
          className="icon-button print-hidden"
          aria-label="Fermer / إغلاق"
          onClick={close}
        >
          <X size={20} />
        </button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
function EditorDialog({
  editor,
  lang,
  close,
  save,
}: {
  editor: Editor;
  lang: "fr" | "ar";
  close: () => void;
  save: (f: FormData) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await save(new FormData(e.currentTarget));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title={editor.title} close={close}>
      <form onSubmit={submit}>
        <div className="form-grid">
          {editor.fields.map((f) => (
            <label key={f.key} className={f.type === "textarea" ? "wide" : ""}>
              {lang === "fr" ? f.fr : f.ar}
              {f.type === "select" ? (
                <select
                  name={f.key}
                  defaultValue={String(f.value ?? "")}
                  required={f.required}
                >
                  <option value="">
                    — {lang === "fr" ? "Choisir" : "اختيار"} —
                  </option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  rows={4}
                  name={f.key}
                  defaultValue={String(f.value ?? "")}
                  required={f.required}
                  maxLength={10000}
                />
              ) : (
                <input
                  name={f.key}
                  type={f.type === "money" ? "text" : (f.type ?? "text")}
                  inputMode={f.type === "money" ? "decimal" : undefined}
                  pattern={
                    f.type === "money" ? "[0-9]+([.,][0-9]{1,2})?" : undefined
                  }
                  accept={
                    f.type === "file" ? ".pdf,.png,.jpg,.jpeg,.txt" : undefined
                  }
                  min={f.type === "number" ? 1 : undefined}
                  minLength={
                    f.type === "password" && f.key === "password"
                      ? 12
                      : undefined
                  }
                  defaultValue={
                    f.type === "file" ? undefined : String(f.value ?? "")
                  }
                  required={f.required}
                />
              )}
            </label>
          ))}
        </div>
        {error && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}
        <div className="dialog-actions">
          <button className="button secondary" type="button" onClick={close}>
            {lang === "fr" ? "Fermer" : "إغلاق"}
          </button>
          <button className="button" disabled={busy}>
            {busy
              ? lang === "fr"
                ? "Enregistrement…"
                : "جاري الحفظ…"
              : lang === "fr"
                ? "Confirmer"
                : "تأكيد"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
