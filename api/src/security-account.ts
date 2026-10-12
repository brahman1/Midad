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
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { Response } from "express";
import { issueSession } from "./auth";
import { z } from "zod";
import { AuthGuard, AuthRequest, parse, hash, uuid } from "./security";
import { db, transaction } from "./db";
import {
  base32,
  encryptSecret,
  mfaAvailable,
  confirmPassword,
  verifyFactor,
  securityEvent,
  requireRecent,
  policy,
} from "./protection";
const proof = z.object({
  current: z.string().min(1).max(128),
  code: z.string().max(24).optional(),
});
@Controller("api/security")
@UseGuards(AuthGuard)
export class SecurityController {
  @Get("account") async account(@Req() req: AuthRequest) {
    const m = (
      await db.query(
        "SELECT enabled,cardinality(recovery_hashes) AS remaining FROM user_mfa WHERE user_id=$1",
        [req.user.id],
      )
    ).rows[0];
    const sessions = (
      await db.query(
        "SELECT id,device_label,created_at,last_seen_at,expires_at,(token_hash=$2) AS current FROM auth_sessions WHERE user_id=$1 AND expires_at>now() AND last_seen_at>now()-interval '12 hours' ORDER BY created_at DESC",
        [req.user.id, req.sessionHash],
      )
    ).rows;
    const events = (
      await db.query(
        "SELECT action,resource,outcome,created_at FROM security_events WHERE user_id=$1 AND action LIKE 'auth.%' ORDER BY created_at DESC LIMIT 30",
        [req.user.id],
      )
    ).rows;
    return {
      mfa_available: mfaAvailable(),
      mfa_enabled: m?.enabled ?? false,
      recovery_remaining: m?.remaining ?? 0,
      sessions,
      events,
      policy,
    };
  }
  @Post("reauthenticate") async reauthenticate(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    const v = parse(proof, body);
    await confirmPassword(req, v.current, v.code);
    await transaction(async (c) => {
      if (!(await verifyFactor(c, req.user.id, v.code)))
        throw new UnauthorizedException("Code incorrect ou déjà utilisé");
      await c.query(
        "UPDATE auth_sessions SET reauthenticated_at=now() WHERE user_id=$1 AND token_hash=$2",
        [req.user.id, req.sessionHash],
      );
      await securityEvent(req.user, "auth.reauthenticate", "", "success", c);
    });
    return { ok: true };
  }
  @Post("sessions/revoke") async revoke(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    await requireRecent(req);
    const v = parse(
      z
        .object({ id: z.uuid().optional(), others: z.boolean().optional() })
        .refine((v) => !!v.id || v.others === true),
      body,
    );
    await transaction(async (c) => {
      await c.query(
        "DELETE FROM auth_sessions WHERE user_id=$1 AND token_hash<>$2 AND ($3::boolean OR id=$4)",
        [req.user.id, req.sessionHash, v.others ?? false, v.id ?? null],
      );
      await securityEvent(
        req.user,
        "auth.sessions.revoke",
        v.others ? "others" : v.id!,
        "success",
        c,
      );
    });
    return { ok: true };
  }
  @Post("mfa/setup") async setup(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    const v = parse(proof, body);
    await confirmPassword(req, v.current, v.code);
    if (!mfaAvailable())
      throw new BadRequestException("Clé de chiffrement serveur à configurer");
    const secret = base32(randomBytes(20));
    await transaction(async (c) => {
      await c.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
        req.user.id,
      ]);
      const existing = (
        await c.query("SELECT enabled FROM user_mfa WHERE user_id=$1", [
          req.user.id,
        ])
      ).rows[0];
      if (existing?.enabled)
        throw new BadRequestException(
          "La double authentification est déjà active",
        );
      await c.query(
        "INSERT INTO user_mfa(user_id,secret_encrypted) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET secret_encrypted=excluded.secret_encrypted,pending_until=now()+interval '10 minutes',last_counter=-1",
        [req.user.id, encryptSecret(secret, req.user.id)],
      );
      await securityEvent(req.user, "auth.mfa.prepare", "", "success", c);
    });
    return {
      secret,
      uri: `otpauth://totp/${encodeURIComponent("Midad:" + req.user.slug + ":" + req.user.email)}?secret=${secret}&issuer=Midad&algorithm=SHA1&digits=6&period=30`,
    };
  }
  @Post("mfa/enable") async enable(
    @Req() req: AuthRequest,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const v = parse(proof, body);
    await confirmPassword(req, v.current, v.code);
    const codes = Array.from({ length: 8 }, () =>
      randomBytes(10).toString("hex"),
    );
    const raw = await transaction(async (c) => {
      await c.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
        req.user.id,
      ]);
      if (!(await verifyFactor(c, req.user.id, v.code, true)))
        throw new UnauthorizedException(
          "Code incorrect, déjà utilisé ou configuration expirée",
        );
      const r = await c.query(
        "UPDATE user_mfa SET enabled=true,recovery_hashes=$1 WHERE user_id=$2 AND NOT enabled RETURNING user_id",
        [codes.map(hash), req.user.id],
      );
      if (!r.rowCount) throw new BadRequestException("Déjà active");
      await c.query("DELETE FROM auth_sessions WHERE user_id=$1", [
        req.user.id,
      ]);
      await securityEvent(req.user, "auth.mfa.enable", "", "success", c);
      return issueSession(c, req.user.id, res, req);
    });
    return {
      recovery_codes: codes,
      ...(req.headers.authorization ? { token: raw } : {}),
    };
  }
  @Post("mfa/disable") async disable(
    @Req() req: AuthRequest,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const v = parse(proof, body);
    await confirmPassword(req, v.current, v.code);
    const raw = await transaction(async (c) => {
      await c.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
        req.user.id,
      ]);
      if (!(await verifyFactor(c, req.user.id, v.code)))
        throw new UnauthorizedException(
          "Code requis, incorrect ou déjà utilisé",
        );
      await c.query("DELETE FROM user_mfa WHERE user_id=$1", [req.user.id]);
      await c.query("DELETE FROM auth_sessions WHERE user_id=$1", [
        req.user.id,
      ]);
      await securityEvent(req.user, "auth.mfa.disable", "", "success", c);
      return issueSession(c, req.user.id, res, req);
    });
    return { ok: true, ...(req.headers.authorization ? { token: raw } : {}) };
  }
}
