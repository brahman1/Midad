import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { Request, Response, NextFunction } from "express";
import {
  BadRequestException,
  HttpException,
  UnauthorizedException,
} from "@nestjs/common";
import { compare } from "bcryptjs";
import { PoolClient } from "pg";
import { db } from "./db";
import { AuthRequest, hash } from "./security";
export const policy = { absoluteDays: 7, idleHours: 12, reauthMinutes: 10 };
export async function securityEvent(
  user: { id: string; tenant_id: string } | null,
  action: string,
  resource: string,
  outcome = "success",
  c: PoolClient | typeof db = db,
) {
  await c.query(
    "INSERT INTO security_events(tenant_id,user_id,action,resource,outcome) VALUES($1,$2,$3,$4,$5)",
    [
      user?.tenant_id ?? null,
      user?.id ?? null,
      action,
      resource.slice(0, 180),
      outcome,
    ],
  );
}
export async function takeRate(key: string, limit: number, seconds: number) {
  const r = await db.query(
    "INSERT INTO rate_buckets(key_hash,hits,expires_at) VALUES($1,1,now()+$2*interval '1 second') ON CONFLICT(key_hash) DO UPDATE SET hits=CASE WHEN rate_buckets.expires_at<=now() THEN 1 ELSE rate_buckets.hits+1 END,expires_at=CASE WHEN rate_buckets.expires_at<=now() THEN excluded.expires_at ELSE rate_buckets.expires_at END RETURNING hits,GREATEST(1,ceil(extract(epoch FROM expires_at-now())))::int AS retry",
    [hash(key), seconds],
  );
  return { allowed: r.rows[0].hits <= limit, retry: r.rows[0].retry };
}
export async function enforceRate(key: string, limit: number, seconds = 900) {
  const result = await takeRate(key, limit, seconds);
  if (!result.allowed)
    throw new HttpException(
      "Trop de tentatives. Réessayez dans quelques minutes.",
      429,
    );
}
export function persistentLimiter(
  scope: string,
  limit: number,
  seconds: number,
  skip?: (req: Request) => boolean,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (skip?.(req)) return next();
    try {
      const result = await takeRate(
        scope + ":" + (req.ip ?? req.socket.remoteAddress ?? "unknown"),
        limit,
        seconds,
      );
      if (result.allowed) return next();
      res.setHeader("Retry-After", result.retry);
      res
        .status(429)
        .json({ message: "Trop de tentatives. Réessayez plus tard." });
    } catch {
      res.status(503).json({
        message: "Protection temporairement indisponible. Réessayez.",
      });
    }
  };
}
export function deviceLabel(req: Request) {
  const ua = req.headers["user-agent"] ?? "";
  const system = /Android/i.test(ua)
    ? "Android"
    : /iPhone|iPad/i.test(ua)
      ? "iOS"
      : /Windows/i.test(ua)
        ? "Windows"
        : /Macintosh/i.test(ua)
          ? "macOS"
          : /Linux/i.test(ua)
            ? "Linux"
            : "Appareil";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Application";
  return browser + " · " + system;
}
export async function requireRecent(
  req: AuthRequest,
  c: PoolClient | typeof db = db,
) {
  const r = await c.query(
    "SELECT 1 FROM auth_sessions WHERE token_hash=$1 AND user_id=$2 AND reauthenticated_at>now()-interval '10 minutes' AND expires_at>now() AND last_seen_at>now()-interval '12 hours'",
    [req.sessionHash, req.user.id],
  );
  if (!r.rowCount)
    throw new HttpException(
      "Confirmez votre mot de passe dans Sécurité & confidentialité avant cette action.",
      428,
    );
}
const key = () => {
  const raw = process.env.SECURITY_ENCRYPTION_KEY;
  if (!raw || raw.length < 32)
    throw new BadRequestException(
      "Double authentification indisponible : clé serveur à configurer.",
    );
  return createHash("sha256").update(raw).digest();
};
export const mfaAvailable = () =>
  !!process.env.SECURITY_ENCRYPTION_KEY &&
  process.env.SECURITY_ENCRYPTION_KEY.length >= 32;
