import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
const host = Constants.expoConfig?.hostUri?.split(":")[0] ?? "127.0.0.1";
export const BASE =
  process.env.EXPO_PUBLIC_API_URL ?? `http://${host}:4100/api`;
export const WEBSITE = process.env.EXPO_PUBLIC_WEB_URL ?? `http://${host}:3000`;
let session = "";
export async function restore() {
  session =
    Platform.OS === "web"
      ? (sessionStorage.getItem("midad_session") ?? "")
      : ((await SecureStore.getItemAsync("midad_session")) ?? "");
  return session;
}
export async function setSession(value: string) {
  session = value;
  if (Platform.OS === "web") {
    value
      ? sessionStorage.setItem("midad_session", value)
      : sessionStorage.removeItem("midad_session");
  } else if (value)
    await SecureStore.setItemAsync("midad_session", value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  else await SecureStore.deleteItemAsync("midad_session");
}
export async function raw(
  path: string,
  method = "GET",
  body?: unknown,
  key?: string,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(`${BASE}/${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session || "mobile"}`,
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}
export async function api(
  path: string,
  method = "GET",
  body?: unknown,
  key?: string,
) {
  let r: Response;
  try {
    r = await raw(path, method, body, key);
  } catch {
    throw new Error(
      "Connexion indisponible. Vérifiez votre réseau et réessayez. / الاتصال غير متاح. تحقق من الشبكة.",
    );
  }
  const data = await r.json();
  if (!r.ok) {
    if (r.status === 401) {
      await setSession("");
      throw new Error("Session expirée. Reconnectez-vous. / انتهت الجلسة.");
    }
    throw new Error(data.message ?? "Erreur / خطأ");
  }
  return data;
}
export function centimes(v: string) {
  const s = v.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s))
    throw new Error("Montant invalide / مبلغ غير صالح");
  const [w, f = ""] = s.split(".");
  const n = Number(w) * 100 + Number(f.padEnd(2, "0"));
  if (!Number.isSafeInteger(n) || n > 100_000_000_000)
    throw new Error("Montant invalide / مبلغ غير صالح");
  return n;
}
