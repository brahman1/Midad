import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  base32,
  totp,
  encryptSecret,
  decryptSecret,
} from "../api/dist/protection.js";
test("TOTP : vecteurs publics RFC 6238, y compris après 2038", () => {
  const secret = base32(Buffer.from("12345678901234567890"));
  for (const [seconds, expected] of [
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ])
    assert.equal(totp(secret, Math.floor(seconds / 30), 8), expected);
});
test("Secret MFA : chiffrement authentifié, identité et altération vérifiées", () => {
  process.env.SECURITY_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  const first = encryptSecret("JBSWY3DPEHPK3PXP", "user-a"),
    second = encryptSecret("JBSWY3DPEHPK3PXP", "user-a");
  assert.notEqual(first, second);
  assert.equal(decryptSecret(first, "user-a"), "JBSWY3DPEHPK3PXP");
  assert.throws(() => decryptSecret(first, "user-b"));
  const parts = first.split(".");
  const bytes = Buffer.from(parts[2], "base64url");
  bytes[0] ^= 1;
  parts[2] = bytes.toString("base64url");
  assert.throws(() => decryptSecret(parts.join("."), "user-a"));
});
