import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { PoolClient } from "pg";
import { z } from "zod";
import {
  User,
  adminRoles,
  recurrenceInput,
  exclusionPeriod,
  generateRecurrence,
  overlappingClosure,
  RecurrenceRule,
  ClosurePeriod,
} from "@midad/shared";
import { db, transaction } from "./db";
import { permit, parse, uid, uuid, hash } from "./security";
import { notify } from "./mail";
type DB = PoolClient | typeof db;
const writers = [...adminRoles, "TEACHER"] as const;
async function audit(
  c: DB,
  u: User,
  action: string,
  id: string,
  detail: unknown,
) {
  await c.query(
    "INSERT INTO audit(id,tenant_id,user_id,action,entity_id,detail) VALUES($1,$2,$3,$4,$5,$6)",
    [uid(), u.tenant_id, u.id, action, id, JSON.stringify(detail)],
  );
}
async function lock(c: DB, u: User) {
  await c.query("SELECT id FROM tenants WHERE id=$1 FOR UPDATE", [u.tenant_id]);
}
export async function schoolClosures(c: DB, tenant: string) {
  return (
    await c.query(
      'SELECT id,label,starts_on AS "from",ends_on AS "to" FROM school_closures WHERE tenant_id=$1 ORDER BY starts_on',
      [tenant],
    )
  ).rows;
}
export async function ensureSchoolOpen(
  c: DB,
  tenant: string,
  start: string,
  end: string,
) {
  const closure = overlappingClosure(
    start,
    end,
    await schoolClosures(c, tenant),
  );
  if (closure)
    throw new ConflictException(
      `Établissement fermé : ${closure.label} (${closure.from} — ${closure.to})`,
    );
}
async function allowedGroup(c: DB, u: User, id: string, active = true) {
  const g = (
    await c.query(
      "SELECT * FROM groups WHERE tenant_id=$1 AND id=$2 AND (active OR NOT $5::boolean) AND ($3::text<>'TEACHER' OR teacher_id=$4)",
      [u.tenant_id, id, u.role, u.id, active],
    )
  ).rows[0];
  if (!g) throw new NotFoundException("Groupe introuvable");
  return g;
}
async function preview(c: DB, u: User, rule: RecurrenceRule) {
  const g = await allowedGroup(c, u, rule.group_id);
  const result = generateRecurrence(rule, await schoolClosures(c, u.tenant_id));
  const room = rule.room || g.room;
  const existing = result.occurrences.length
    ? (
        await c.query(
          "SELECT l.id,l.starts_at,l.ends_at,l.room,g.name AS group_name,g.teacher_id FROM lessons l JOIN groups g ON g.tenant_id=l.tenant_id AND g.id=l.group_id WHERE l.tenant_id=$1 AND l.status<>'cancelled' AND l.ends_at>$2 AND l.starts_at<$3 AND (l.group_id=$4 OR (l.room<>'' AND l.room=$5) OR (g.teacher_id IS NOT NULL AND g.teacher_id=$6)) ORDER BY l.starts_at",
          [
            u.tenant_id,
            result.occurrences[0].starts_at,
            result.occurrences.at(-1)!.ends_at,
            g.id,
            room,
            g.teacher_id,
          ],
        )
      ).rows
    : [];
  const conflicts = result.occurrences.flatMap((o) => {
    const clashes = existing.filter(
      (l) =>
        Date.parse(l.starts_at) < Date.parse(o.ends_at) &&
        Date.parse(l.ends_at) > Date.parse(o.starts_at),
    );
    return clashes.length
      ? [
          {
            ...o,
            conflicts: clashes.map((l) => ({
              id: l.id,
              group_name: l.group_name,
              room: l.room,
              starts_at: l.starts_at,
              ends_at: l.ends_at,
            })),
          },
        ]
      : [];
  });
  const dates = new Set(conflicts.map((o) => o.date));
  return {
    ...result,
    room,
    conflicts,
    accepted: result.occurrences.filter((o) => !dates.has(o.date)),
    group: g,
  };
}
const closureInput = exclusionPeriod.and(
  z.object({ cancel_sessions: z.boolean().default(false) }),
);
async function affected(c: DB, u: User, p: ClosurePeriod) {
  return (
    await c.query(
      "SELECT id,group_id,starts_at FROM lessons WHERE tenant_id=$1 AND status='scheduled' AND starts_at>=now() AND starts_at<($3::date+1)::timestamp AT TIME ZONE 'Africa/Algiers' AND ends_at>$2::date::timestamp AT TIME ZONE 'Africa/Algiers' ORDER BY starts_at",
      [u.tenant_id, p.from, p.to],
    )
  ).rows;
}
async function cancelNotice(
  c: PoolClient,
  u: User,
  lessons: { group_id: string }[],
  title: string,
  body: string,
) {
  const groups = [...new Set(lessons.map((l) => l.group_id))];
  if (!groups.length) return;
  const recipients = (
    await c.query(
      "SELECT DISTINCT id FROM (SELECT g.teacher_id AS id FROM groups g WHERE g.tenant_id=$1 AND g.id=ANY($2::uuid[]) UNION SELECT unnest(ARRAY[s.parent_id,s.user_id]) FROM students s JOIN enrollments e ON e.tenant_id=s.tenant_id AND e.student_id=s.id WHERE s.tenant_id=$1 AND s.active AND e.group_id=ANY($2::uuid[])) r WHERE id IS NOT NULL",
      [u.tenant_id, groups],
    )
  ).rows;
  for (const r of recipients) await notify(c, u.tenant_id, r.id, title, body);
}
export async function planningRoute(
  u: User,
  key: string,
  p: string,
  body: unknown,
) {
  if (key === "GET planning/closures") return schoolClosures(db, u.tenant_id);
  if (key === "POST planning/closures/preview") {
    permit(u, adminRoles);
    const v = parse(closureInput, body);
    return { affected: await affected(db, u, v) };
  }
  if (key === "POST planning/closures") {
    permit(u, adminRoles);
    const v = parse(closureInput, body);
    return transaction(async (c) => {
      await lock(c, u);
      const sessions = await affected(c, u, v);
      if (sessions.length && !v.cancel_sessions)
        throw new ConflictException(
          `${sessions.length} séances sont prévues : confirmez leur annulation ou changez les dates.`,
        );
      const id = uid();
      await c.query(
        "INSERT INTO school_closures(id,tenant_id,label,starts_on,ends_on,created_by) VALUES($1,$2,$3,$4,$5,$6)",
        [id, u.tenant_id, v.label, v.from, v.to, u.id],
      );
      if (sessions.length) {
        await c.query(
          "UPDATE lessons SET status='cancelled' WHERE tenant_id=$1 AND id=ANY($2::uuid[])",
          [u.tenant_id, sessions.map((l) => l.id)],
        );
        await cancelNotice(
          c,
          u,
          sessions,
          "Fermeture de l’établissement",
          `${v.label} : du ${v.from} au ${v.to}. ${sessions.length} séances prévues annulées. Consultez le planning.`,
        );
      }
      await audit(c, u, "planning.closure.create", id, {
        ...v,
        cancelled: sessions.length,
      });
      return { id, cancelled: sessions.length };
    });
  }
  if (key.startsWith("DELETE ") && /^planning\/closures\/[\w-]+$/.test(p)) {
    permit(u, adminRoles);
    return transaction(async (c) => {
      await lock(c, u);
      const id = uuid(p.split("/")[2]);
      const r = await c.query(
        "DELETE FROM school_closures WHERE tenant_id=$1 AND id=$2 RETURNING *",
        [u.tenant_id, id],
      );
      if (!r.rowCount) throw new NotFoundException("Fermeture introuvable");
      await audit(c, u, "planning.closure.remove", id, r.rows[0]);
      return { ok: true };
    });
  }
  if (key === "GET planning/series") {
    permit(u, writers);
    return (
      await db.query(
        "SELECT s.id,s.rule,s.created_at,g.name AS group_name,count(l.id)::int AS total,count(l.id) FILTER(WHERE l.status='scheduled' AND l.starts_at>=now())::int AS future FROM lesson_series s JOIN groups g ON g.tenant_id=s.tenant_id AND g.id=s.group_id LEFT JOIN lessons l ON l.tenant_id=s.tenant_id AND l.series_id=s.id WHERE s.tenant_id=$1 AND ($2::text<>'TEACHER' OR g.teacher_id=$3) GROUP BY s.id,g.name ORDER BY s.created_at DESC LIMIT 100",
        [u.tenant_id, u.role, u.id],
      )
    ).rows;
  }
  if (key === "POST planning/preview" || key === "POST planning/series") {
    permit(u, writers);
    const rule = parse(recurrenceInput, body);
    if (key === "POST planning/preview") {
      const { group, ...v } = await preview(db, u, rule);
      return { ...v, group_name: group.name };
    }
    const requestId = parse(
      z.object({ request_id: z.uuid() }),
      body,
    ).request_id;
    return transaction(async (c) => {
      await lock(c, u);
      await allowedGroup(c, u, rule.group_id);
      const fingerprint = hash(JSON.stringify(rule));
      const old = (
        await c.query(
          "SELECT id,fingerprint FROM lesson_series WHERE tenant_id=$1 AND id=$2",
          [u.tenant_id, requestId],
        )
      ).rows[0];
      if (old) {
        if (old.fingerprint !== fingerprint)
          throw new ConflictException(
            "Cette demande a déjà été utilisée avec d’autres paramètres",
          );
        return {
          id: old.id,
          created: (
            await c.query(
              "SELECT count(*)::int AS count FROM lessons WHERE tenant_id=$1 AND series_id=$2",
              [u.tenant_id, old.id],
            )
          ).rows[0].count,
          replayed: true,
        };
      }
      const v = await preview(c, u, rule);
      if (v.conflicts.length && !rule.skip_conflicts)
        throw new ConflictException(
          `${v.conflicts.length} conflits détectés. Actualisez l’aperçu, changez les horaires ou excluez explicitement les conflits.`,
        );
      if (!v.accepted.length)
        throw new BadRequestException(
          "Aucune séance à programmer sur cette période",
        );
      await c.query(
        "INSERT INTO lesson_series(id,tenant_id,group_id,rule,fingerprint,created_by) VALUES($1,$2,$3,$4,$5,$6)",
        [
          requestId,
          u.tenant_id,
          rule.group_id,
          JSON.stringify(rule),
          fingerprint,
          u.id,
        ],
      );
      for (const o of v.accepted)
        await c.query(
          "INSERT INTO lessons(id,tenant_id,group_id,starts_at,ends_at,room,notes,teacher_id,pay_mode,pay_value,series_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
          [
            uid(),
            u.tenant_id,
            rule.group_id,
            o.starts_at,
            o.ends_at,
            v.room,
            rule.notes,
            v.group.teacher_id,
            v.group.pay_mode,
            v.group.pay_value,
            requestId,
          ],
        );
      await audit(c, u, "planning.series.create", requestId, {
        rule,
        created: v.accepted.length,
        excluded: v.excluded.length,
        conflicts: v.conflicts.length,
      });
      return {
        id: requestId,
        created: v.accepted.length,
        excluded: v.excluded.length,
        conflicts: v.conflicts.length,
      };
    });
  }
  if (key.startsWith("POST ") && /^planning\/series\/[\w-]+\/cancel$/.test(p)) {
    permit(u, writers);
    return transaction(async (c) => {
      await lock(c, u);
      const id = uuid(p.split("/")[2]);
      const s = (
        await c.query(
          "SELECT group_id FROM lesson_series WHERE tenant_id=$1 AND id=$2",
          [u.tenant_id, id],
        )
      ).rows[0];
      if (!s) throw new NotFoundException("Série introuvable");
      await allowedGroup(c, u, s.group_id, false);
      const r = await c.query(
        "UPDATE lessons SET status='cancelled' WHERE tenant_id=$1 AND series_id=$2 AND status='scheduled' AND starts_at>=now() RETURNING group_id",
        [u.tenant_id, id],
      );
      await cancelNotice(
        c,
        u,
        r.rows,
        "Séances récurrentes annulées",
        "Les prochaines séances d’une série ont été annulées. Consultez votre planning.",
      );
      await audit(c, u, "planning.series.cancel", id, {
        cancelled: r.rowCount,
      });
      return { cancelled: r.rowCount };
    });
  }
  throw new NotFoundException("Action de planning introuvable");
}
