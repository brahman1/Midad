import nodemailer from "nodemailer";
import { db } from "./db";
import { uid } from "./security";
import { PoolClient } from "pg";
export async function emailJob(
  recipient: string,
  title: string,
  text: string,
  c: PoolClient | typeof db = db,
) {
  await c.query(
    "INSERT INTO outbox(id,channel,recipient,payload) VALUES($1,'email',$2,$3)",
    [uid(), recipient, JSON.stringify({ title, text })],
  );
}
export async function notify(
  c: PoolClient,
  tenant: string,
  user: string,
  title: string,
  body: string,
) {
  await c.query(
    "INSERT INTO notifications(id,tenant_id,user_id,title,body) VALUES($1,$2,$3,$4,$5)",
    [uid(), tenant, user, title, body],
  );
  await c.query(
    `INSERT INTO outbox(id,channel,recipient,payload) SELECT gen_random_uuid(),'push',token,$2::jsonb FROM device_tokens WHERE user_id=$1`,
    [
      user,
      JSON.stringify({
        title: "Midad",
        body: "Une nouvelle information est disponible dans votre espace sécurisé. / معلومة جديدة متاحة في مساحتك الآمنة.",
      }),
    ],
  );
}
export async function deliver() {
  const c = await db.connect();
  let job: any;
  try {
    await c.query("BEGIN");
    const r = await c.query(
      "SELECT * FROM outbox WHERE state='pending' AND next_at<=now() AND (channel='push' OR $1::boolean) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1",
      [!!process.env.SMTP_HOST],
    );
    if (!r.rowCount) {
      await c.query("COMMIT");
      return;
    }
    job = r.rows[0];
    await c.query(
      "UPDATE outbox SET state='sending',attempts=attempts+1,next_at=now()+interval '5 minutes' WHERE id=$1",
      [job.id],
    );
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
  try {
    if (job.channel === "email") {
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_PORT === "465",
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
          : undefined,
      });
      await transport.sendMail({
        from: process.env.SMTP_FROM ?? "Midad <contact@localhost>",
        to: job.recipient,
        subject: job.payload.title,
        text: job.payload.text,
      });
    } else {
      const r = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: job.recipient,
          ...job.payload,
          sound: "default",
        }),
      });
      const data = (await r.json()) as any;
      if (!r.ok || data.data?.status === "error")
        throw new Error("Push non distribué");
    }
    await db.query(
      "UPDATE outbox SET state='sent',recipient='',payload='{}'::jsonb WHERE id=$1",
      [job.id],
    );
  } catch {
    await db.query(
      "UPDATE outbox SET state=CASE WHEN attempts>=5 THEN 'failed' ELSE 'pending' END,next_at=now()+interval '2 minutes' WHERE id=$1",
      [job.id],
    );
  }
}
export function startWorker() {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await db.query(
        "UPDATE outbox SET state='pending' WHERE state='sending' AND next_at<now()",
      );
      await deliver();
    } catch {
      console.error("Worker: livraison reportée");
    } finally {
      running = false;
    }
  }, 1500);
  timer.unref();
  return timer;
}
