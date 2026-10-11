import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { Request, Response } from "express";
import { hash as bcryptHash, compare } from "bcryptjs";
import { z } from "zod";
import {
  registration,
  login,
  email,
  password,
  name,
  roles,
} from "@midad/shared";
import { db, transaction } from "./db";
import {
  AuthGuard,
  AuthRequest,
  checkOrigin,
  hash,
  parse,
  token,
  uid,
  permit,
} from "./security";
import { emailJob } from "./mail";
import { PoolClient } from "pg";
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api",
  maxAge: 7 * 86400000,
});
async function issueSession(c: PoolClient, userId: string, res: Response) {
  const raw = token();
  await c.query(
    "INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",
    [hash(raw), userId],
  );
  res.cookie("midad_session", raw, cookieOptions());
  return raw;
}
async function authEmail(
  c: PoolClient,
  user: any,
  kind: "verify" | "reset" | "invite",
) {
  const raw = token();
  await c.query("DELETE FROM auth_tokens WHERE user_id=$1 AND kind=$2", [
    user.id,
    kind,
  ]);
  await c.query(
    "INSERT INTO auth_tokens(token_hash,user_id,kind,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",
    [hash(raw), user.id, kind],
  );
  const url = `${process.env.WEB_URL ?? "http://localhost:3000"}/auth?mode=${kind}&token=${raw}`;
  await emailJob(
    user.email,
    kind === "verify"
      ? "Vérifiez votre compte Midad"
      : kind === "reset"
        ? "Réinitialisez votre mot de passe Midad"
        : "Votre invitation Midad",
    `Bonjour ${user.name},\n\n${url}\n\nCe lien est valable une heure. Si vous n'avez pas demandé cette action, ignorez cet email.`,
    c,
  );
}
@Controller("api/auth")
export class AuthController {
  @Post("register") async register(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    checkOrigin(req);
    const v = parse(registration, body);
    const encrypted = await bcryptHash(v.password, 12);
    return transaction(async (c) => {
      const tid = uid(),
        userId = uid();
      await c.query(
        "INSERT INTO tenants(id,name,slug,phone,locale) VALUES($1,$2,$3,$4,$5)",
        [tid, v.school, v.slug, v.phone, v.locale],
      );
      await c.query(
        "INSERT INTO users(id,tenant_id,name,email,password_hash,role,locale) VALUES($1,$2,$3,$4,$5,'OWNER',$6)",
        [userId, tid, v.name, v.email, encrypted, v.locale],
      );
      await authEmail(
        c,
        { id: userId, email: v.email, name: v.name },
        "verify",
      );
      return {
        token: await issueSession(c, userId, res),
        verification_required: true,
      };
    });
  }
  @Post("login") async login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    checkOrigin(req);
    const v = parse(login, body);
    const r = await db.query(
      "SELECT u.* FROM users u JOIN tenants t ON t.id=u.tenant_id WHERE t.slug=$1 AND u.email=$2 AND u.active",
      [v.slug, v.email],
    );
    const u = r.rows[0];
    const fallback =
      "$2b$12$hpmRlboBUdpwNGxgAMUjoODNzHFvscGGybPwwISihEGvcWIgJohVi";
    const valid = await compare(v.password, u?.password_hash ?? fallback);
    if (!u || !valid)
      throw new UnauthorizedException("Identifiants incorrects");
    return transaction(async (c) => ({
      token: await issueSession(c, u.id, res),
    }));
  }
  @UseGuards(AuthGuard) @Get("me") me(@Req() req: AuthRequest) {
    return req.user;
  }
  @UseGuards(AuthGuard) @Post("logout") async logout(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await db.query("DELETE FROM auth_sessions WHERE token_hash=$1", [
      req.sessionHash,
    ]);
    res.clearCookie("midad_session", { path: "/api" });
    return { ok: true };
  }
  @UseGuards(AuthGuard) @Post("resend") async resend(@Req() req: AuthRequest) {
    if (req.user.verified) return { ok: true };
    await transaction((c) => authEmail(c, req.user, "verify"));
    return { ok: true };
  }
  @Post("forgot") async forgot(@Body() body: unknown, @Req() req: Request) {
    checkOrigin(req);
    const v = parse(z.object({ slug: z.string().max(40), email }), body);
    const r = await db.query(
      "SELECT u.* FROM users u JOIN tenants t ON t.id=u.tenant_id WHERE t.slug=$1 AND u.email=$2 AND u.active",
      [v.slug, v.email],
    );
    if (r.rowCount) await transaction((c) => authEmail(c, r.rows[0], "reset"));
    return { ok: true };
  }
  @Post("consume") async consume(@Body() body: unknown, @Req() req: Request) {
    checkOrigin(req);
    const v = parse(
      z.object({
        token: z.string().min(20).max(100),
        password: password.optional(),
      }),
      body,
    );
    return transaction(async (c) => {
      const r = await c.query(
        "SELECT * FROM auth_tokens WHERE token_hash=$1 AND expires_at>now() FOR UPDATE",
        [hash(v.token)],
      );
      if (!r.rowCount)
        throw new BadRequestException("Lien expiré ou déjà utilisé");
      const a = r.rows[0];
      if (a.kind !== "verify" && !v.password)
        throw new BadRequestException("Mot de passe requis");
      if (v.password) {
        await c.query(
          "UPDATE users SET password_hash=$1,verified=true WHERE id=$2",
          [await bcryptHash(v.password, 12), a.user_id],
        );
        await c.query("DELETE FROM auth_sessions WHERE user_id=$1", [
          a.user_id,
        ]);
      } else
        await c.query("UPDATE users SET verified=true WHERE id=$1", [
          a.user_id,
        ]);
      await c.query("DELETE FROM auth_tokens WHERE user_id=$1", [a.user_id]);
      return { ok: true };
    });
  }
  @UseGuards(AuthGuard) @Post("password") async change(
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    const v = parse(z.object({ current: z.string().max(128), password }), body);
    const r = await db.query("SELECT password_hash FROM users WHERE id=$1", [
      req.user.id,
    ]);
    if (!(await compare(v.current, r.rows[0].password_hash)))
      throw new UnauthorizedException("Mot de passe incorrect");
    await transaction(async (c) => {
      await c.query("UPDATE users SET password_hash=$1 WHERE id=$2", [
        await bcryptHash(v.password, 12),
        req.user.id,
      ]);
      await c.query(
        "DELETE FROM auth_sessions WHERE user_id=$1 AND token_hash<>$2",
        [req.user.id, req.sessionHash],
      );
    });
    return { ok: true };
  }
  @UseGuards(AuthGuard) @Post("invite") async invite(
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    permit(req.user, ["OWNER", "MANAGER"]);
    if (!req.user.verified)
      throw new ForbiddenException("Vérifiez votre adresse email");
    const v = parse(
      z.object({
        name,
        email,
        role: z.enum(
          roles.filter((r) => r !== "OWNER") as [
            "MANAGER",
            "CASHIER",
            "TEACHER",
            "PARENT",
            "STUDENT",
          ],
        ),
        locale: z.enum(["fr", "ar"]).default("fr"),
      }),
      body,
    );
    if (req.user.role !== "OWNER" && v.role === "MANAGER")
      throw new ForbiddenException(
        "Seul le propriétaire peut créer un responsable",
      );
    return transaction(async (c) => {
      const u = { id: uid(), ...v };
      await c.query(
        "INSERT INTO users(id,tenant_id,name,email,password_hash,role,locale) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          u.id,
          req.user.tenant_id,
          v.name,
          v.email,
          await bcryptHash(token(), 12),
          v.role,
          v.locale,
        ],
      );
      await authEmail(c, u, "invite");
      await c.query(
        "INSERT INTO audit(id,tenant_id,user_id,action,entity_id) VALUES($1,$2,$3,'invite',$4)",
        [uid(), req.user.tenant_id, req.user.id, u.id],
      );
      return { id: u.id };
    });
  }
  @UseGuards(AuthGuard) @Post("delete-account") async remove(
    @Body() body: unknown,
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const v = parse(z.object({ password: z.string().max(128) }), body);
    const r = await db.query("SELECT password_hash FROM users WHERE id=$1", [
      req.user.id,
    ]);
    if (!(await compare(v.password, r.rows[0].password_hash)))
      throw new UnauthorizedException("Mot de passe incorrect");
    if (req.user.role === "OWNER")
      throw new BadRequestException(
        "Transférez la propriété de votre établissement à un autre responsable avant de supprimer ce compte.",
      );
    await transaction(async (c) => {
      await c.query(
        "UPDATE users SET active=false,name='Compte supprimé',email=$1,password_hash=$2 WHERE id=$3",
        [
          `deleted-${req.user.id}@invalid.local`,
          await bcryptHash(token(), 12),
          req.user.id,
        ],
      );
      await c.query("DELETE FROM auth_sessions WHERE user_id=$1", [
        req.user.id,
      ]);
      await c.query("DELETE FROM auth_tokens WHERE user_id=$1", [req.user.id]);
      await c.query("DELETE FROM device_tokens WHERE user_id=$1", [
        req.user.id,
      ]);
      await c.query("DELETE FROM notifications WHERE user_id=$1", [
        req.user.id,
      ]);
    });
    res.clearCookie("midad_session", { path: "/api" });
    return { ok: true };
  }
}
@Controller("api/public")
export class PublicController {
  @Post("contact") async contact(@Body() body: unknown, @Req() req: Request) {
    checkOrigin(req);
    const v = parse(
      z.object({
        name,
        email,
        school: name,
        message: z.string().trim().min(10).max(4000),
      }),
      body,
    );
    await db.query(
      "INSERT INTO inquiries(id,name,email,school,message) VALUES($1,$2,$3,$4,$5)",
      [uid(), v.name, v.email, v.school, v.message],
    );
    if (process.env.CONTACT_EMAIL)
      await emailJob(
        process.env.CONTACT_EMAIL,
        "Nouvelle demande Midad",
        `${v.school} — ${v.name}\n${v.email}\n\n${v.message}`,
      );
    return { ok: true };
  }
  @Get("health") async health() {
    await db.query("SELECT 1");
    return { status: "ok" };
  }
}
