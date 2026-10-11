import "dotenv/config";
import { Pool } from "pg";
import { hash } from "bcryptjs";
import { createHash } from "node:crypto";
import { demoConfig } from "./demo-config.mjs";
const { connection, password } = demoConfig();
const db = new Pool({ connectionString: connection });
const c = await db.connect();
const uuid = (key) => {
  const h = createHash("sha256")
    .update("midad-showcase-v2:" + key)
    .digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const isoDay = (offset = 0) =>
  new Date(Date.now() + offset * 86400000).toLocaleDateString("en-CA", {
    timeZone: "Africa/Algiers",
  });
try {
  await c.query("BEGIN");
  const tenant = (
    await c.query("SELECT id FROM tenants WHERE slug='midad-local' FOR UPDATE")
  ).rows[0];
  if (!tenant) throw new Error("Exécuter le jeu de démonstration initial");
  const tid = tenant.id;
  const accounts = (
    await c.query("SELECT id,role FROM users WHERE tenant_id=$1", [tid])
  ).rows;
  const owner = accounts.find((u) => u.role === "OWNER").id;
  const parent = accounts.find((u) => u.role === "PARENT").id;
  const baseTeacher = accounts.find((u) => u.role === "TEACHER").id;
  await c.query(
    "UPDATE tenants SET name='Centre Horizon · Démonstration',address='Alger · adresse fictive' WHERE id=$1",
    [tid],
  );
  const teacherNames = [
    "Samir Benali",
    "Inès Amrani",
    "Riad Meziane",
    "Sonia Larbi",
    "Mehdi Saïdi",
  ];
  const teacherIds = [baseTeacher];
  const encrypted = await hash(password, 12);
  for (let i = 0; i < teacherNames.length; i++) {
    const uid = uuid("teacher:" + i);
    teacherIds.push(uid);
    await c.query(
      "INSERT INTO users(id,tenant_id,name,email,password_hash,role,verified) VALUES($1,$2,$3,$4,$5,'TEACHER',true) ON CONFLICT(id) DO NOTHING",
      [uid, tid, teacherNames[i], `prof-demo-${i}@midad.test`, encrypted],
    );
  }
  const subjects = [
    "Mathématiques",
    "Physique",
    "Sciences naturelles",
    "Anglais",
    "Français",
    "Arabe",
    "Mathématiques",
    "Physique",
  ];
  const first = [
    "Adam",
    "Nour",
    "Aya",
    "Yanis",
    "Lina",
    "Rayane",
    "Amel",
    "Ilyes",
    "Meriem",
    "Nassim",
    "Sarah",
    "Wassim",
  ];
  const last = ["Benali", "Amrani", "Belaïd", "Saïdi", "Meziane", "Larbi"];
  for (let g = 0; g < 8; g++) {
    const gid = uuid("group:" + g),
      teacher = teacherIds[g % 6],
      level = g < 6 ? "3AS" : "2AS",
      fee = (4500 + g * 500) * 100;
    await c.query(
      "INSERT INTO groups(id,tenant_id,name,subject,level,teacher_id,room,capacity,fee_centimes,pay_mode,pay_value) VALUES($1,$2,$3,$4,$5,$6,$7,24,$8,'hour',180000) ON CONFLICT(id) DO NOTHING",
      [
        gid,
        tid,
        `${subjects[g]} · ${level} · G${g + 1}`,
        subjects[g],
        level,
        teacher,
        `Salle ${g + 1}`,
        fee,
      ],
    );
    const sids = [];
    for (let i = 0; i < 9; i++) {
      const n = g * 9 + i,
        sid = uuid("student:" + n);
      sids.push(sid);
      await c.query(
        "INSERT INTO students(id,tenant_id,name,level,parent_id,created_at) VALUES($1,$2,$3,$4,$5,now()-($6::int*interval '1 day')) ON CONFLICT(id) DO NOTHING",
        [
          sid,
          tid,
          `${first[n % 12]} ${last[Math.floor(n / 12) % 6]}`,
          level,
          n === 0 ? parent : null,
          n % 12,
        ],
      );
      await c.query(
        "INSERT INTO enrollments(tenant_id,group_id,student_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
        [tid, gid, sid],
      );
      const iid = uuid("invoice:" + n);
      await c.query(
        "INSERT INTO invoices(id,tenant_id,student_id,group_id,label,amount_centimes,due_date,teacher_id,created_at) VALUES($1,$2,$3,$4,'Mensualité · données de démonstration',$5,$6,$7,now()-interval '6 days') ON CONFLICT(id) DO NOTHING",
        [iid, tid, sid, gid, fee, isoDay(n % 4 === 0 ? -3 : 5), teacher],
      );
      if (n % 4 !== 0) {
        const amount = n % 4 === 1 ? Math.floor(fee / 2) : fee;
        await c.query(
          "INSERT INTO payments(id,tenant_id,invoice_id,amount_centimes,method,reference,created_by,idempotency_key,fingerprint,created_at) VALUES($1,$2,$3,$4,'ccp',$5,$6,$7,'demo-showcase',now()-($8::int*interval '1 day')) ON CONFLICT(id) DO NOTHING",
          [
            uuid("payment:" + n),
            tid,
            iid,
            amount,
            `DEMO-CCP-${n + 1}`,
            owner,
            `showcase-payment-${n}`,
            n % 7,
          ],
        );
      }
    }
    for (let d = -4; d < 7; d++) {
      const day = isoDay(d),
        lid = uuid(`lesson:${gid}:${day}`),
        start = `${day}T${String(9 + g).padStart(2, "0")}:00:00+01:00`,
        end = `${day}T${String(10 + g).padStart(2, "0")}:00:00+01:00`;
      if (d === 0 && Date.parse(start) < Date.now()) continue;
      await c.query(
        "INSERT INTO lessons(id,tenant_id,group_id,starts_at,ends_at,room,notes,status,teacher_id,pay_mode,pay_value) VALUES($1,$2,$3,$4,$5,$6,'Séance fictive de démonstration',$7,$8,'hour',180000) ON CONFLICT(id) DO NOTHING",
        [
          lid,
          tid,
          gid,
          start,
          end,
          `Salle ${g + 1}`,
          d < 0 ? "completed" : "scheduled",
          teacher,
        ],
      );
      if (d < 0)
        for (let i = 0; i < sids.length; i++)
          await c.query(
            "INSERT INTO attendance(tenant_id,lesson_id,student_id,status,updated_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
            [
              tid,
              lid,
              sids[i],
              i === Math.abs(d) ? "absent" : i === 8 ? "late" : "present",
              teacher,
            ],
          );
    }
    await c.query(
      "INSERT INTO materials(id,tenant_id,group_id,title,filename,mime,content,created_by) VALUES($1,$2,$3,$4,'exercices.txt','text/plain',$5,$6) ON CONFLICT(id) DO NOTHING",
      [
        uuid("material:" + g),
        tid,
        gid,
        `${subjects[g]} · exercices de révision`,
        Buffer.from(
          "Document fictif de démonstration.\n1. Relire le chapitre.\n2. Préparer les exercices pour la prochaine séance.",
        ),
        teacher,
      ],
    );
  }
  for (const [i, title, body] of [
    [
      0,
      "Planning de la semaine",
      "Les nouvelles séances sont disponibles dans votre espace. Consultez vos horaires et votre salle avant de venir.",
    ],
    [
      1,
      "Préparation du bac",
      "Les groupes 3AS travaillent cette semaine sur les exercices de révision. Les supports sont disponibles dans Documents.",
    ],
    [
      2,
      "Suivi des règlements",
      "Les familles peuvent consulter leurs échéances et reçus dans leur espace personnel. Toutes les données de cet établissement sont fictives.",
    ],
  ]) {
    await c.query(
      "INSERT INTO announcements(id,tenant_id,title,body,created_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING",
      [uuid("announcement:" + i), tid, title, body, owner],
    );
  }
  await c.query("COMMIT");
  console.log(
    "Démonstration enrichie : 72 élèves supplémentaires, 8 groupes, planning, présences, documents et paiements fictifs.",
  );
} catch (e) {
  await c.query("ROLLBACK");
  throw e;
} finally {
  c.release();
  await db.end();
}
