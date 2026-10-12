"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Languages, ArrowRight, CheckCircle2 } from "lucide-react";
import { api } from "../../lib/api";
export default function Auth() {
  const [mode, setMode] = useState("login"),
    [rawToken, setRawToken] = useState(""),
    [ar, setAr] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  const t = (f: string, a: string) => (ar ? a : f);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    setMode(q.get("mode") ?? "login");
    setRawToken(q.get("token") ?? "");
    if (q.has("token")) {
      q.delete("token");
      history.replaceState(
        history.state,
        "",
        location.pathname + (q.size ? "?" + q.toString() : ""),
      );
    }
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = Object.fromEntries(new FormData(e.currentTarget));
      if (["verify", "reset", "invite"].includes(mode)) {
        await api("auth/consume", "POST", {
          token: rawToken,
          ...(mode === "verify" ? {} : { password: data.password }),
        });
        setDone(true);
      } else if (mode === "forgot") {
        await api("auth/forgot", "POST", data);
        setDone(true);
      } else {
        const result = await api(
          `auth/${mode === "register" ? "register" : "login"}`,
          "POST",
          {
            ...data,
            session_mode: "cookie",
            ...(mode === "register" ? { locale: ar ? "ar" : "fr" } : {}),
          },
        );
        if (result.mfa_required) {
          setMfaRequired(true);
          setError(
            t(
              "Saisissez un code de votre application d’authentification ou un code de secours.",
              "أدخل رمز تطبيق المصادقة أو رمز الاسترداد.",
            ),
          );
          return;
        }
        location.href = "/app";
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const [mfaRequired, setMfaRequired] = useState(false);
  return (
    <main className="auth-page" dir={ar ? "rtl" : "ltr"}>
      <aside className="auth-story">
        <Link href="/" className="brand">
          <span className="brand-mark">م</span>Midad
        </Link>
        <div>
          <span className="eyebrow">
            {t("L’ESPACE DE VOTRE CENTRE", "مساحة مركزك")}
          </span>
          <h1>
            {t("Tout se relie.", "كل شيء مترابط.")}
            <br />
            <em>{t("Tout s’éclaire.", "كل شيء أوضح.")}</em>
          </h1>
          <p>
            {t(
              "Une équipe organisée, des familles informées et des comptes que vous pouvez suivre.",
              "فريق منظم وعائلات مطلعة وحسابات يمكنك متابعتها.",
            )}
          </p>
          <div className="auth-circles">
            <span>م</span>
            <span>✦</span>
            <span>↗</span>
          </div>
        </div>
        <small>
          {t("Midad · Français / العربية", "مداد · العربية / Français")}
        </small>
      </aside>
      <section className="auth-panel">
        <button
          className="text-button locale-button"
          onClick={() => setAr(!ar)}
        >
          <Languages size={18} />
          {ar ? "Français" : "العربية"}
        </button>
        <div className="auth-box">
          <span className="eyebrow">{t("BIENVENUE", "مرحبًا")}</span>
          <h2>
            {mode === "register"
              ? t("Ouvrez votre établissement", "أنشئ مؤسستك")
              : mode === "login"
                ? t("Retrouvez votre espace", "ادخل إلى مساحتك")
                : mode === "forgot"
                  ? t("Retrouvez votre accès", "استعد الوصول")
                  : mode === "verify"
                    ? t("Vérifiez votre adresse", "تحقق من بريدك")
                    : t("Choisissez votre mot de passe", "اختر كلمة المرور")}
          </h2>
          {done ? (
            <div className="success-state">
              <CheckCircle2 size={40} />
              <p>
                {mode === "forgot"
                  ? t(
                      "Si ce compte existe, un lien de réinitialisation a été envoyé.",
                      "إذا كان الحساب موجودًا، تم إرسال رابط الاستعادة.",
                    )
                  : t(
                      "Votre compte est prêt. Vous pouvez vous connecter.",
                      "حسابك جاهز. يمكنك الدخول.",
                    )}
              </p>
              <Link href="/auth" className="button dark">
                {t("Se connecter", "دخول")}
              </Link>
            </div>
          ) : (
            <form onSubmit={submit}>
              {["register", "login", "forgot"].includes(mode) && (
                <>
                  <label>
                    {t("Identifiant de l’établissement", "معرّف المؤسسة")}
                    <input
                      name="slug"
                      required
                      pattern="[a-z0-9][a-z0-9-]{2,39}"
                      placeholder="centre-el-nour"
                      autoComplete="organization"
                    />
                    <small>
                      {t(
                        "L’identifiant fourni par votre établissement.",
                        "المعرّف الذي توفره مؤسستك.",
                      )}
                    </small>
                  </label>
                  <label>
                    {t("Email", "البريد الإلكتروني")}
                    <input
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                    />
                  </label>
                </>
              )}
              {mode === "register" && (
                <>
                  <label>
                    {t("Nom de l’établissement", "اسم المؤسسة")}
                    <input name="school" required minLength={2} />
                  </label>
                  <label>
                    {t("Votre nom", "اسمك")}
                    <input
                      name="name"
                      required
                      minLength={2}
                      autoComplete="name"
                    />
                  </label>
                  <label>
                    {t("Téléphone", "الهاتف")}
                    <input name="phone" type="tel" />
                  </label>
                </>
              )}
              {["register", "login", "reset", "invite"].includes(mode) && (
                <label>
                  {t("Mot de passe", "كلمة المرور")}
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={mode === "login" ? 1 : 12}
                    maxLength={128}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                  />
                  {mode !== "login" && (
                    <small>
                      {t("Au moins 12 caractères.", "12 حرفًا على الأقل.")}
                    </small>
                  )}
                </label>
              )}
              {mode === "register" && (
                <label className="check-label">
                  <input type="checkbox" required />
                  {t(
                    "J’ai lu les conditions et la politique de confidentialité.",
                    "قرأت الشروط وسياسة الخصوصية.",
                  )}{" "}
                  <Link href="/legal">{t("Lire", "اقرأ")}</Link>
                </label>
              )}
              {mode === "login" && mfaRequired && (
                <label>
                  {t(
                    "Code de double authentification ou de secours",
                    "رمز المصادقة الثنائية أو الاسترداد",
                  )}
                  <input
                    name="code"
                    autoComplete="one-time-code"
                    required
                    maxLength={24}
                  />
                  <small>
                    {t(
                      "Utilisez un nouveau code. Un code de secours ne peut servir qu’une fois.",
                      "استخدم رمزًا جديدًا. رمز الاسترداد صالح مرة واحدة.",
                    )}
                  </small>
                </label>
              )}
              {error && (
                <div role="alert" className="error-box">
                  {error}
                </div>
              )}
              <button className="button dark large" disabled={busy}>
                {busy
                  ? t("Un instant…", "لحظة…")
                  : mode === "register"
                    ? t("Créer mon espace", "إنشاء مساحتي")
                    : mode === "verify"
                      ? t("Confirmer mon email", "تأكيد بريدي")
                      : mode === "forgot"
                        ? t("Envoyer le lien", "إرسال الرابط")
                        : mode === "login"
                          ? t("Se connecter", "دخول")
                          : t("Enregistrer", "حفظ")}
                <ArrowRight size={17} />
              </button>
            </form>
          )}
          {mode === "login" && (
            <div className="auth-links">
              <Link href="/auth?mode=forgot">
                {t("Mot de passe oublié ?", "نسيت كلمة المرور؟")}
              </Link>
              <Link href="/auth?mode=register">
                {t("Créer un établissement", "إنشاء مؤسسة")}
              </Link>
            </div>
          )}
          <p className="auth-help">
            {t(
              "Pour rejoindre une école existante, utilisez l’invitation reçue par email.",
              "للانضمام إلى مؤسسة موجودة، استخدم دعوة البريد الإلكتروني.",
            )}
          </p>
        </div>
      </section>
    </main>
  );
}
