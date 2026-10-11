import { z } from "zod";
export const roles = [
  "OWNER",
  "MANAGER",
  "CASHIER",
  "TEACHER",
  "PARENT",
  "STUDENT",
] as const;
export type Role = (typeof roles)[number];
export const financeRoles: readonly Role[] = ["OWNER", "MANAGER", "CASHIER"];
export const adminRoles: readonly Role[] = ["OWNER", "MANAGER"];
export const email = z
  .email()
  .max(254)
  .transform((v) => v.toLowerCase().trim());
export const name = z.string().trim().min(2).max(120);
export const password = z.string().min(12).max(128);
export const id = z.uuid();
export const money = z.number().int().min(1).max(100_000_000_000);
export const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Date invalide",
  );
export const registration = z.object({
  school: name,
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{2,39}$/),
  name,
  email,
  password,
  phone: z.string().trim().max(30).default(""),
  locale: z.enum(["fr", "ar"]).default("fr"),
});
export const login = z.object({
  slug: z.string().min(3).max(40),
  email,
  password: z.string().min(1).max(128),
});
export const studentInput = z.object({
  name,
  phone: z.string().max(30).default(""),
  level: z.string().max(100).default(""),
  birth_date: day.nullish(),
  parent_id: id.nullish(),
  user_id: id.nullish(),
});
export const groupInput = z
  .object({
    name,
    subject: name,
    level: z.string().max(100).default(""),
    teacher_id: id.nullish(),
    room: z.string().max(100).default(""),
    capacity: z.number().int().min(1).max(500),
    fee_centimes: z.number().int().min(0).max(100_000_000_000),
    pay_mode: z.enum(["session", "hour", "percent"]).default("session"),
    pay_value: z.number().int().min(0).max(100_000_000).default(0),
  })
  .refine(
    (v) => v.pay_mode !== "percent" || v.pay_value <= 10000,
    "Pourcentage invalide",
  );
export const sessionInput = z
  .object({
    group_id: id,
    starts_at: z.iso.datetime({ offset: true }),
    ends_at: z.iso.datetime({ offset: true }),
    room: z.string().max(100).default(""),
    notes: z.string().max(2000).default(""),
  })
  .refine(
    (v) =>
      Date.parse(v.ends_at) > Date.parse(v.starts_at) &&
      Date.parse(v.ends_at) - Date.parse(v.starts_at) <= 86400000,
    "Durée invalide",
  );
export const invoiceInput = z.object({
  student_id: id,
  group_id: id.nullish(),
  label: name,
  amount_centimes: money,
  due_date: day,
});
export const paymentInput = z.object({
  invoice_id: id,
  amount_centimes: money,
  method: z.enum(["cash", "bank_transfer", "ccp", "card_external"]),
  reference: z.string().max(200).default(""),
});
export const attendanceInput = z
  .object({
    entries: z
      .array(
        z.object({
          student_id: id,
          status: z.enum(["present", "absent", "late", "unmarked"]),
        }),
      )
      .min(1)
      .max(500),
  })
  .refine(
    (v) =>
      new Set(v.entries.map((e) => e.student_id)).size === v.entries.length,
    "Élèves dupliqués",
  );
export type User = {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  role: Role;
  locale: "fr" | "ar";
  school: string;
  slug: string;
  verified: boolean;
};
export function dinars(centimes: number, locale = "fr") {
  return new Intl.NumberFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", {
    style: "currency",
    currency: "DZD",
  }).format(centimes / 100);
}
export * from "./calendar";
export const labels: Record<string, { fr: string; ar: string }> = {
  dashboard: { fr: "Vue d’ensemble", ar: "نظرة عامة" },
  students: { fr: "Élèves & familles", ar: "التلاميذ والعائلات" },
  groups: { fr: "Groupes & cours", ar: "المجموعات والدروس" },
  sessions: { fr: "Planning & présences", ar: "الجدول والحضور" },
  invoices: { fr: "Échéances", ar: "المستحقات" },
  payments: { fr: "Caisse & reçus", ar: "الصندوق والإيصالات" },
  payroll: { fr: "Rémunérations", ar: "مستحقات الأساتذة" },
  announcements: { fr: "Annonces", ar: "الإعلانات" },
  materials: { fr: "Documents", ar: "الوثائق" },
  notifications: { fr: "Notifications", ar: "الإشعارات" },
  users: { fr: "Équipe & accès", ar: "الفريق والصلاحيات" },
  audit: { fr: "Historique", ar: "السجل" },
  settings: { fr: "Établissement", ar: "المؤسسة" },
};
