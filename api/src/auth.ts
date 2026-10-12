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
import {
  enforceRate,
  deviceLabel,
  securityEvent,
  verifyFactor,
  confirmPassword,
} from "./protection";
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api",
  maxAge: 7 * 86400000,
});
export async function issueSession(
  c: PoolClient,
  userId: string,
  res: Response,
  req: Request,
) {
  const raw = token();
  await c.query(
    "INSERT INTO auth_sessions(token_hash,user_id,expires_at,device_label) VALUES($1,$2,now()+interval '7 days',$3)",
    [hash(raw), userId, deviceLabel(req)],
  );
  await c.query(
    "DELETE FROM auth_sessions WHERE user_id=$1 AND token_hash IN(SELECT token_hash FROM auth_sessions WHERE user_id=$1 ORDER BY created_at DESC OFFSET 10)",
    [userId],
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
    checkOrigin(req, true);
    const v = parse(
      registration.extend({
        session_mode: z.enum(["cookie", "token"]).default("token"),
      }),
      body,
    );
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
      const raw = await issueSession(c, userId, res, req);
      await securityEvent(
        { id: userId, tenant_id: tid },
        "auth.register",
        "",
        "success",
        c,
      );
      return {
        ...(v.session_mode === "token" ? { token: raw } : {}),
        verification_required: true,
      };
    });
  }
  @Post("login") async login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    checkOrigin(req, true);
    const v = parse(
      login.extend({
        session_mode: z.enum(["cookie", "token"]).default("token"),
        code: z.string().max(24).optional(),
      }),
      body,
    );
    await enforceRate("login-account:" + v.slug + ":" + v.email, 12);
    const r = await db.query(
      "SELECT u.* FROM users u JOIN tenants t ON t.id=u.tenant_id WHERE t.slug=$1 AND u.email=$2 AND u.active",
      [v.slug, v.email],
    );
    const u = r.rows[0];
    const fallback =
      "$2b$12$hpmRlboBUdpwNGxgAMUjoODNzHFvscGGybPwwISihEGvcWIgJohVi";
    const valid = await compare(v.password, u?.password_hash ?? fallback);
    if (!u || !valid) {
      await securityEvent(u ?? null, "auth.login", "", "failure");
      throw new UnauthorizedException("Identifiants incorrects");
    }
    return transaction(async (c) => {
      const locked = (
        await c.query(
          "SELECT password_hash,active FROM users WHERE id=$1 FOR UPDATE",
          [u.id],
        )
      ).rows[0];
      if (!locked?.active || locked.password_hash !== u.password_hash)
        throw new UnauthorizedException("Identifiants incorrects");
      if (!(await verifyFactor(c, u.id, v.code))) {
        await securityEvent(u, "auth.mfa.login", "", "failure", c);
        return { mfa_required: true };
      }
      const raw = await issueSession(c, u.id, res, req);
      await securityEvent(u, "auth.login", "", "success", c);
      return v.session_mode === "token" ? { token: raw } : { ok: true };
    });
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
    await securityEvent(req.user, "auth.logout", "");
    res.clearCookie("midad_session", { path: "/api" });
    return { ok: true };
  }
  @UseGuards(AuthGuard) @Post("resend") async resend(@Req() req: AuthRequest) {
    if (req.user.verified) return { ok: true };
    await transaction((c) => authEmail(c, req.user, "verify"));
    return { ok: true };
  }
  @Post("forgot") async forgot(@Body() body: unknown, @Req() req: Request) {
    checkOrigin(req, true);
    const v = parse(z.object({ slug: z.string().max(40), email }), body);
    const r = await db.query(
      "SELECT u.* FROM users u JOIN tenants t ON t.id=u.tenant_id WHERE t.slug=$1 AND u.email=$2 AND u.active",
      [v.slug, v.email],
    );
    if (r.rowCount) await transaction((c) => authEmail(c, r.rows[0], "reset"));
    return { ok: true };
  }
  @Post("consume") async consume(@Body() body: unknown, @Req() req: Request) {
    checkOrigin(req, true);
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
    const v = parse(
      z.object({
        current: z.string().max(128),
        password,
        code: z.string().max(24).optional(),
      }),
      body,
    );
    await enforceRate("password:" + req.user.id, 10);
    const r = await db.query("SELECT password_hash FROM users WHERE id=$1", [
      req.user.id,
    ]);
    if (!(await compare(v.current, r.rows[0].password_hash)))
      throw new UnauthorizedException("Mot de passe incorrect");
    await transaction(async (c) => {
      if (!(await verifyFactor(c, req.user.id, v.code)))
        throw new UnauthorizedException(
          "Code de double authentification requis ou incorrect",
        );
      await c.query("UPDATE users SET password_hash=$1 WHERE id=$2", [
        await bcryptHash(v.password, 12),
        req.user.id,
      ]);
      await c.query(
        "DELETE FROM auth_sessions WHERE user_id=$1 AND token_hash<>$2",
        [req.user.id, req.sessionHash],
      );
      await c.query("DELETE FROM auth_tokens WHERE user_id=$1", [req.user.id]);
      await c.query(
        "UPDATE auth_sessions SET reauthenticated_at=now() WHERE token_hash=$1",
        [req.sessionHash],
      );
      await securityEvent(req.user, "auth.password.change", "", "success", c);
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
    const v = parse(
      z.object({
        password: z.string().max(128),
        code: z.string().max(24).optional(),
      }),
      body,
    );
    await enforceRate("delete-account:" + req.user.id, 5);
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
      if (!(await verifyFactor(c, req.user.id, v.code)))
        throw new UnauthorizedException(
          "Code de double authentification requis ou incorrect",
        );
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
      await c.query("DELETE FROM user_mfa WHERE user_id=$1", [req.user.id]);
      await c.query(
        "UPDATE students SET parent_id=NULL WHERE tenant_id=$1 AND parent_id=$2",
        [req.user.tenant_id, req.user.id],
      );
      await c.query(
        "UPDATE students SET user_id=NULL WHERE tenant_id=$1 AND user_id=$2",
        [req.user.tenant_id, req.user.id],
      );
      await securityEvent(req.user, "auth.account.delete", "", "success", c);
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