export function encryptSecret(secret: string, userId: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(userId));
  const bytes = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), bytes]
    .map((b) => b.toString("base64url"))
    .join(".");
}
export function decryptSecret(value: string, userId: string) {
  const [iv, tag, bytes] = value
    .split(".")
    .map((s) => Buffer.from(s, "base64url"));
  const cipher = createDecipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(userId));
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(bytes), cipher.final()]).toString("utf8");
}
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32(bytes: Buffer) {
  let bits = 0,
    value = 0,
    out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits) out += alphabet[(value << (5 - bits)) & 31];
  return out;
}
function decode32(s: string) {
  let bits = 0,
    value = 0;
  const out: number[] = [];
  for (const char of s) {
    const n = alphabet.indexOf(char);
    if (n < 0) throw new Error("Secret invalide");
    value = (value << 5) | n;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
export function totp(secret: string, counter: number, digits = 6) {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", decode32(secret)).update(bytes).digest(),
    offset = mac[mac.length - 1] & 15;
  return ((mac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits)
    .toString()
    .padStart(digits, "0");
}
export async function verifyFactor(
  c: PoolClient,
  userId: string,
  code?: string,
  setup = false,
) {
  const row = (
    await c.query("SELECT * FROM user_mfa WHERE user_id=$1 FOR UPDATE", [
      userId,
    ])
  ).rows[0];
  if (!row || (!row.enabled && !setup)) return !setup;
  if (!code) return false;
  if (!row.enabled && Date.parse(row.pending_until) < Date.now()) return false;
  if (/^\d{6}$/.test(code)) {
    const current = Math.floor(Date.now() / 30000),
      secret = decryptSecret(row.secret_encrypted, userId);
    for (const counter of [current, current - 1, current + 1])
      if (
        counter > row.last_counter &&
        timingSafeEqual(Buffer.from(code), Buffer.from(totp(secret, counter)))
      ) {
        await c.query("UPDATE user_mfa SET last_counter=$1 WHERE user_id=$2", [
          counter,
          userId,
        ]);
        return true;
      }
  }
  if (!setup && row.enabled && /^[a-f0-9]{20}$/.test(code)) {
    const fingerprint = hash(code),
      found = row.recovery_hashes.includes(fingerprint);
    if (found) {
      await c.query(
        "UPDATE user_mfa SET recovery_hashes=array_remove(recovery_hashes,$1) WHERE user_id=$2",
        [fingerprint, userId],
      );
      return true;
    }
  }
  return false;
}
export async function confirmPassword(
  req: AuthRequest,
  current: string,
  code?: string,
) {
  await enforceRate("reauth:" + req.user.id, 10);
  const u = (
    await db.query("SELECT password_hash FROM users WHERE id=$1 AND active", [
      req.user.id,
    ])
  ).rows[0];
  if (!u || !(await compare(current, u.password_hash))) {
    await securityEvent(req.user, "auth.reauthenticate", "", "failure");
    throw new UnauthorizedException("Mot de passe ou code incorrect");
  }
  return { current, code };
}
export async function maintainSecurity() {
  await db.query(
    "DELETE FROM auth_sessions WHERE expires_at<=now() OR last_seen_at<now()-interval '12 hours'; DELETE FROM auth_tokens WHERE expires_at<=now(); DELETE FROM rate_buckets WHERE expires_at<now()-interval '1 day'; DELETE FROM user_mfa WHERE NOT enabled AND pending_until<now(); DELETE FROM security_events WHERE created_at<now()-interval '180 days'; DELETE FROM outbox WHERE created_at<now()-interval '7 days' AND channel='email'; DELETE FROM outbox WHERE created_at<now()-interval '30 days' AND channel='push'; DELETE FROM notifications WHERE created_at<now()-interval '180 days'; DELETE FROM inquiries WHERE created_at<now()-interval '180 days'; DELETE FROM privacy_requests WHERE status IN('completed','refused') AND updated_at<now()-interval '1 year';",
  );
}
