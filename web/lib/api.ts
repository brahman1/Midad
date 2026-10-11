export const API = process.env.NEXT_PUBLIC_API_URL ?? "/api";
export async function api(
  path: string,
  method = "GET",
  body?: unknown,
  headers: Record<string, string> = {},
) {
  const r = await fetch(`${API}/${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r
    .json()
    .catch(() => ({ message: "Réponse indisponible" }));
  if (!r.ok) {
    if (
      r.status === 401 &&
      typeof window !== "undefined" &&
      !path.startsWith("auth/")
    )
      window.location.href = "/auth";
    throw new Error(
      Array.isArray(data.message)
        ? data.message.join(", ")
        : (data.message ?? "Erreur de connexion"),
    );
  }
  return data;
}
export function cents(value: FormDataEntryValue | null) {
  const raw = String(value ?? "")
    .trim()
    .replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(raw))
    throw new Error("Montant invalide (deux décimales maximum)");
  const [whole, fraction = ""] = raw.split(".");
  const n = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(n)) throw new Error("Montant invalide");
  return n;
}
export function localDate(value: unknown) {
  return new Date(String(value)).toLocaleString("fr-DZ", {
    timeZone: "Africa/Algiers",
    dateStyle: "medium",
    timeStyle: "short",
    hourCycle: "h23",
  });
}
