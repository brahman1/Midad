import {
  All,
  Controller,
  Req,
  Res,
  UseGuards,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  StreamableFile,
} from "@nestjs/common";
import { Response } from "express";
import { PoolClient } from "pg";
import { z } from "zod";
import {
  adminRoles,
  financeRoles,
  studentInput,
  groupInput,
  sessionInput,
  invoiceInput,
  paymentInput,
  attendanceInput,
  money,
  day,
  id,
  name,
  User,
} from "@midad/shared";
import { db, transaction } from "./db";
import {
  AuthGuard,
  AuthRequest,
  permit,
  parse,
  uid,
  uuid,
  hash,
} from "./security";
import { notify } from "./mail";
import { planningRoute, ensureSchoolOpen } from "./planning";
type DB = PoolClient | typeof db;
async function record(
  c: DB,
  u: User,
  action: string,
  entity: string,
  detail: unknown = {},
) {
  await c.query(
    "INSERT INTO audit(id,tenant_id,user_id,action,entity_id,detail) VALUES($1,$2,$3,$4,$5,$6)",
    [uid(), u.tenant_id, u.id, action, entity, JSON.stringify(detail)],
  );
}
function scope(
  u: User,
  alias: string,
  index: number,
): { sql: string; args: string[] } {
  if (u.role === "TEACHER")
    return { sql: ` AND ${alias}.teacher_id=$${index}`, args: [u.id] };
  if (["PARENT", "STUDENT"].includes(u.role))
    return {
      sql: ` AND EXISTS(SELECT 1 FROM enrollments e JOIN students sx ON sx.id=e.student_id AND sx.tenant_id=e.tenant_id WHERE e.tenant_id=${alias}.tenant_id AND e.group_id=${alias}.id AND sx.active AND (sx.parent_id=$${index} OR sx.user_id=$${index}))`,
      args: [u.id],
    };
  return { sql: "", args: [] };
}
function studentScope(u: User, alias: string, index: number) {
  if (u.role === "TEACHER")
    return {
      sql: ` AND EXISTS(SELECT 1 FROM enrollments e JOIN groups gx ON gx.id=e.group_id AND gx.tenant_id=e.tenant_id WHERE e.tenant_id=${alias}.tenant_id AND e.student_id=${alias}.id AND gx.teacher_id=$${index})`,
      args: [u.id],
    };
  if (["PARENT", "STUDENT"].includes(u.role))
    return {
      sql: ` AND (${alias}.parent_id=$${index} OR ${alias}.user_id=$${index})`,
      args: [u.id],
    };
  return { sql: "", args: [] };
}
async function group(c: DB, u: User, gid: string) {
  const s = scope(u, "g", 3);
  const r = await c.query(
    `SELECT g.* FROM groups g WHERE g.tenant_id=$1 AND g.id=$2 ${s.sql}`,
    [u.tenant_id, uuid(gid), ...s.args],
  );
  if (!r.rowCount) throw new NotFoundException("Groupe introuvable");
  return r.rows[0];
}
async function student(c: DB, u: User, sid: string) {
  const s = studentScope(u, "s", 3);
  const r = await c.query(
    `SELECT s.* FROM students s WHERE s.tenant_id=$1 AND s.id=$2 ${s.sql}`,
    [u.tenant_id, uuid(sid), ...s.args],
  );
  if (!r.rowCount) throw new NotFoundException("Élève introuvable");
  return r.rows[0];
}
async function userRole(
  c: DB,
  u: User,
  userid: string | undefined | null,
  role: string,
) {
  if (!userid) return;
  const r = await c.query(
    "SELECT 1 FROM users WHERE tenant_id=$1 AND id=$2 AND role=$3 AND active",
    [u.tenant_id, userid, role],
  );
  if (!r.rowCount) throw new BadRequestException("Compte associé invalide");
}
async function lesson(c: DB, u: User, lid: string) {
  const r = await c.query(
    "SELECT * FROM lessons WHERE tenant_id=$1 AND id=$2",
    [u.tenant_id, uuid(lid)],
  );
  if (!r.rowCount) throw new NotFoundException("Séance introuvable");
  await group(c, u, r.rows[0].group_id);
  return r.rows[0];
}
async function students(u: User) {
  const s = studentScope(u, "s", 2);
  return (
    await db.query(
      `SELECT s.*,p.name AS parent_name,p.email AS parent_email FROM students s LEFT JOIN users p ON p.id=s.parent_id AND p.tenant_id=s.tenant_id WHERE s.tenant_id=$1 AND s.active ${s.sql} ORDER BY s.name LIMIT 2000`,
      [u.tenant_id, ...s.args],
    )
  ).rows;
}
async function groups(u: User) {
  const s = scope(u, "g", 2);
  return (
    await db.query(
      `SELECT g.*,t.name AS teacher_name,(SELECT count(*)::int FROM enrollments e JOIN students x ON x.tenant_id=e.tenant_id AND x.id=e.student_id AND x.active WHERE e.tenant_id=g.tenant_id AND e.group_id=g.id) AS student_count FROM groups g LEFT JOIN users t ON t.id=g.teacher_id AND t.tenant_id=g.tenant_id WHERE g.tenant_id=$1 AND g.active ${s.sql} ORDER BY g.name`,
      [u.tenant_id, ...s.args],
    )
  ).rows;
}
async function sessions(u: User, range?: { from: string; to: string }) {
  const s = scope(u, "g", 2);
  const args: unknown[] = [u.tenant_id, ...s.args];
  let dates = "";
  if (range) {
    dates = ` AND l.starts_at<$${args.length + 2}::timestamptz AND l.ends_at>$${args.length + 1}::timestamptz`;
    args.push(`${range.from}T00:00:00+01:00`, `${range.to}T00:00:00+01:00`);
  }
  return (
    await db.query(
      `SELECT l.*,g.name AS group_name,g.subject,g.level,g.capacity,(SELECT count(*)::int FROM enrollments e JOIN students x ON x.tenant_id=e.tenant_id AND x.id=e.student_id AND x.active WHERE e.tenant_id=g.tenant_id AND e.group_id=g.id) AS student_count,g.teacher_id,t.name AS teacher_name FROM lessons l JOIN groups g ON g.id=l.group_id AND g.tenant_id=l.tenant_id LEFT JOIN users t ON t.id=g.teacher_id AND t.tenant_id=g.tenant_id WHERE l.tenant_id=$1 ${s.sql} ${dates} ORDER BY l.starts_at DESC ${range ? "" : "LIMIT 1000"}`,
      args,
    )
  ).rows;
}
async function invoices(u: User) {
  permit(u, [...financeRoles, "PARENT", "STUDENT"]);
  const s = studentScope(u, "s", 2);
  return (
    await db.query(
      `SELECT i.*,s.name AS student_name,g.name AS group_name FROM invoice_balances i JOIN students s ON s.id=i.student_id AND s.tenant_id=i.tenant_id LEFT JOIN groups g ON g.id=i.group_id AND g.tenant_id=i.tenant_id WHERE i.tenant_id=$1 ${s.sql} ORDER BY i.created_at DESC LIMIT 2000`,
      [u.tenant_id, ...s.args],
    )
  ).rows;
}
async function payroll(u: User, month: string, c: DB = db) {
  permit(u, [...adminRoles, "CASHIER", "TEACHER"]);
  parse(z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), month);
  const teachers = (
    await c.query(
      `SELECT id,name FROM users WHERE tenant_id=$1 AND role='TEACHER' AND active ${u.role === "TEACHER" ? "AND id=$2" : ""} ORDER BY name`,
      u.role === "TEACHER" ? [u.tenant_id, u.id] : [u.tenant_id],
    )
  ).rows;
  const result = [];
  for (const t of teachers) {
    const parts = (
      await c.query(
        `SELECT g.id::text||':'||l.pay_mode||':'||l.pay_value::text AS id,g.name,l.pay_mode,l.pay_value,count(*)::int AS session_count,sum(extract(epoch FROM(l.ends_at-l.starts_at))/3600)::float AS hours,0::bigint AS collected_centimes FROM lessons l JOIN groups g ON g.id=l.group_id AND g.tenant_id=l.tenant_id WHERE l.tenant_id=$1 AND l.teacher_id=$3 AND l.status='completed' AND l.pay_mode IN('session','hour') AND to_char(l.starts_at AT TIME ZONE 'Africa/Algiers','YYYY-MM')=$2 GROUP BY g.id,g.name,l.pay_mode,l.pay_value UNION ALL SELECT g.id::text||':percent:'||i.pay_percent_bp::text,g.name,'percent',i.pay_percent_bp,0,0,COALESCE(sum(CASE WHEN p.kind='payment' THEN p.amount_centimes ELSE -p.amount_centimes END),0)::bigint FROM payments p JOIN invoices i ON i.id=p.invoice_id AND i.tenant_id=p.tenant_id JOIN groups g ON g.id=i.group_id AND g.tenant_id=i.tenant_id WHERE p.tenant_id=$1 AND i.teacher_id=$3 AND i.pay_percent_bp>0 AND to_char(p.created_at AT TIME ZONE 'Africa/Algiers','YYYY-MM')=$2 GROUP BY g.id,g.name,i.pay_percent_bp`,
        [u.tenant_id, month, t.id],
      )
    ).rows;
    const earned = parts.reduce(
      (n, g) =>
        n +
        Math.round(
          g.pay_mode === "percent"
            ? (g.collected_centimes * g.pay_value) / 10000
            : g.pay_mode === "hour"
              ? g.hours * g.pay_value
              : g.session_count * g.pay_value,
        ),
      0,
    );
    const paid = (
      await c.query(
        "SELECT COALESCE(sum(amount_centimes),0)::bigint AS total FROM payroll_payments WHERE tenant_id=$1 AND teacher_id=$2 AND month=$3",
        [u.tenant_id, t.id, month],
      )
    ).rows[0].total;
    result.push({
      ...t,
      earned_centimes: earned,
      paid_centimes: paid,
      balance_centimes: earned - paid,
      groups: parts,
    });
  }
  return result;
}
@Controller("api")
@UseGuards(AuthGuard)
export class DomainController {
  @All("*path") async dispatch(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const u = req.user,
      p = req.path.replace(/^\/api\/?/, "").replace(/\/$/, ""),
      method = req.method,
      key = `${method} ${p}`,
      body = req.body;
    if (method !== "GET" && !u.verified)
      throw new ForbiddenException(
        "Vérifiez votre adresse email avant de modifier les données",
      );
    if (p.startsWith("planning/")) return planningRoute(u, key, p, body);
    if (key === "GET dashboard") {
      const ss = await students(u),
        gg = await groups(u),
        ll = await sessions(u);
      const financial = u.role !== "TEACHER";
      const ii = financial ? await invoices(u) : [];
      const totals = financial
        ? (
            await db.query(
              `SELECT COALESCE(sum(CASE WHEN p.kind='payment' THEN p.amount_centimes ELSE -p.amount_centimes END),0)::bigint AS collected FROM payments p JOIN invoices i ON i.id=p.invoice_id AND i.tenant_id=p.tenant_id JOIN students s ON s.id=i.student_id AND s.tenant_id=i.tenant_id WHERE p.tenant_id=$1 AND date_trunc('month',p.created_at AT TIME ZONE 'Africa/Algiers')=date_trunc('month',now() AT TIME ZONE 'Africa/Algiers') ${studentScope(u, "s", 2).sql}`,
              [u.tenant_id, ...studentScope(u, "s", 2).args],
            )
          ).rows[0].collected
        : 0;
      const paymentScope = studentScope(u, "s", 2);
      const recentPayments = financial
        ? (
            await db.query(
              `SELECT p.id,p.amount_centimes,p.kind,p.method,p.created_at,p.receipt_number,s.name AS student_name FROM payments p JOIN invoices i ON i.id=p.invoice_id AND i.tenant_id=p.tenant_id JOIN students s ON s.id=i.student_id AND s.tenant_id=i.tenant_id WHERE p.tenant_id=$1 ${paymentScope.sql} ORDER BY p.created_at DESC LIMIT 5`,
              [u.tenant_id, ...paymentScope.args],
            )
          ).rows
        : [];
      const cashflow = financial
        ? (
            await db.query(
              `SELECT to_char(p.created_at AT TIME ZONE 'Africa/Algiers','YYYY-MM-DD') AS day,sum(CASE WHEN p.kind='payment' THEN p.amount_centimes ELSE -p.amount_centimes END)::bigint AS total FROM payments p JOIN invoices i ON i.id=p.invoice_id AND i.tenant_id=p.tenant_id JOIN students s ON s.id=i.student_id AND s.tenant_id=i.tenant_id WHERE p.tenant_id=$1 AND p.created_at>=now()-interval '7 days' ${paymentScope.sql} GROUP BY 1 ORDER BY 1`,
              [u.tenant_id, ...paymentScope.args],
            )
          ).rows
        : [];
      const attendanceScope = scope(u, "g", 2);
      const familyAttendance = ["PARENT", "STUDENT"].includes(u.role)
        ? ` AND (s.parent_id=$2 OR s.user_id=$2)`
        : "";
      const attendanceStats = (
        await db.query(
          `SELECT count(*) FILTER(WHERE a.status IN('present','late'))::int AS present,count(*) FILTER(WHERE a.status IN('present','late','absent'))::int AS total FROM attendance a JOIN lessons l ON l.id=a.lesson_id AND l.tenant_id=a.tenant_id JOIN groups g ON g.id=l.group_id AND g.tenant_id=l.tenant_id JOIN students s ON s.id=a.student_id AND s.tenant_id=a.tenant_id WHERE a.tenant_id=$1 AND l.status='completed' AND l.starts_at>=now()-interval '30 days' ${attendanceScope.sql} ${familyAttendance}`,
          [u.tenant_id, ...attendanceScope.args],
        )
      ).rows[0];
      return {
        demo: u.slug === "midad-local",
        teachers: new Set(gg.map((g) => g.teacher_id).filter(Boolean)).size,
        attendance: attendanceStats,
        cashflow,
        recent_payments: recentPayments,
        outstanding: ii
          .filter((i) => i.status === "open" && i.balance_centimes > 0)
          .sort((a, b) => a.due_date.localeCompare(b.due_date))
          .slice(0, 5),
        group_overview: gg.slice(0, 6).map((g) => ({
          id: g.id,
          name: g.name,
          subject: g.subject,
          level: g.level,
          student_count: g.student_count,
          capacity: g.capacity,
          teacher_name: g.teacher_name,
        })),
        recent_students: [...ss]
          .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
          .slice(0, 5)
          .map((s) => ({
            id: s.id,
            name: s.name,
            level: s.level,
            created_at: s.created_at,
          })),
        students: ss.length,
        groups: gg.length,
        sessions: ll.filter((l) => l.status === "scheduled").length,
        collected_centimes: financial ? totals : null,
        due_centimes: financial
          ? ii
              .filter((i) => i.status === "open")
              .reduce((n, i) => n + i.balance_centimes, 0)
          : null,
        overdue: ii.filter(
          (i) =>
            i.status === "open" &&
            i.balance_centimes > 0 &&
            i.due_date < new Date().toISOString().slice(0, 10),
        ).length,
        upcoming: ll
          .filter(
            (l) => l.status === "scheduled" && new Date(l.ends_at) > new Date(),
          )
          .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
          .slice(0, 8),
        school: u.school,
      };
    }
    if (key === "GET students") return students(u);
    if (key === "POST students") {
      permit(u, adminRoles);
      const v = parse(studentInput, body);
      return transaction(async (c) => {
        await userRole(c, u, v.parent_id, "PARENT");
        await userRole(c, u, v.user_id, "STUDENT");
        const sid = uid();
        await c.query(
          "INSERT INTO students(id,tenant_id,name,phone,level,birth_date,parent_id,user_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
          [
            sid,
            u.tenant_id,
            v.name,
            v.phone,
            v.level,
            v.birth_date ?? null,
            v.parent_id ?? null,
            v.user_id ?? null,
          ],
        );
        await record(c, u, "student.create", sid);
        return { id: sid };
      });
    }
    if (method === "PATCH" && /^students\/[\w-]+$/.test(p)) {
      permit(u, adminRoles);
      const sid = uuid(p.split("/")[1]);
      const v = parse(studentInput, body);
      return transaction(async (c) => {
        await student(c, u, sid);
        await userRole(c, u, v.parent_id, "PARENT");
        await userRole(c, u, v.user_id, "STUDENT");
        await c.query(
          "UPDATE students SET name=$1,phone=$2,level=$3,birth_date=$4,parent_id=$5,user_id=$6 WHERE tenant_id=$7 AND id=$8",
          [
            v.name,
            v.phone,
            v.level,
            v.birth_date ?? null,
            v.parent_id ?? null,
            v.user_id ?? null,
            u.tenant_id,
            sid,
          ],
        );
        await record(c, u, "student.update", sid);
        return { ok: true };
      });
    }
    if (method === "DELETE" && /^students\/[\w-]+$/.test(p)) {
      permit(u, adminRoles);
      const sid = uuid(p.split("/")[1]);
      await student(db, u, sid);
      await transaction(async (c) => {
        await c.query(
          "UPDATE students SET active=false WHERE tenant_id=$1 AND id=$2",
          [u.tenant_id, sid],
        );
        await record(c, u, "student.archive", sid);
      });
      return { ok: true };
    }
    if (key === "GET groups") return groups(u);
    if (
      key === "POST groups" ||
      (method === "PATCH" && /^groups\/[\w-]+$/.test(p))
    ) {
      permit(u, adminRoles);
      const v = parse(groupInput, body),
        gid = method === "PATCH" ? uuid(p.split("/")[1]) : uid();
      return transaction(async (c) => {
        await c.query("SELECT id FROM tenants WHERE id=$1 FOR UPDATE", [
          u.tenant_id,
        ]);
        await userRole(c, u, v.teacher_id, "TEACHER");
        if (method === "PATCH") {
          const conflicts = await c.query(
            "SELECT 1 FROM lessons own JOIN lessons other ON other.tenant_id=own.tenant_id AND other.group_id<>own.group_id AND other.status<>'cancelled' AND other.starts_at<own.ends_at AND other.ends_at>own.starts_at JOIN groups gx ON gx.id=other.group_id AND gx.tenant_id=other.tenant_id WHERE own.tenant_id=$1 AND own.group_id=$2 AND own.ends_at>now() AND own.status='scheduled' AND gx.teacher_id=$3",
            [u.tenant_id, gid, v.teacher_id ?? null],
          );
          if (conflicts.rowCount)
            throw new ConflictException(
              "Conflit de planning pour cet enseignant",
            );
          await c.query(
            "UPDATE lessons SET teacher_id=$1,pay_mode=$2,pay_value=$3 WHERE tenant_id=$4 AND group_id=$5 AND ends_at>now() AND status='scheduled'",
            [v.teacher_id ?? null, v.pay_mode, v.pay_value, u.tenant_id, gid],
          );
          await group(c, u, gid);
          const n = (
            await c.query(
              "SELECT count(*)::int AS n FROM enrollments WHERE tenant_id=$1 AND group_id=$2",
              [u.tenant_id, gid],
            )
          ).rows[0].n;
          if (n > v.capacity)
            throw new ConflictException("Capacité inférieure aux inscriptions");
          await c.query(
            "UPDATE groups SET name=$1,subject=$2,level=$3,teacher_id=$4,room=$5,capacity=$6,fee_centimes=$7,pay_mode=$8,pay_value=$9 WHERE tenant_id=$10 AND id=$11",
            [
              v.name,
              v.subject,
              v.level,
              v.teacher_id ?? null,
              v.room,
              v.capacity,
              v.fee_centimes,
              v.pay_mode,
              v.pay_value,
              u.tenant_id,
              gid,
            ],
          );
        } else
          await c.query(
            "INSERT INTO groups(id,tenant_id,name,subject,level,teacher_id,room,capacity,fee_centimes,pay_mode,pay_value) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
            [
              gid,
              u.tenant_id,
              v.name,
              v.subject,
              v.level,
              v.teacher_id ?? null,
              v.room,
              v.capacity,
              v.fee_centimes,
              v.pay_mode,
              v.pay_value,
            ],
          );
        await record(
          c,
          u,
          method === "POST" ? "group.create" : "group.update",
          gid,
        );
        return { id: gid };
      });
    }
    if (method === "GET" && /^groups\/[\w-]+\/students$/.test(p)) {
      const gid = uuid(p.split("/")[1]);
      await group(db, u, gid);
      const s = studentScope(u, "s", 3);
      return (
        await db.query(
          `SELECT s.* FROM enrollments e JOIN students s ON s.id=e.student_id AND s.tenant_id=e.tenant_id WHERE e.tenant_id=$1 AND e.group_id=$2 AND s.active ${s.sql} ORDER BY s.name`,
          [u.tenant_id, gid, ...s.args],
        )
      ).rows;
    }
    if (method === "POST" && /^groups\/[\w-]+\/enroll$/.test(p)) {
      permit(u, adminRoles);
      const gid = uuid(p.split("/")[1]),
        v = parse(z.object({ student_id: id }), body);
      return transaction(async (c) => {
        await c.query(
          "SELECT id FROM groups WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
          [u.tenant_id, gid],
        );
        const g = await group(c, u, gid);
        const s = await student(c, u, v.student_id);
        if (!s.active || !g.active)
          throw new BadRequestException("Dossier archivé");
        const old = await c.query(
          "SELECT 1 FROM enrollments WHERE tenant_id=$1 AND group_id=$2 AND student_id=$3",
          [u.tenant_id, gid, v.student_id],
        );
        if (old.rowCount) return { ok: true };
        const n = (
          await c.query(
            "SELECT count(*)::int AS n FROM enrollments e JOIN students s ON s.id=e.student_id AND s.tenant_id=e.tenant_id AND s.active WHERE e.tenant_id=$1 AND e.group_id=$2",
            [u.tenant_id, gid],
          )
        ).rows[0].n;
        if (n >= g.capacity) throw new ConflictException("Groupe complet");
        await c.query(
          "INSERT INTO enrollments(tenant_id,group_id,student_id) VALUES($1,$2,$3)",
          [u.tenant_id, gid, v.student_id],
        );
        await record(c, u, "enrollment.create", v.student_id, {
          group_id: gid,
        });
        return { ok: true };
      });
    }
    if (method === "DELETE" && /^groups\/[\w-]+\/enroll\/[\w-]+$/.test(p)) {
      permit(u, adminRoles);
      const [, gid, , sid] = p.split("/");
      await transaction(async (c) => {
        await group(c, u, gid);
        await student(c, u, sid);
        await c.query(
          "DELETE FROM enrollments WHERE tenant_id=$1 AND group_id=$2 AND student_id=$3",
          [u.tenant_id, gid, sid],
        );
        await record(c, u, "enrollment.remove", sid, { group_id: gid });
      });
      return { ok: true };
    }
    if (key === "GET sessions") {
      if (req.query.from !== undefined || req.query.to !== undefined) {
        const range = parse(z.object({ from: day, to: day }), req.query);
        const length = Date.parse(range.to) - Date.parse(range.from);
        if (length <= 0 || length > 62 * 86400000)
          throw new BadRequestException(
            "Période du calendrier invalide (1 à 62 jours)",
          );
        return sessions(u, range);
      }
      return sessions(u);
    }
    if (
      key === "POST sessions" ||
      (method === "PATCH" && /^sessions\/[\w-]+$/.test(p))
    ) {
      permit(u, [...adminRoles, "TEACHER"]);
      const v = parse(sessionInput, body),
        lid = method === "PATCH" ? uuid(p.split("/")[1]) : uid();
      return transaction(async (c) => {
        await c.query("SELECT id FROM tenants WHERE id=$1 FOR UPDATE", [
          u.tenant_id,
        ]);
        const g = await group(c, u, v.group_id);
        if (method === "PATCH") await lesson(c, u, lid);
        const room = v.room || g.room;
        await ensureSchoolOpen(c, u.tenant_id, v.starts_at, v.ends_at);
        const conflict = await c.query(
          `SELECT 1 FROM lessons l JOIN groups g ON g.id=l.group_id AND g.tenant_id=l.tenant_id WHERE l.tenant_id=$1 AND l.id<>$2 AND l.status<>'cancelled' AND l.starts_at<$4 AND l.ends_at>$3 AND ((l.room<>'' AND l.room=$5) OR (g.teacher_id IS NOT NULL AND g.teacher_id=$6) OR l.group_id=$7) LIMIT 1`,
          [
            u.tenant_id,
            lid,
            v.starts_at,
            v.ends_at,
            room,
            g.teacher_id,
            v.group_id,
          ],
        );
        if (conflict.rowCount)
          throw new ConflictException("Conflit de salle, groupe ou enseignant");
        if (method === "POST")
          await c.query(
            "INSERT INTO lessons(id,tenant_id,group_id,starts_at,ends_at,room,notes,teacher_id,pay_mode,pay_value) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
            [
              lid,
              u.tenant_id,
              v.group_id,
              v.starts_at,
              v.ends_at,
              room,
              v.notes,
              g.teacher_id,
              g.pay_mode,
              g.pay_value,
            ],
          );
        else {
          const old = await lesson(c, u, lid);
          if (old.status === "completed")
            throw new ConflictException(
              "Une séance terminée ne peut pas être reprogrammée",
            );
          if (old.group_id !== v.group_id)
            throw new BadRequestException(
              "Le groupe d’une séance existante ne peut pas être changé",
            );
          await c.query(
            "UPDATE lessons SET starts_at=$1,ends_at=$2,room=$3,notes=$4 WHERE tenant_id=$5 AND id=$6",
            [v.starts_at, v.ends_at, room, v.notes, u.tenant_id, lid],
          );
        }
        await record(
          c,
          u,
          method === "POST" ? "session.create" : "session.reschedule",
          lid,
        );
        return { id: lid };
      });
    }
    if (method === "POST" && /^sessions\/[\w-]+\/status$/.test(p)) {
      permit(u, [...adminRoles, "TEACHER"]);
      const lid = uuid(p.split("/")[1]),
        v = parse(
          z.object({ status: z.enum(["scheduled", "completed", "cancelled"]) }),
          body,
        );
      return transaction(async (c) => {
        await c.query("SELECT id FROM tenants WHERE id=$1 FOR UPDATE", [
          u.tenant_id,
        ]);
        const l = await lesson(c, u, lid);
        if (l.status === "completed" && v.status !== "completed") {
          const paid = await c.query(
            "SELECT 1 FROM payroll_payments WHERE tenant_id=$1 AND teacher_id=$2 AND month=to_char($3::timestamptz AT TIME ZONE 'Africa/Algiers','YYYY-MM')",
            [u.tenant_id, l.teacher_id, l.starts_at],
          );
          if (paid.rowCount)
            throw new ConflictException(
              "Une rémunération a déjà été réglée pour cette période",
            );
        }
        if (v.status === "completed" && Date.parse(l.ends_at) > Date.now())
          throw new ConflictException("La séance n’est pas encore terminée");
        if (v.status === "scheduled") {
          await ensureSchoolOpen(c, u.tenant_id, l.starts_at, l.ends_at);
          const g = await group(c, u, l.group_id);
          const clash = await c.query(
            "SELECT 1 FROM lessons x JOIN groups gx ON gx.id=x.group_id AND gx.tenant_id=x.tenant_id WHERE x.tenant_id=$1 AND x.id<>$2 AND x.status<>'cancelled' AND x.starts_at<$4 AND x.ends_at>$3 AND ((x.room<>'' AND x.room=$5) OR (gx.teacher_id IS NOT NULL AND gx.teacher_id=$6) OR x.group_id=$7)",
            [
              u.tenant_id,
              lid,
              l.starts_at,
              l.ends_at,
              l.room,
              g.teacher_id,
              g.id,
            ],
          );
          if (clash.rowCount)
            throw new ConflictException("Conflit de planning");
        }
        await c.query(
          "UPDATE lessons SET status=$1 WHERE tenant_id=$2 AND id=$3",
          [v.status, u.tenant_id, lid],
        );
        await record(c, u, "session.status", lid, v);
        if (v.status === "cancelled") {
          const recipients = (
            await c.query(
              "SELECT DISTINCT unnest(ARRAY[s.parent_id,s.user_id]) AS id FROM students s JOIN enrollments e ON e.student_id=s.id AND e.tenant_id=s.tenant_id WHERE s.tenant_id=$1 AND e.group_id=$2 AND s.active",
              [u.tenant_id, l.group_id],
            )
          ).rows;
          for (const r of recipients)
            if (r.id)
              await notify(
                c,
                u.tenant_id,
                r.id,
                "Séance annulée",
                `${new Date(l.starts_at).toLocaleString("fr-DZ", { timeZone: "Africa/Algiers" })}. Consultez votre planning.`,
              );
        }
        return { ok: true };
      });
    }
    if (method === "GET" && /^sessions\/[\w-]+\/attendance$/.test(p)) {
      const lid = uuid(p.split("/")[1]),
        l = await lesson(db, u, lid),
        s = studentScope(u, "s", 4);
      return (
        await db.query(
          `SELECT s.id AS student_id,s.name,COALESCE(a.status,'unmarked') AS status,COALESCE(a.justification,'') AS justification,COALESCE(a.decision,'pending') AS decision FROM enrollments e JOIN students s ON s.id=e.student_id AND s.tenant_id=e.tenant_id LEFT JOIN attendance a ON a.student_id=s.id AND a.tenant_id=s.tenant_id AND a.lesson_id=$2 WHERE e.tenant_id=$1 AND e.group_id=$3 AND s.active ${s.sql} ORDER BY s.name`,
          [u.tenant_id, lid, l.group_id, ...s.args],
        )
      ).rows;
    }
    if (method === "PUT" && /^sessions\/[\w-]+\/attendance$/.test(p)) {
      permit(u, [...adminRoles, "TEACHER"]);
      const lid = uuid(p.split("/")[1]),
        v = parse(attendanceInput, body);
      return transaction(async (c) => {
        await c.query(
          "SELECT id FROM lessons WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
          [u.tenant_id, lid],
        );
        const l = await lesson(c, u, lid);
        if (l.status === "cancelled")
          throw new ConflictException("Séance annulée");
        for (const e of v.entries) {
          const s = await student(c, u, e.student_id);
          const enrolled = await c.query(
            "SELECT 1 FROM enrollments WHERE tenant_id=$1 AND group_id=$2 AND student_id=$3",
            [u.tenant_id, l.group_id, s.id],
          );
          if (!enrolled.rowCount || !s.active)
            throw new BadRequestException("Élève non inscrit");
          const old = (
            await c.query(
              "SELECT status FROM attendance WHERE tenant_id=$1 AND lesson_id=$2 AND student_id=$3",
              [u.tenant_id, lid, s.id],
            )
          ).rows[0]?.status;
          await c.query(
            `INSERT INTO attendance(tenant_id,lesson_id,student_id,status,updated_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(tenant_id,lesson_id,student_id) DO UPDATE SET status=excluded.status,updated_by=excluded.updated_by,updated_at=now()`,
            [u.tenant_id, lid, s.id, e.status, u.id],
          );
          if (old !== e.status) {
            await record(c, u, "attendance.update", lid, {
              student_id: s.id,
              from: old ?? "unmarked",
              to: e.status,
            });
            if (["absent", "late"].includes(e.status))
              for (const recipient of new Set([s.parent_id, s.user_id]))
                if (recipient)
                  await notify(
                    c,
                    u.tenant_id,
                    recipient,
                    e.status === "absent"
                      ? "Absence signalée"
                      : "Retard signalé",
                    `${s.name} — ${new Date(l.starts_at).toLocaleString("fr-DZ", { timeZone: "Africa/Algiers" })}. Une correction reste possible.`,
                  );
          }
        }
        return { ok: true };
      });
    }
    if (method === "POST" && /^sessions\/[\w-]+\/justify$/.test(p)) {
      permit(u, ["PARENT", "STUDENT"]);
      const lid = uuid(p.split("/")[1]),
        v = parse(
          z.object({
            student_id: id,
            justification: z.string().trim().min(3).max(2000),
          }),
          body,
        );
      await student(db, u, v.student_id);
      await lesson(db, u, lid);
      const r = await db.query(
        "UPDATE attendance SET justification=$1,decision='pending' WHERE tenant_id=$2 AND lesson_id=$3 AND student_id=$4 AND status IN('absent','late') RETURNING student_id",
        [v.justification, u.tenant_id, lid, v.student_id],
      );
      if (!r.rowCount)
        throw new BadRequestException("Aucune absence à justifier");
      return { ok: true };
    }
    if (method === "POST" && /^sessions\/[\w-]+\/decision$/.test(p)) {
      permit(u, [...adminRoles, "TEACHER"]);
      const lid = uuid(p.split("/")[1]),
        v = parse(
          z.object({
            student_id: id,
            decision: z.enum(["accepted", "rejected"]),
          }),
          body,
        );
      await lesson(db, u, lid);
      await transaction(async (c) => {
        const r = await c.query(
          "UPDATE attendance SET decision=$1 WHERE tenant_id=$2 AND lesson_id=$3 AND student_id=$4 AND justification<>'' RETURNING student_id",
          [v.decision, u.tenant_id, lid, v.student_id],
        );
        if (!r.rowCount)
          throw new NotFoundException("Justificatif introuvable");
        await record(c, u, "attendance.decision", lid, v);
      });
      return { ok: true };
    }
    if (key === "GET invoices") return invoices(u);
    if (key === "POST invoices") {
      permit(u, financeRoles);
      const v = parse(invoiceInput, body);
      return transaction(async (c) => {
        await student(c, u, v.student_id);
        const g = v.group_id ? await group(c, u, v.group_id) : null;
        const iid = uid();
        await c.query(
          "INSERT INTO invoices(id,tenant_id,student_id,group_id,label,amount_centimes,due_date,teacher_id,pay_percent_bp) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
          [
            iid,
            u.tenant_id,
            v.student_id,
            v.group_id ?? null,
            v.label,
            v.amount_centimes,
            v.due_date,
            g?.teacher_id ?? null,
            g?.pay_mode === "percent" ? g.pay_value : 0,
          ],
        );
        await record(c, u, "invoice.create", iid, v);
        return { id: iid };
      });
    }
    if (key === "POST invoices/generate") {
      permit(u, financeRoles);
      const v = parse(
        z.object({
          group_id: id,
          month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
          due_date: day,
        }),
        body,
      );
      return transaction(async (c) => {
        const g = await group(c, u, v.group_id);
        if (g.fee_centimes <= 0)
          throw new BadRequestException("Tarif du groupe non défini");
        const r = await c.query(
          `INSERT INTO invoices(id,tenant_id,student_id,group_id,label,amount_centimes,due_date,billing_period,teacher_id,pay_percent_bp) SELECT gen_random_uuid(),$1,s.id,$2,$3,$4,$5,$6,$7,$8 FROM enrollments e JOIN students s ON s.id=e.student_id AND s.tenant_id=e.tenant_id AND s.active WHERE e.tenant_id=$1 AND e.group_id=$2 ON CONFLICT DO NOTHING RETURNING id`,
          [
            u.tenant_id,
            g.id,
            `${g.name} — ${v.month}`,
            g.fee_centimes,
            v.due_date,
            v.month,
            g.teacher_id,
            g.pay_mode === "percent" ? g.pay_value : 0,
          ],
        );
        await record(c, u, "invoice.generate", g.id, {
          month: v.month,
          count: r.rowCount,
        });
        return { created: r.rowCount };
      });
    }
    if (method === "POST" && /^invoices\/[\w-]+\/cancel$/.test(p)) {
      permit(u, financeRoles);
      const iid = uuid(p.split("/")[1]);
      return transaction(async (c) => {
        const r = await c.query(
          "SELECT * FROM invoices WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
          [u.tenant_id, iid],
        );
        if (!r.rowCount) throw new NotFoundException();
        const balance = (
          await c.query(
            "SELECT paid_centimes FROM invoice_balances WHERE tenant_id=$1 AND id=$2",
            [u.tenant_id, iid],
          )
        ).rows[0];
        if (balance.paid_centimes !== 0)
          throw new ConflictException(
            "Remboursez les paiements avant d’annuler cette échéance",
          );
        await c.query(
          "UPDATE invoices SET status='cancelled' WHERE tenant_id=$1 AND id=$2",
          [u.tenant_id, iid],
        );
        await record(c, u, "invoice.cancel", iid);
        return { ok: true };
      });
    }
    if (key === "GET payments") {
      permit(u, [...financeRoles, "PARENT", "STUDENT"]);
      const s = studentScope(u, "s", 2);
      return (
        await db.query(
          `SELECT p.*,s.name AS student_name,i.label AS invoice_label,a.name AS cashier_name FROM payments p JOIN invoices i ON i.id=p.invoice_id AND i.tenant_id=p.tenant_id JOIN students s ON s.id=i.student_id AND s.tenant_id=i.tenant_id JOIN users a ON a.id=p.created_by WHERE p.tenant_id=$1 ${s.sql} ORDER BY p.created_at DESC LIMIT 2000`,
          [u.tenant_id, ...s.args],
        )
      ).rows;
    }
    if (key === "POST payments" || key === "POST refunds") {
      permit(u, financeRoles);
      const refund = key === "POST refunds";
      const v = refund
        ? parse(
            z.object({
              payment_id: id,
              amount_centimes: money,
              reference: z.string().min(3).max(200),
            }),
            body,
          )
        : parse(paymentInput, body);
      const requestKey = parse(
        z.string().min(16).max(100),
        req.headers["idempotency-key"],
      );
      const fingerprint = hash(JSON.stringify({ refund, ...v }));
      return transaction(async (c) => {
        await c.query("SELECT id FROM tenants WHERE id=$1 FOR UPDATE", [
          u.tenant_id,
        ]);
        const prior = await c.query(
          "SELECT * FROM payments WHERE tenant_id=$1 AND idempotency_key=$2",
          [u.tenant_id, requestKey],
        );
        if (prior.rowCount) {
          if (prior.rows[0].fingerprint !== fingerprint)
            throw new ConflictException(
              "Clé de paiement réutilisée pour une autre opération",
            );
          return prior.rows[0];
        }
        let invoiceId: string,
          method: string,
          original: string | null = null;
        if (refund) {
          const rv = v as {
            payment_id: string;
            amount_centimes: number;
            reference: string;
          };
          const r = await c.query(
            "SELECT * FROM payments WHERE tenant_id=$1 AND id=$2 AND kind='payment'",
            [u.tenant_id, rv.payment_id],
          );
          if (!r.rowCount) throw new NotFoundException("Paiement introuvable");
          const p = r.rows[0];
          const sum = (
            await c.query(
              "SELECT COALESCE(sum(amount_centimes),0)::bigint AS total FROM payments WHERE tenant_id=$1 AND original_id=$2 AND kind='refund'",
              [u.tenant_id, p.id],
            )
          ).rows[0].total;
          if (rv.amount_centimes > p.amount_centimes - sum)
            throw new ConflictException(
              "Remboursement supérieur au versement disponible",
            );
          invoiceId = p.invoice_id;
          method = p.method;
          original = p.id;
        } else {
          const pv = v as z.infer<typeof paymentInput>;
          invoiceId = pv.invoice_id;
          method = pv.method;
          if (method !== "cash" && !pv.reference.trim())
            throw new BadRequestException(
              "Référence requise pour un paiement hors espèces",
            );
        }
        if (method === "cash") {
          const closed = await c.query(
            "SELECT 1 FROM cash_closures WHERE tenant_id=$1 AND day=(now() AT TIME ZONE 'Africa/Algiers')::date",
            [u.tenant_id],
          );
          if (closed.rowCount)
            throw new ConflictException("La caisse du jour est clôturée");
        }
        const inv = (
          await c.query(
            "SELECT * FROM invoices WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
            [u.tenant_id, invoiceId],
          )
        ).rows[0];
        if (!inv) throw new NotFoundException("Échéance introuvable");
        if (inv.status === "cancelled")
          throw new ConflictException("Échéance annulée");
        const bal = (
          await c.query(
            "SELECT balance_centimes FROM invoice_balances WHERE tenant_id=$1 AND id=$2",
            [u.tenant_id, invoiceId],
          )
        ).rows[0].balance_centimes;
        if (!refund && v.amount_centimes > bal)
          throw new ConflictException("Versement supérieur au solde dû");
        const r = await c.query(
          "INSERT INTO payments(id,tenant_id,invoice_id,amount_centimes,kind,method,reference,original_id,created_by,idempotency_key,fingerprint) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *",
          [
            uid(),
            u.tenant_id,
            invoiceId,
            v.amount_centimes,
            refund ? "refund" : "payment",
            method,
            v.reference,
            original,
            u.id,
            requestKey,
            fingerprint,
          ],
        );
        await record(
          c,
          u,
          refund ? "payment.refund" : "payment.create",
          r.rows[0].id,
          { amount_centimes: v.amount_centimes, invoice_id: invoiceId },
        );
        const s = (
          await c.query("SELECT * FROM students WHERE tenant_id=$1 AND id=$2", [
            u.tenant_id,
            inv.student_id,
          ])
        ).rows[0];
        for (const recipient of new Set([s.parent_id, s.user_id]))
          if (recipient)
            await notify(
              c,
              u.tenant_id,
              recipient,
              refund ? "Remboursement enregistré" : "Versement enregistré",
              `${(v.amount_centimes / 100).toFixed(2)} DA — ${inv.label}`,
            );
        return r.rows[0];
      });
    }
    if (key === "GET cash") {
      permit(u, financeRoles);
      const date = parse(
        day,
        String(req.query.day ?? new Date().toISOString().slice(0, 10)),
      );
      const total = (
        await db.query(
          "SELECT COALESCE(sum(CASE WHEN kind='payment' THEN amount_centimes ELSE -amount_centimes END),0)::bigint AS total FROM payments WHERE tenant_id=$1 AND method='cash' AND (created_at AT TIME ZONE 'Africa/Algiers')::date=$2",
          [u.tenant_id, date],
        )
      ).rows[0].total;
      const closure =
        (
          await db.query(
            "SELECT * FROM cash_closures WHERE tenant_id=$1 AND day=$2",
            [u.tenant_id, date],
          )
        ).rows[0] ?? null;
      const openingRow = (
        await db.query(
          "SELECT amount_centimes FROM cash_openings WHERE tenant_id=$1 AND day=$2",
          [u.tenant_id, date],
        )
      ).rows[0];
      const opening = openingRow?.amount_centimes ?? 0;
      return {
        day: date,
        opening_centimes: opening,
        opened: !!openingRow,
        net_centimes: total,
        expected_centimes: total + opening,
        closure,
      };
    }
    if (key === "POST cash/open") {
      permit(u, financeRoles);
      const v = parse(
        z.object({
          amount_centimes: z.number().int().min(0).max(100_000_000_000),
        }),
        body,
      );
      const date = new Date().toLocaleDateString("en-CA", {
        timeZone: "Africa/Algiers",
      });
      return transaction(async (c) => {
        await c.query("SELECT id FROM tenants WHERE id=$1 FOR UPDATE", [
          u.tenant_id,
        ]);
        const existing = await c.query(
          "SELECT 1 FROM cash_closures WHERE tenant_id=$1 AND day=$2",
          [u.tenant_id, date],
        );
        if (existing.rowCount)
          throw new ConflictException("La caisse est clôturée");
        await c.query(
          "INSERT INTO cash_openings(tenant_id,day,amount_centimes,created_by) VALUES($1,$2,$3,$4)",
          [u.tenant_id, date, v.amount_centimes, u.id],
        );
        await record(c, u, "cash.open", date, v);
        return { ok: true };
      });
    }
    if (key === "POST cash/close") {
      permit(u, financeRoles);
      const v = parse(
        z.object({
          day,
          counted_centimes: z.number().int().min(0).max(100_000_000_000),
          notes: z.string().max(1000).default(""),
        }),
        body,
      );
      if (
        v.day >
        new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Algiers" })
      )
        throw new BadRequestException("Clôture future interdite");
      return transaction(async (c) => {
        await c.query("SELECT id FROM tenants WHERE id=$1 FOR UPDATE", [
          u.tenant_id,
        ]);
        const total = (
          await c.query(
            "SELECT COALESCE(sum(CASE WHEN kind='payment' THEN amount_centimes ELSE -amount_centimes END),0)::bigint AS total FROM payments WHERE tenant_id=$1 AND method='cash' AND (created_at AT TIME ZONE 'Africa/Algiers')::date=$2",
            [u.tenant_id, v.day],
          )
        ).rows[0].total;
        const opening =
          (
            await c.query(
              "SELECT amount_centimes FROM cash_openings WHERE tenant_id=$1 AND day=$2",
              [u.tenant_id, v.day],
            )
          ).rows[0]?.amount_centimes ?? 0;
        await c.query(
          "INSERT INTO cash_closures(id,tenant_id,day,counted_centimes,expected_centimes,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)",
          [
            uid(),
            u.tenant_id,
            v.day,
            v.counted_centimes,
            total + opening,
            v.notes,
            u.id,
          ],
        );
        await record(c, u, "cash.close", v.day, {
          expected_centimes: total + opening,
          counted_centimes: v.counted_centimes,
        });
        return { ok: true };
      });
    }
    if (key === "GET payroll")
      return payroll(
        u,
        String(req.query.month ?? new Date().toISOString().slice(0, 7)),
      );
    if (key === "POST payroll") {
      permit(u, financeRoles);
      const v = parse(
        z.object({
          teacher_id: id,
          month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
          amount_centimes: money,
          reference: z.string().min(3).max(200),
        }),
        body,
      );
      await transaction(async (c) => {
        await c.query("SELECT id FROM tenants WHERE id=$1 FOR UPDATE", [
          u.tenant_id,
        ]);
        await userRole(c, u, v.teacher_id, "TEACHER");
        const previous = (
          await c.query(
            "SELECT amount_centimes FROM payroll_payments WHERE tenant_id=$1 AND teacher_id=$2 AND month=$3 AND reference=$4",
            [u.tenant_id, v.teacher_id, v.month, v.reference],
          )
        ).rows[0];
        if (previous) {
          if (previous.amount_centimes !== v.amount_centimes)
            throw new ConflictException(
              "Référence déjà utilisée pour un autre montant",
            );
          return;
        }
        const totals = (await payroll(u, v.month, c)).find(
          (r) => r.id === v.teacher_id,
        );
        if (!totals || v.amount_centimes > totals.balance_centimes)
          throw new ConflictException(
            "Montant supérieur au solde de rémunération",
          );
        await c.query(
          "INSERT INTO payroll_payments(id,tenant_id,teacher_id,month,amount_centimes,reference,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)",
          [
            uid(),
            u.tenant_id,
            v.teacher_id,
            v.month,
            v.amount_centimes,
            v.reference,
            u.id,
          ],
        );
        await record(c, u, "payroll.payment", v.teacher_id, v);
      });
      return { ok: true };
    }
    if (key === "GET users") {
      permit(u, adminRoles);
      return (
        await db.query(
          "SELECT id,name,email,role,locale,verified,active FROM users WHERE tenant_id=$1 ORDER BY name",
          [u.tenant_id],
        )
      ).rows;
    }
    if (method === "PATCH" && /^users\/[\w-]+$/.test(p)) {
      permit(u, ["OWNER"]);
      const target = uuid(p.split("/")[1]),
        v = parse(z.object({ active: z.boolean() }), body);
      if (target === u.id)
        throw new BadRequestException(
          "Votre propre compte ne peut pas être désactivé",
        );
      await transaction(async (c) => {
        const r = await c.query(
          "UPDATE users SET active=$1 WHERE tenant_id=$2 AND id=$3 AND role<>'OWNER' RETURNING id",
          [v.active, u.tenant_id, target],
        );
        if (!r.rowCount) throw new NotFoundException();
        if (!v.active)
          await c.query("DELETE FROM auth_sessions WHERE user_id=$1", [target]);
        await record(c, u, "user.active", target, v);
      });
      return { ok: true };
    }
    if (key === "POST ownership") {
      permit(u, ["OWNER"]);
      const v = parse(z.object({ user_id: id }), body);
      return transaction(async (c) => {
        await c.query("SELECT id FROM tenants WHERE id=$1 FOR UPDATE", [
          u.tenant_id,
        ]);
        await userRole(c, u, v.user_id, "MANAGER");
        const verified = await c.query(
          "SELECT 1 FROM users WHERE id=$1 AND verified",
          [v.user_id],
        );
        if (!verified.rowCount)
          throw new BadRequestException(
            "Le responsable doit avoir vérifié son email",
          );
        await c.query("UPDATE users SET role='MANAGER' WHERE id=$1", [u.id]);
        await c.query(
          "UPDATE users SET role='OWNER' WHERE id=$1 AND tenant_id=$2",
          [v.user_id, u.tenant_id],
        );
        await record(c, u, "ownership.transfer", v.user_id);
        return { ok: true };
      });
    }
    if (key === "GET announcements") {
      const s = scope(u, "g", 2);
      return (
        await db.query(
          `SELECT a.*,t.name AS author,g.name AS group_name FROM announcements a JOIN users t ON t.id=a.created_by LEFT JOIN groups g ON g.id=a.group_id AND g.tenant_id=a.tenant_id WHERE a.tenant_id=$1 AND (a.group_id IS NULL OR EXISTS(SELECT 1 FROM groups g WHERE g.id=a.group_id AND g.tenant_id=a.tenant_id ${s.sql})) ORDER BY a.created_at DESC LIMIT 200`,
          [u.tenant_id, ...s.args],
        )
      ).rows;
    }
    if (key === "POST announcements") {
      permit(u, [...adminRoles, "TEACHER"]);
      const v = parse(
        z.object({
          group_id: id.nullish(),
          title: name,
          body: z.string().trim().min(3).max(10000),
        }),
        body,
      );
      if (u.role === "TEACHER" && !v.group_id)
        throw new ForbiddenException("Choisissez votre groupe");
      return transaction(async (c) => {
        if (v.group_id) await group(c, u, v.group_id);
        const aid = uid();
        await c.query(
          "INSERT INTO announcements(id,tenant_id,group_id,title,body,created_by) VALUES($1,$2,$3,$4,$5,$6)",
          [aid, u.tenant_id, v.group_id ?? null, v.title, v.body, u.id],
        );
        const recipients = v.group_id
          ? (
              await c.query(
                "SELECT DISTINCT unnest(ARRAY[s.parent_id,s.user_id,g.teacher_id]) AS id FROM enrollments e JOIN students s ON s.id=e.student_id AND s.tenant_id=e.tenant_id JOIN groups g ON g.id=e.group_id AND g.tenant_id=e.tenant_id WHERE e.tenant_id=$1 AND e.group_id=$2",
                [u.tenant_id, v.group_id],
              )
            ).rows
          : (
              await c.query(
                "SELECT id FROM users WHERE tenant_id=$1 AND active",
                [u.tenant_id],
              )
            ).rows;
        for (const r of recipients)
          if (r.id && r.id !== u.id)
            await notify(c, u.tenant_id, r.id, v.title, v.body.slice(0, 300));
        await record(c, u, "announcement.create", aid);
        return { id: aid };
      });
    }
    if (key === "GET notifications")
      return (
        await db.query(
          "SELECT * FROM notifications WHERE tenant_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 200",
          [u.tenant_id, u.id],
        )
      ).rows;
    if (key === "POST notifications/read") {
      const v = parse(z.object({ id: id.optional() }), body);
      await db.query(
        "UPDATE notifications SET seen=true WHERE tenant_id=$1 AND user_id=$2 AND ($3::uuid IS NULL OR id=$3)",
        [u.tenant_id, u.id, v.id ?? null],
      );
      return { ok: true };
    }
    if (key === "POST devices") {
      const v = parse(
        z.object({
          token: z
            .string()
            .regex(/^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$/),
        }),
        body,
      );
      await db.query(
        "INSERT INTO device_tokens(user_id,token) VALUES($1,$2) ON CONFLICT(token) DO UPDATE SET user_id=excluded.user_id",
        [u.id, v.token],
      );
      return { ok: true };
    }
    if (key === "DELETE devices") {
      const v = parse(z.object({ token: z.string().max(300) }), body);
      await db.query(
        "DELETE FROM device_tokens WHERE user_id=$1 AND token=$2",
        [u.id, v.token],
      );
      return { ok: true };
    }
    if (key === "GET materials") {
      const s = scope(u, "g", 2);
      return (
        await db.query(
          `SELECT m.id,m.group_id,m.title,m.filename,m.mime,m.created_at,g.name AS group_name FROM materials m JOIN groups g ON g.id=m.group_id AND g.tenant_id=m.tenant_id WHERE m.tenant_id=$1 ${s.sql} ORDER BY m.created_at DESC LIMIT 200`,
          [u.tenant_id, ...s.args],
        )
      ).rows;
    }
    if (key === "POST materials") {
      permit(u, [...adminRoles, "TEACHER"]);
      const v = parse(
        z.object({
          group_id: id,
          title: name,
          filename: z.string().regex(/^[^/\\\x00]{1,120}$/),
          mime: z.enum([
            "application/pdf",
            "image/png",
            "image/jpeg",
            "text/plain",
          ]),
          base64: z.string().max(7_000_000),
        }),
        body,
      );
      const bytes = Buffer.from(v.base64, "base64");
      if (!bytes.length || bytes.length > 5_000_000)
        throw new BadRequestException("Fichier limité à 5 Mo");
      if (
        v.mime === "application/pdf" &&
        !bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))
      )
        throw new BadRequestException("PDF invalide");
      if (
        v.mime === "image/png" &&
        (bytes.length < 8 ||
          !bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
      )
        throw new BadRequestException("Image invalide");
      if (v.mime === "image/jpeg" && (bytes[0] !== 255 || bytes[1] !== 216))
        throw new BadRequestException("Image invalide");
      await group(db, u, v.group_id);
      const mid = uid();
      await transaction(async (c) => {
        await c.query(
          "INSERT INTO materials(id,tenant_id,group_id,title,filename,mime,content,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
          [
            mid,
            u.tenant_id,
            v.group_id,
            v.title,
            v.filename,
            v.mime,
            bytes,
            u.id,
          ],
        );
        await record(c, u, "material.create", mid);
      });
      return { id: mid };
    }
    if (method === "GET" && /^materials\/[\w-]+$/.test(p)) {
      const mid = uuid(p.split("/")[1]),
        r = await db.query(
          "SELECT * FROM materials WHERE tenant_id=$1 AND id=$2",
          [u.tenant_id, mid],
        );
      if (!r.rowCount) throw new NotFoundException();
      const m = r.rows[0];
      await group(db, u, m.group_id);
      res.setHeader("Content-Type", m.mime);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(m.filename)}`,
      );
      return new StreamableFile(m.content);
    }
    if (method === "DELETE" && /^materials\/[\w-]+$/.test(p)) {
      permit(u, [...adminRoles, "TEACHER"]);
      const mid = uuid(p.split("/")[1]),
        r = await db.query(
          "SELECT group_id FROM materials WHERE tenant_id=$1 AND id=$2",
          [u.tenant_id, mid],
        );
      if (!r.rowCount) throw new NotFoundException();
      await group(db, u, r.rows[0].group_id);
      await transaction(async (c) => {
        await c.query("DELETE FROM materials WHERE tenant_id=$1 AND id=$2", [
          u.tenant_id,
          mid,
        ]);
        await record(c, u, "material.delete", mid);
      });
      return { ok: true };
    }
    if (key === "GET audit") {
      permit(u, adminRoles);
      return (
        await db.query(
          "SELECT a.*,u.name AS actor FROM audit a JOIN users u ON u.id=a.user_id WHERE a.tenant_id=$1 ORDER BY a.created_at DESC LIMIT 500",
          [u.tenant_id],
        )
      ).rows;
    }
    if (key === "GET settings") {
      permit(u, adminRoles);
      return (
        await db.query("SELECT * FROM tenants WHERE id=$1", [u.tenant_id])
      ).rows[0];
    }
    if (key === "PATCH settings") {
      permit(u, adminRoles);
      const v = parse(
        z.object({
          name,
          phone: z.string().max(30),
          address: z.string().max(500),
          locale: z.enum(["fr", "ar"]),
        }),
        body,
      );
      await transaction(async (c) => {
        await c.query(
          "UPDATE tenants SET name=$1,phone=$2,address=$3,locale=$4 WHERE id=$5",
          [v.name, v.phone, v.address, v.locale, u.tenant_id],
        );
        await record(c, u, "settings.update", u.tenant_id);
      });
      return { ok: true };
    }
    if (key === "GET export") {
      permit(u, adminRoles);
      const data: Record<string, unknown> = {
        school: (
          await db.query("SELECT * FROM tenants WHERE id=$1", [u.tenant_id])
        ).rows[0],
        exported_at: new Date().toISOString(),
      };
      for (const table of [
        "students",
        "groups",
        "enrollments",
        "lessons",
        "school_closures",
        "lesson_series",
        "attendance",
        "invoices",
        "payments",
        "cash_openings",
        "cash_closures",
        "payroll_payments",
        "announcements",
        "audit",
      ]) {
        data[table] = (
          await db.query("SELECT * FROM " + table + " WHERE tenant_id=$1", [
            u.tenant_id,
          ])
        ).rows;
      }
      data.users = (
        await db.query(
          "SELECT id,name,email,role,locale,active,verified FROM users WHERE tenant_id=$1",
          [u.tenant_id],
        )
      ).rows;
      data.materials = (
        await db.query(
          "SELECT id,group_id,title,filename,mime,created_at FROM materials WHERE tenant_id=$1",
          [u.tenant_id],
        )
      ).rows;
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="midad-export.json"',
      );
      return data;
    }
    throw new NotFoundException("Ressource introuvable");
  }
}
