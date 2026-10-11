import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
const base = process.env.TEST_API_URL ?? "http://127.0.0.1:4100/api";
const origin = process.env.TEST_WEB_URL ?? "http://127.0.0.1:3000";
const mail = process.env.TEST_MAIL_URL ?? "http://127.0.0.1:8028";
const password = "Test-Midad-2026-Secure!";
async function call(
  path,
  {
    token,
    method = "GET",
    body,
    key,
    expected = 200,
    customOrigin = origin,
  } = {},
) {
  const r = await fetch(`${base}/${path}`, {
    method,
    signal: AbortSignal.timeout(15000),
    headers: {
      "Content-Type": "application/json",
      Origin: customOrigin,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json().catch(() => null);
  assert.equal(
    r.status,
    expected,
    `${method} ${path}: ${JSON.stringify(data)}`,
  );
  return data;
}
async function emailToken(address) {
  for (let attempt = 0; attempt < 35; attempt++) {
    const list = await (await fetch(`${mail}/api/v1/messages`)).json();
    const found = list.messages.find((m) =>
      m.To.some((x) => x.Address === address),
    );
    if (found) {
      const msg = await (
        await fetch(`${mail}/api/v1/message/${found.ID}`)
      ).json();
      const raw = msg.Text.match(/token=([A-Za-z0-9_-]+)/)?.[1];
      if (raw) return raw;
    }
    await delay(500);
  }
  throw new Error(`Email non reçu pour ${address}`);
}
test("Parcours métier réel, droits et isolation PostgreSQL", async (t) => {
  const suffix = Date.now().toString(36),
    slug = `test-${suffix}`,
    email = `owner-${suffix}@example.test`;
  let owner,
    other,
    parent,
    teacher,
    studentId,
    secondId,
    groupId,
    lessonId,
    invoiceId,
    paymentId;
  await t.test(
    "Création, email livré, vérification à usage unique et session",
    async () => {
      const r = await call("auth/register", {
        method: "POST",
        body: {
          slug,
          school: "Centre de test Midad",
          name: "Direction Test",
          email,
          password,
        },
        expected: 201,
      });
      owner = r.token;
      assert.ok(owner);
      const me = await call("auth/me", { token: owner });
      assert.equal(me.verified, false);
      await call("students", {
        token: owner,
        method: "POST",
        body: { name: "Élève test" },
        expected: 403,
      });
      const raw = await emailToken(email);
      await call("auth/consume", {
        method: "POST",
        body: { token: raw },
        expected: 201,
      });
      await call("auth/consume", {
        method: "POST",
        body: { token: raw },
        expected: 400,
      });
      assert.equal((await call("auth/me", { token: owner })).verified, true);
    },
  );
  await t.test(
    "Connexion invalide et protection contre les requêtes web étrangères",
    async () => {
      await call("auth/login", {
        method: "POST",
        body: { slug, email, password: "wrong-password" },
        expected: 401,
      });
      await call("auth/login", {
        method: "POST",
        body: { slug, email, password },
        customOrigin: "https://evil.example",
        expected: 403,
      });
      const r = await call("auth/login", {
        method: "POST",
        body: { slug, email, password },
        expected: 201,
      });
      assert.ok(r.token);
      await call("auth/logout", {
        token: r.token,
        method: "POST",
        body: {},
        expected: 201,
      });
      await call("auth/me", { token: r.token, expected: 401 });
    },
  );
  await t.test(
    "Invitation enseignants et parents, activation et restriction de rôles",
    async () => {
      for (const role of ["TEACHER", "PARENT"]) {
        const address = `${role.toLowerCase()}-${suffix}@example.test`;
        const r = await call("auth/invite", {
          token: owner,
          method: "POST",
          body: { name: `${role} Test`, email: address, role },
          expected: 201,
        });
        const raw = await emailToken(address);
        await call("auth/consume", {
          method: "POST",
          body: { token: raw, password },
          expected: 201,
        });
        const session = await call("auth/login", {
          method: "POST",
          body: { slug, email: address, password },
          expected: 201,
        });
        if (role === "TEACHER") teacher = { id: r.id, token: session.token };
        else parent = { id: r.id, token: session.token };
      }
      await call("users", { token: teacher.token, expected: 403 });
      await call("students", {
        token: parent.token,
        method: "POST",
        body: { name: "Injection" },
        expected: 403,
      });
    },
  );
  await t.test(
    "Dossiers, liens parent et capacité du groupe sous concurrence",
    async () => {
      studentId = (
        await call("students", {
          token: owner,
          method: "POST",
          body: { name: "Élève lié", level: "3AS", parent_id: parent.id },
        })
      ).id;
      secondId = (
        await call("students", {
          token: owner,
          method: "POST",
          body: { name: "Autre élève", level: "2AS" },
        })
      ).id;
      groupId = (
        await call("groups", {
          token: owner,
          method: "POST",
          body: {
            name: "Mathématiques 3AS",
            subject: "Mathématiques",
            teacher_id: teacher.id,
            room: "A1",
            capacity: 1,
            fee_centimes: 500000,
            pay_mode: "hour",
            pay_value: 150000,
          },
        })
      ).id;
      await call(`groups/${groupId}/enroll`, {
        token: owner,
        method: "POST",
        body: { student_id: studentId },
      });
      await call(`groups/${groupId}/enroll`, {
        token: owner,
        method: "POST",
        body: { student_id: secondId },
        expected: 409,
      });
      assert.deepEqual(
        (await call("students", { token: parent.token })).map((s) => s.id),
        [studentId],
      );
      assert.deepEqual(
        (await call("students", { token: teacher.token })).map((s) => s.id),
        [studentId],
      );
    },
  );
  await t.test(
    "Conflits de planning, cours passé et contrôle d’un cours futur",
    async () => {
      lessonId = (
        await call("sessions", {
          token: teacher.token,
          method: "POST",
          body: {
            group_id: groupId,
            starts_at: "2025-05-12T08:00:00+01:00",
            ends_at: "2025-05-12T10:00:00+01:00",
            room: "A1",
          },
        })
      ).id;
      await call("sessions", {
        token: owner,
        method: "POST",
        body: {
          group_id: groupId,
          starts_at: "2025-05-12T09:00:00+01:00",
          ends_at: "2025-05-12T11:00:00+01:00",
          room: "A1",
        },
        expected: 409,
      });
      await call(`sessions/${lessonId}/status`, {
        token: teacher.token,
        method: "POST",
        body: { status: "completed" },
      });
      const future = (
        await call("sessions", {
          token: owner,
          method: "POST",
          body: {
            group_id: groupId,
            starts_at: "2030-05-12T09:00:00+01:00",
            ends_at: "2030-05-12T10:00:00+01:00",
          },
        })
      ).id;
      await call(`sessions/${future}/status`, {
        token: teacher.token,
        method: "POST",
        body: { status: "completed" },
        expected: 409,
      });
      const historical = await call("sessions?from=2025-05-12&to=2025-05-13", {
        token: teacher.token,
      });
      assert.deepEqual(
        historical.map((l) => l.id),
        [lessonId],
      );
      assert.equal(historical[0].student_count, 1);
      assert.equal(
        (await call("sessions?from=2025-05-13&to=2025-05-14", { token: owner }))
          .length,
        0,
      );
      assert.ok(
        (
          await call("sessions?from=2030-05-12&to=2030-05-13", { token: owner })
        ).some((l) => l.id === future),
      );
      for (const query of [
        "from=2025-05-13&to=2025-05-12",
        "from=2025-01-01&to=2025-12-31",
        "from=2025-02-30&to=2025-03-02",
        "from=2025-05-12",
      ]) {
        await call(`sessions?${query}`, { token: owner, expected: 400 });
      }
    },
  );
  await t.test(
    "Récurrence, vacances, conflits, fermeture et concurrence sans doublon",
    async () => {
      const closure = (
        await call("planning/closures", {
          token: owner,
          method: "POST",
          body: {
            label: "Vacances de janvier",
            from: "2030-01-13",
            to: "2030-01-19",
          },
        })
      ).id;
      const rule = {
        group_id: groupId,
        from: "2030-01-01",
        to: "2030-03-31",
        weekdays: [0],
        start_time: "09:00",
        duration_minutes: 60,
        excluded_months: [2],
        excluded_dates: ["2030-01-20"],
        excluded_periods: [
          { label: "Pause de mars", from: "2030-03-10", to: "2030-03-16" },
        ],
      };
      await call("planning/preview", {
        token: parent.token,
        method: "POST",
        body: rule,
        expected: 403,
      });
      await call("planning/closures", {
        token: teacher.token,
        method: "POST",
        body: { label: "Interdit", from: "2030-01-01", to: "2030-01-01" },
        expected: 403,
      });
      const preview = await call("planning/preview", {
        token: teacher.token,
        method: "POST",
        body: rule,
      });
      assert.equal(preview.accepted.length, 6);
      assert.equal(preview.excluded.length, 7);
      const request_id = randomUUID();
      const [one, two] = await Promise.all([
        call("planning/series", {
          token: teacher.token,
          method: "POST",
          body: { ...rule, request_id },
        }),
        call("planning/series", {
          token: teacher.token,
          method: "POST",
          body: { ...rule, request_id },
        }),
      ]);
      assert.equal(one.id, two.id);
      assert.equal(one.created, 6);
      assert.equal(two.created, 6);
      const ls = await call("sessions?from=2030-01-01&to=2030-02-01", {
        token: owner,
      });
      assert.equal(ls.filter((l) => l.series_id === one.id).length, 2);
      await call("planning/series", {
        token: owner,
        method: "POST",
        body: { ...rule, request_id: randomUUID() },
        expected: 409,
      });
      await call("planning/series", {
        token: owner,
        method: "POST",
        body: { ...rule, start_time: "10:00", request_id },
        expected: 409,
      });
      const newRule = { ...rule, to: "2030-04-07", skip_conflicts: true };
      const mixed = await call("planning/preview", {
        token: owner,
        method: "POST",
        body: newRule,
      });
      assert.equal(mixed.conflicts.length, 6);
      assert.equal(mixed.accepted.length, 1);
      const more = await call("planning/series", {
        token: owner,
        method: "POST",
        body: { ...newRule, request_id: randomUUID() },
      });
      assert.equal(more.created, 1);
      await call("sessions", {
        token: owner,
        method: "POST",
        body: {
          group_id: groupId,
          starts_at: "2030-01-13T12:00:00+01:00",
          ends_at: "2030-01-13T13:00:00+01:00",
        },
        expected: 409,
      });
      const maintenance = {
        label: "Travaux",
        from: "2030-03-03",
        to: "2030-03-03",
      };
      assert.equal(
        (
          await call("planning/closures/preview", {
            token: owner,
            method: "POST",
            body: maintenance,
          })
        ).affected.length,
        1,
      );
      await call("planning/closures", {
        token: owner,
        method: "POST",
        body: maintenance,
        expected: 409,
      });
      const saved = await call("planning/closures", {
        token: owner,
        method: "POST",
        body: { ...maintenance, cancel_sessions: true },
      });
      assert.equal(saved.cancelled, 1);
      const cancelled = (
        await call("sessions?from=2030-03-03&to=2030-03-04", { token: owner })
      )[0];
      assert.equal(cancelled.status, "cancelled");
      await call(`sessions/${cancelled.id}/status`, {
        token: owner,
        method: "POST",
        body: { status: "scheduled" },
        expected: 409,
      });
      await call(`planning/closures/${saved.id}`, {
        token: owner,
        method: "DELETE",
      });
      assert.equal(
        (
          await call("sessions?from=2030-03-03&to=2030-03-04", { token: owner })
        )[0].status,
        "cancelled",
      );
      assert.equal(
        (
          await call(`planning/series/${one.id}/cancel`, {
            token: teacher.token,
            method: "POST",
            body: {},
          })
        ).cancelled,
        5,
      );
      assert.equal(
        (
          await call(`planning/series/${one.id}/cancel`, {
            token: teacher.token,
            method: "POST",
            body: {},
          })
        ).cancelled,
        0,
      );
      assert.equal(
        (await call("planning/series", { token: teacher.token })).find(
          (s) => s.id === one.id,
        ).total,
        6,
      );
      await call(`planning/series/${more.id}/cancel`, {
        token: owner,
        method: "POST",
        body: {},
      });
      await call(`planning/closures/${closure}`, {
        token: owner,
        method: "DELETE",
      });
    },
  );
  await t.test(
    "Appel, notification sans doublon, justificatif parent et décision",
    async () => {
      await call(`sessions/${lessonId}/attendance`, {
        token: teacher.token,
        method: "PUT",
        body: { entries: [{ student_id: studentId, status: "absent" }] },
      });
      await call(`sessions/${lessonId}/attendance`, {
        token: teacher.token,
        method: "PUT",
        body: { entries: [{ student_id: studentId, status: "absent" }] },
      });
      assert.equal(
        (await call("notifications", { token: parent.token })).filter(
          (n) => n.title === "Absence signalée",
        ).length,
        1,
      );
      const sheet = await call(`sessions/${lessonId}/attendance`, {
        token: parent.token,
      });
      assert.equal(sheet[0].status, "absent");
      await call(`sessions/${lessonId}/justify`, {
        token: parent.token,
        method: "POST",
        body: { student_id: studentId, justification: "Justificatif de test" },
      });
      await call(`sessions/${lessonId}/justify`, {
        token: parent.token,
        method: "POST",
        body: { student_id: secondId, justification: "Tentative interdite" },
        expected: 404,
      });
      await call(`sessions/${lessonId}/decision`, {
        token: teacher.token,
        method: "POST",
        body: { student_id: studentId, decision: "accepted" },
      });
      assert.equal(
        (
          await call(`sessions/${lessonId}/attendance`, { token: parent.token })
        )[0].decision,
        "accepted",
      );
    },
  );
  await t.test(
    "Facturation mensuelle sans doublon, paiement partiel et plafonds",
    async () => {
      const payload = {
        group_id: groupId,
        month: "2026-10",
        due_date: "2026-10-20",
      };
      assert.equal(
        (
          await call("invoices/generate", {
            token: owner,
            method: "POST",
            body: payload,
          })
        ).created,
        1,
      );
      assert.equal(
        (
          await call("invoices/generate", {
            token: owner,
            method: "POST",
            body: payload,
          })
        ).created,
        0,
      );
      invoiceId = (await call("invoices", { token: owner }))[0].id;
      await call("payments", {
        token: parent.token,
        method: "POST",
        body: { invoice_id: invoiceId, amount_centimes: 10000, method: "cash" },
        key: randomUUID(),
        expected: 403,
      });
      await call("payments", {
        token: owner,
        method: "POST",
        body: {
          invoice_id: invoiceId,
          amount_centimes: 500001,
          method: "cash",
        },
        key: randomUUID(),
        expected: 409,
      });
      await call("payments", {
        token: owner,
        method: "POST",
        body: { invoice_id: invoiceId, amount_centimes: 10000, method: "ccp" },
        key: randomUUID(),
        expected: 400,
      });
    },
  );
  await t.test(
    "Double clic/concurrence : un seul versement et référence immuable",
    async () => {
      const k = randomUUID(),
        payload = {
          invoice_id: invoiceId,
          amount_centimes: 123456,
          method: "cash",
        };
      const both = await Promise.all([
        call("payments", {
          token: owner,
          method: "POST",
          body: payload,
          key: k,
        }),
        call("payments", {
          token: owner,
          method: "POST",
          body: payload,
          key: k,
        }),
      ]);
      assert.equal(both[0].id, both[1].id);
      paymentId = both[0].id;
      assert.equal(
        (await call("invoices", { token: parent.token }))[0].balance_centimes,
        376544,
      );
      await call("payments", {
        token: owner,
        method: "POST",
        body: { ...payload, amount_centimes: 10000 },
        key: k,
        expected: 409,
      });
      await call(`invoices/${invoiceId}/cancel`, {
        token: owner,
        method: "POST",
        body: {},
        expected: 409,
      });
    },
  );
  await t.test(
    "Remboursement exact, reçu, contrôle du disponible et audit",
    async () => {
      await call("refunds", {
        token: owner,
        method: "POST",
        body: {
          payment_id: paymentId,
          amount_centimes: 23456,
          reference: "Remboursement de test",
        },
        key: randomUUID(),
      });
      assert.equal(
        (await call("invoices", { token: owner }))[0].paid_centimes,
        100000,
      );
      await call("refunds", {
        token: owner,
        method: "POST",
        body: {
          payment_id: paymentId,
          amount_centimes: 100001,
          reference: "Trop élevé",
        },
        key: randomUUID(),
        expected: 409,
      });
      const p = await call("payments", { token: parent.token });
      assert.equal(p.length, 2);
      assert.ok(p.every((x) => x.receipt_number > 0));
      assert.ok(
        (await call("audit", { token: owner })).some(
          (a) => a.action === "payment.refund",
        ),
      );
    },
  );
  await t.test(
    "Rémunération sur les séances terminées, versement et plafond",
    async () => {
      const r = await call("payroll?month=2025-05", { token: teacher.token });
      assert.equal(r[0].earned_centimes, 300000);
      await call("payroll", {
        token: owner,
        method: "POST",
        body: {
          teacher_id: teacher.id,
          month: "2025-05",
          amount_centimes: 100000,
          reference: "PAIE-TEST-1",
        },
      });
      assert.equal(
        (await call("payroll?month=2025-05", { token: owner }))[0]
          .balance_centimes,
        200000,
      );
      await call("payroll", {
        token: owner,
        method: "POST",
        body: {
          teacher_id: teacher.id,
          month: "2025-05",
          amount_centimes: 200001,
          reference: "PAIE-TEST-2",
        },
        expected: 409,
      });
    },
  );
  await t.test(
    "Tarifs enseignants figés et paiements de paie sans doublon",
    async () => {
      const g = (await call("groups", { token: owner })).find(
        (g) => g.id === groupId,
      );
      await call("groups/" + groupId, {
        token: owner,
        method: "PATCH",
        body: { ...g, pay_value: 250000 },
      });
      assert.equal(
        (await call("payroll?month=2025-05", { token: owner }))[0]
          .earned_centimes,
        300000,
      );
      await call("payroll", {
        token: owner,
        method: "POST",
        body: {
          teacher_id: teacher.id,
          month: "2025-05",
          amount_centimes: 100000,
          reference: "PAIE-TEST-1",
        },
      });
      assert.equal(
        (await call("payroll?month=2025-05", { token: owner }))[0]
          .balance_centimes,
        200000,
      );
      await call("sessions/" + lessonId + "/status", {
        token: owner,
        method: "POST",
        body: { status: "cancelled" },
        expected: 409,
      });
    },
  );
  await t.test(
    "Pourcentage fixé à la facturation et corrigé par les remboursements",
    async () => {
      const gbody = {
        name: "Groupe pourcentage",
        subject: "Physique",
        teacher_id: teacher.id,
        capacity: 10,
        fee_centimes: 100000,
        pay_mode: "percent",
        pay_value: 5000,
      };
      const gid = (
        await call("groups", { token: owner, method: "POST", body: gbody })
      ).id;
      await call("groups/" + gid + "/enroll", {
        token: owner,
        method: "POST",
        body: { student_id: secondId },
      });
      const iid = (
        await call("invoices", {
          token: owner,
          method: "POST",
          body: {
            student_id: secondId,
            group_id: gid,
            label: "Échéance pourcentage",
            amount_centimes: 100000,
            due_date: "2026-12-31",
          },
        })
      ).id;
      await call("groups/" + gid, {
        token: owner,
        method: "PATCH",
        body: { ...gbody, pay_value: 7500 },
      });
      const pay = await call("payments", {
        token: owner,
        method: "POST",
        body: {
          invoice_id: iid,
          amount_centimes: 100000,
          method: "ccp",
          reference: "CCP-POURCENT",
        },
        key: randomUUID(),
      });
      const current = new Date()
        .toLocaleDateString("en-CA", { timeZone: "Africa/Algiers" })
        .slice(0, 7);
      assert.equal(
        (await call("payroll?month=" + current, { token: teacher.token }))[0]
          .earned_centimes,
        50000,
      );
      await call("refunds", {
        token: owner,
        method: "POST",
        body: {
          payment_id: pay.id,
          amount_centimes: 20000,
          reference: "Remboursement pourcentage",
        },
        key: randomUUID(),
      });
      assert.equal(
        (await call("payroll?month=" + current, { token: teacher.token }))[0]
          .earned_centimes,
        40000,
      );
    },
  );
  await t.test(
    "Concurrence de 15 règlements de paie : une écriture, aucun blocage du pool",
    async () => {
      const payload = {
        teacher_id: teacher.id,
        month: "2025-05",
        amount_centimes: 100000,
        reference: "PAIE-CONCURRENCE",
      };
      await Promise.all(
        Array.from({ length: 15 }, () =>
          call("payroll", { token: owner, method: "POST", body: payload }),
        ),
      );
      assert.equal(
        (await call("payroll?month=2025-05", { token: owner }))[0]
          .paid_centimes,
        200000,
      );
    },
  );
  await t.test(
    "Documents protégés, contenu téléchargé et annonces ciblées",
    async () => {
      const content = "Support pédagogique Midad";
      const r = await call("materials", {
        token: teacher.token,
        method: "POST",
        body: {
          group_id: groupId,
          title: "Support mathématiques",
          filename: "support.txt",
          mime: "text/plain",
          base64: Buffer.from(content).toString("base64"),
        },
      });
      const bytes = await fetch(`${base}/materials/${r.id}`, {
        headers: { Authorization: `Bearer ${parent.token}` },
      });
      assert.equal(bytes.status, 200);
      assert.equal(await bytes.text(), content);
      await call("materials", {
        token: teacher.token,
        method: "POST",
        body: {
          group_id: groupId,
          title: "Faux PNG",
          filename: "x.png",
          mime: "image/png",
          base64: "AA==",
        },
        expected: 400,
      });
      await call("announcements", {
        token: teacher.token,
        method: "POST",
        body: {
          group_id: groupId,
          title: "Annonce ciblée",
          body: "Cours révisé dans le groupe.",
        },
      });
      assert.equal(
        (await call("announcements", { token: parent.token }))[0].title,
        "Annonce ciblée",
      );
      await call("announcements", {
        token: teacher.token,
        method: "POST",
        body: {
          title: "Annonce globale interdite",
          body: "Ne doit pas être créé.",
        },
        expected: 403,
      });
    },
  );
  await t.test(
    "Deux établissements : aucun accès croisé par identifiant",
    async () => {
      const oe = `other-${suffix}@example.test`;
      const r = await call("auth/register", {
        method: "POST",
        body: {
          slug: `other-${suffix}`,
          school: "Autre centre",
          name: "Autre direction",
          email: oe,
          password,
        },
        expected: 201,
      });
      other = r.token;
      await call("auth/consume", {
        method: "POST",
        body: { token: await emailToken(oe) },
        expected: 201,
      });
      assert.equal((await call("students", { token: other })).length, 0);
      assert.equal((await call("payments", { token: other })).length, 0);
      const ownClosure = (
        await call("planning/closures", {
          token: owner,
          method: "POST",
          body: {
            label: "Vacances privées",
            from: "2031-07-01",
            to: "2031-08-31",
          },
        })
      ).id;
      assert.deepEqual(await call("planning/closures", { token: other }), []);
      assert.deepEqual(await call("planning/series", { token: other }), []);
      await call(`planning/closures/${ownClosure}`, {
        token: other,
        method: "DELETE",
        expected: 404,
      });
      const ownSeries = (await call("planning/series", { token: owner }))[0];
      await call(`planning/series/${ownSeries.id}/cancel`, {
        token: other,
        method: "POST",
        body: {},
        expected: 404,
      });
      await call("planning/preview", {
        token: other,
        method: "POST",
        body: {
          group_id: groupId,
          from: "2031-01-01",
          to: "2031-02-01",
          weekdays: [0],
          start_time: "09:00",
          duration_minutes: 60,
        },
        expected: 404,
      });
      await call(`planning/closures/${ownClosure}`, {
        token: owner,
        method: "DELETE",
      });
      assert.deepEqual(
        await call("sessions?from=2025-05-12&to=2025-05-13", { token: other }),
        [],
      );
      assert.ok(
        (
          await call("sessions?from=2025-05-12&to=2025-05-13", {
            token: parent.token,
          })
        ).every((l) => l.group_id === groupId),
      );
      const otherDashboard = await call("dashboard", { token: other });
      assert.deepEqual(otherDashboard.recent_payments, []);
      assert.deepEqual(otherDashboard.recent_students, []);
      assert.deepEqual(otherDashboard.group_overview, []);
      const familyDashboard = await call("dashboard", { token: parent.token });
      assert.deepEqual(
        familyDashboard.recent_students.map((s) => s.id),
        [studentId],
      );
      assert.ok(
        familyDashboard.outstanding.every((i) => i.student_id === studentId),
      );
      assert.ok(
        familyDashboard.recent_payments.every(
          (p) => p.student_name === "Élève lié",
        ),
      );
      const teacherDashboard = await call("dashboard", {
        token: teacher.token,
      });
      assert.deepEqual(teacherDashboard.recent_payments, []);
      assert.deepEqual(teacherDashboard.cashflow, []);
      assert.equal(teacherDashboard.collected_centimes, null);
      await call(`groups/${groupId}/students`, { token: other, expected: 404 });
      await call(`students/${studentId}`, {
        token: other,
        method: "PATCH",
        body: { name: "Édition croisée" },
        expected: 404,
      });
      await call("payments", {
        token: other,
        method: "POST",
        body: { invoice_id: invoiceId, amount_centimes: 1000, method: "cash" },
        key: randomUUID(),
        expected: 404,
      });
      await call("students", {
        token: other,
        method: "POST",
        body: { name: "Lien parent croisé", parent_id: parent.id },
        expected: 400,
      });
    },
  );
  await t.test(
    "Clôture atomique, écart et interdiction de mouvements après clôture",
    async () => {
      const cash = await call("cash", { token: owner });
      assert.equal(cash.expected_centimes, 100000);
      await call("cash/open", {
        token: owner,
        method: "POST",
        body: { amount_centimes: 10000 },
      });
      assert.equal(
        (await call("cash", { token: owner })).expected_centimes,
        110000,
      );
      await call("cash/open", {
        token: owner,
        method: "POST",
        body: { amount_centimes: 10000 },
        expected: 409,
      });
      await call("cash/close", {
        token: owner,
        method: "POST",
        body: {
          day: cash.day,
          counted_centimes: 109000,
          notes: "Écart test 10 DA",
        },
      });
      const closed = await call("cash", { token: owner });
      assert.equal(
        closed.closure.counted_centimes - closed.closure.expected_centimes,
        -1000,
      );
      await call("payments", {
        token: owner,
        method: "POST",
        body: { invoice_id: invoiceId, amount_centimes: 1000, method: "cash" },
        key: randomUUID(),
        expected: 409,
      });
      await call("cash/close", {
        token: owner,
        method: "POST",
        body: { day: cash.day, counted_centimes: 109000 },
        expected: 409,
      });
    },
  );
  await t.test(
    "Export sans secret et suppression de compte avec révocation",
    async () => {
      const data = await call("export", { token: owner });
      assert.ok(data.students.length >= 2);
      assert.ok(!JSON.stringify(data).includes("password_hash"));
      await call("auth/delete-account", {
        token: parent.token,
        method: "POST",
        body: { password },
        expected: 201,
      });
      await call("auth/me", { token: parent.token, expected: 401 });
      await call("auth/delete-account", {
        token: owner,
        method: "POST",
        body: { password },
        expected: 400,
      });
    },
  );
});
