"use client";
import { useEffect, useState, FormEvent } from "react";
import {
  ShieldCheck,
  KeyRound,
  Monitor,
  FileDown,
  LockKeyhole,
  ScrollText,
} from "lucide-react";
import { api, localDate } from "../../lib/api";
import { User, adminRoles } from "@midad/shared";
import "./security-center.css";
type Row = Record<string, any>;
const kinds: Record<string, [string, string]> = {
  access: ["Accès", "الوصول"],
  rectification: ["Rectification", "التصحيح"],
  erasure: ["Effacement", "المحو"],
  restriction: ["Limitation", "التقييد"],
  objection: ["Opposition", "الاعتراض"],
  portability: ["Portabilité", "نقل البيانات"],
};
export default function SecurityCenter({
  user,
  lang,
}: {
  user: User;
  lang: "fr" | "ar";
}) {
  const t = (fr: string, ar: string) => (lang === "fr" ? fr : ar);
  const [account, setAccount] = useState<Row | null>(null),
    [notice, setNotice] = useState<Row | null>(null),
    [requests, setRequests] = useState<Row[]>([]),
    [admin, setAdmin] = useState<Row | null>(null),
    [journal, setJournal] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [current, setCurrent] = useState(""),
    [code, setCode] = useState(""),
    [setup, setSetup] = useState<Row | null>(null),
    [recovery, setRecovery] = useState<string[]>([]);
  const administrative = adminRoles.includes(user.role);
  async function load() {
    const [a, n, r] = await Promise.all([
      api("security/account"),
      api("privacy/notice"),
      api("privacy/requests"),
    ]);
    setAccount(a);
    setNotice(n);
    setRequests(r);
    if (administrative) {
      try {
        setAdmin(await api("privacy/admin"));
      } catch {
        setAdmin(null);
      }
    }
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [user.id]);
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await task();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setCurrent("");
      setCode("");
    }
  }
  function download(data: unknown, name: string) {
    const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      ),
      link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function proof() {
    await api("security/reauthenticate", "POST", {
      current,
      code: code || undefined,
    });
  }
  if (!account)
    return (
      <div className="panel">
        {error ||
          t(
            "Chargement de la protection de votre compte…",
            "تحميل حماية حسابك…",
          )}
      </div>
    );
  return (
    <div className="sc-center">
      <section className="sc-intro">
        <ShieldCheck size={34} />
        <div>
          <h2>
            {t(
              "Votre compte. Vos données. Votre contrôle.",
              "حسابك وبياناتك تحت سيطرتك.",
            )}
          </h2>
          <p>
            {t(
              "Gérez vos accès, activez une seconde protection et exercez vos droits sur les données.",
              "أدر صلاحيات الوصول وفعّل حماية إضافية ومارس حقوقك على بياناتك.",
            )}
          </p>
        </div>
        <span className="badge">
          {account.mfa_enabled
            ? t("Double protection active", "الحماية الثنائية نشطة")
            : t("Double protection à activer", "تفعيل الحماية الثنائية")}
        </span>
      </section>
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="sc-success" role="status">
          {success}
        </div>
      )}
      {notice?.demo && (
        <div className="sc-warning">
          {t(
            "Démonstration : utilisez uniquement des données fictives. Les formalités légales et les conditions d’hébergement pour des dossiers réels restent à finaliser.",
            "نسخة تجريبية: استخدم بيانات وهمية فقط. يلزم استكمال الإجراءات القانونية وشروط استضافة الملفات الحقيقية.",
          )}
        </div>
      )}
      <div className="sc-grid">
        <section className="panel">
          <h2>
            <KeyRound size={21} />
            {t("Confirmer une action sensible", "تأكيد إجراء حساس")}
          </h2>
          <p>
            {t(
              "Une confirmation récente est demandée pour les exports et la gestion des accès. Vos sessions expirent après 12 heures sans activité, au plus tard après 7 jours.",
              "يلزم تأكيد حديث لتصدير البيانات وإدارة الوصول. تنتهي الجلسة بعد 12 ساعة من الخمول وبحد أقصى 7 أيام.",
            )}
          </p>
          <fieldset disabled={busy}>
            <label>
              {t("Mot de passe actuel", "كلمة المرور الحالية")}
              <input
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </label>
            {(account.mfa_enabled || setup) && (
              <label>
                {t(
                  "Code de l’application ou de secours",
                  "رمز التطبيق أو الاسترداد",
                )}
                <input
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.trim())}
                  maxLength={24}
                />
              </label>
            )}
            <button
              className="button"
              disabled={!current}
              onClick={() =>
                void run(async () => {
                  await proof();
                  setSuccess(
                    t(
                      "Identité confirmée pour 10 minutes.",
                      "تم تأكيد الهوية لمدة 10 دقائق.",
                    ),
                  );
                })
              }
            >
              {t("Confirmer mon identité", "تأكيد هويتي")}
            </button>
          </fieldset>
        </section>
        <section className="panel">
          <h2>
            <LockKeyhole size={21} />
            {t("Double authentification", "المصادقة الثنائية")}
          </h2>
          <p>
            {t(
              "Associez une application d’authentification (TOTP). Le code sera demandé après votre mot de passe à chaque nouvelle connexion.",
              "اربط تطبيق مصادقة TOTP. سيُطلب الرمز بعد كلمة المرور عند كل دخول جديد.",
            )}
          </p>
          {!account.mfa_available && (
            <p className="sc-warning">
              {t(
                "La clé de chiffrement serveur doit être configurée pour activer cette fonction.",
                "يجب إعداد مفتاح تشفير الخادم لتفعيل هذه الوظيفة.",
              )}
            </p>
          )}
          {!account.mfa_enabled && !setup && (
            <button
              className="button secondary"
              disabled={busy || !current || !account.mfa_available}
              onClick={() =>
                void run(async () => {
                  setSetup(
                    await api("security/mfa/setup", "POST", { current }),
                  );
                })
              }
            >
              {t("Préparer l’activation", "تحضير التفعيل")}
            </button>
          )}
          {setup && (
            <div className="sc-setup">
              <p>
                {t(
                  "Dans votre application, ajoutez un compte avec cette clé (TOTP, 6 chiffres, 30 secondes). Gardez-la privée.",
                  "أضف حسابًا في تطبيق المصادقة بهذا المفتاح (6 أرقام، 30 ثانية). احتفظ به سريًا.",
                )}
              </p>
              <code dir="ltr">{setup.secret}</code>
              <p>
                {t(
                  "Ressaisissez votre mot de passe et le code ci-contre pour confirmer. Configuration valable 10 minutes.",
                  "أعد إدخال كلمة المرور والرمز للتأكيد. الإعداد صالح 10 دقائق.",
                )}
              </p>
              <button
                className="button"
                disabled={busy || !current || !code}
                onClick={() =>
                  void run(async () => {
                    const r = await api("security/mfa/enable", "POST", {
                      current,
                      code,
                    });
                    setRecovery(r.recovery_codes);
                    setSetup(null);
                    setSuccess(
                      t(
                        "Double authentification activée. Les autres sessions ont été déconnectées.",
                        "تم تفعيل المصادقة الثنائية وإغلاق الجلسات الأخرى.",
                      ),
                    );
                  })
                }
              >
                {t(
                  "Activer la double authentification",
                  "تفعيل المصادقة الثنائية",
                )}
              </button>
            </div>
          )}
          {account.mfa_enabled && (
            <>
              <p>
                {t(
                  "Protection activée · codes de secours restants :",
                  "الحماية مفعلة · رموز الاسترداد المتبقية:",
                )}{" "}
                {account.recovery_remaining}
              </p>
              <button
                className="button secondary"
                disabled={busy || !current || !code}
                onClick={() =>
                  void run(async () => {
                    await api("security/mfa/disable", "POST", {
                      current,
                      code,
                    });
                    setRecovery([]);
                    setSuccess(
                      t(
                        "Double authentification désactivée.",
                        "تم تعطيل المصادقة الثنائية.",
                      ),
                    );
                  })
                }
              >
                {t(
                  "Désactiver avec mot de passe et code",
                  "التعطيل بكلمة المرور والرمز",
                )}
              </button>
            </>
          )}
          {!!recovery.length && (
            <div className="sc-warning">
              <strong>
                {t(
                  "Enregistrez ces codes hors de cet appareil. Ils ne seront plus affichés après fermeture.",
                  "احفظ هذه الرموز خارج هذا الجهاز. لن تظهر بعد إغلاق الصفحة.",
                )}
              </strong>
              <pre dir="ltr">{recovery.join("\n")}</pre>
              <button
                className="button secondary"
                onClick={() =>
                  download(
                    { recovery_codes: recovery },
                    "midad-codes-secours.json",
                  )
                }
              >
                {t("Télécharger les codes", "تنزيل الرموز")}
              </button>
              <button className="text-button" onClick={() => setRecovery([])}>
                {t("J’ai enregistré mes codes", "حفظت الرموز")}
              </button>
            </div>
          )}
        </section>
        <section className="panel">
          <h2>
            <Monitor size={21} />
            {t("Appareils connectés", "الأجهزة المتصلة")}
          </h2>
          <p>
            {t(
              "Les libellés d’appareil sont indicatifs. Aucun jeton de connexion ni adresse IP n’est affiché.",
              "أسماء الأجهزة تقريبية. لا تظهر رموز الجلسات ولا عناوين IP.",
            )}
          </p>
          <div className="sc-list">
            {account.sessions.map((s: Row) => (
              <article key={s.id}>
                <div>
                  <strong>{s.device_label}</strong>
                  <small>{localDate(s.last_seen_at)}</small>
                </div>
                {s.current ? (
                  <span className="badge">
                    {t("Cette session", "هذه الجلسة")}
                  </span>
                ) : (
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await api("security/sessions/revoke", "POST", {
                          id: s.id,
                        });
                        setSuccess(t("Session révoquée.", "تم إلغاء الجلسة."));
                      })
                    }
                  >
                    {t("Déconnecter", "قطع الاتصال")}
                  </button>
                )}
              </article>
            ))}
          </div>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await api("security/sessions/revoke", "POST", { others: true });
                setSuccess(
                  t(
                    "Les autres appareils ont été déconnectés.",
                    "تم قطع اتصال الأجهزة الأخرى.",
                  ),
                );
              })
            }
          >
            {t("Déconnecter les autres appareils", "قطع اتصال الأجهزة الأخرى")}
          </button>
        </section>
        <section className="panel">
          <h2>
            <FileDown size={21} />
            {t("Mes données et mes droits", "بياناتي وحقوقي")}
          </h2>
          <p>
            {t(
              "Téléchargez vos informations et celles des enfants rattachés à votre compte. Une demande d’effacement est examinée par l’établissement : les obligations de conservation restent applicables.",
              "نزّل معلوماتك ومعلومات الأطفال المرتبطين بحسابك. تدرس المؤسسة طلب المحو مع مراعاة التزامات الاحتفاظ.",
            )}
          </p>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                download(await api("privacy/export"), "midad-mes-donnees.json");
              })
            }
          >
            {t("Télécharger mes données", "تنزيل بياناتي")}
          </button>
          <form
            onSubmit={(e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const form = e.currentTarget;
              void run(async () => {
                await api("privacy/requests", "POST", Object.fromEntries(f));
                form.reset();
                setSuccess(
                  t(
                    "Demande enregistrée. Vous pouvez suivre la réponse ci-dessous.",
                    "تم تسجيل الطلب. يمكنك متابعة الرد أدناه.",
                  ),
                );
              });
            }}
          >
            <fieldset disabled={busy}>
              <label>
                {t("Type de demande", "نوع الطلب")}
                <select name="kind">
                  {Object.entries(kinds).map(([key, label]) => (
                    <option value={key} key={key}>
                      {label[lang === "fr" ? 0 : 1]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t(
                  "Votre demande (évitez les données médicales)",
                  "طلبك (تجنب المعلومات الطبية)",
                )}
                <textarea
                  name="message"
                  required
                  minLength={10}
                  maxLength={3000}
                />
              </label>
              <button className="button">
                {t("Transmettre à mon établissement", "إرسال إلى مؤسستي")}
              </button>
            </fieldset>
          </form>
          <div className="sc-list">
            {requests.map((r) => (
              <article key={r.id}>
                <div>
                  <strong>
                    {kinds[r.kind][lang === "fr" ? 0 : 1]} · {r.status}
                  </strong>
                  <small>
                    {t("Échéance interne :", "المهلة الداخلية:")}{" "}
                    {localDate(r.due_at)}
                  </small>
                  <p>
                    {r.response ||
                      t(
                        "Votre demande attend une réponse.",
                        "طلبك بانتظار الرد.",
                      )}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
      <section className="panel">
        <h2>
          <ShieldCheck size={21} />
          {t("Qui traite mes données ?", "من يعالج بياناتي؟")}
        </h2>
        <p>
          {notice?.school.name} · {notice?.hosting}
        </p>
        <p>
          {t("Contact de l’établissement :", "جهة اتصال المؤسسة:")}{" "}
          {notice?.school.privacy_contact ||
            t("À renseigner par la direction", "تحددها الإدارة")}
        </p>
        <p>
          {t("Délégué / interlocuteur :", "المندوب / جهة التواصل:")}{" "}
          {notice?.school.dpo_name || t("À renseigner", "لم يحدد")}
        </p>
        <p>
          {notice?.school.retention_policy ||
            t(
              "La durée de conservation des dossiers doit être définie par l’établissement.",
              "يجب أن تحدد المؤسسة مدة الاحتفاظ بالملفات.",
            )}
        </p>
        <p>
          {t(
            "Exploitant Midad : Brainfor · contact@brainfor.fr. La notice complète est accessible depuis le site.",
            "مشغل مداد: Brainfor · contact@brainfor.fr. إشعار الخصوصية الكامل متاح على الموقع.",
          )}
        </p>
        <a href="/legal">
          {t("Lire la notice de confidentialité", "قراءة إشعار الخصوصية")}
        </a>
      </section>
      {administrative && admin && (
        <>
          <section className="panel">
            <h2>
              {t(
                "Protection des données de votre établissement",
                "حماية بيانات مؤسستك",
              )}
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void run(async () => {
                  await api("privacy/profile", "POST", Object.fromEntries(f));
                  setSuccess(
                    t(
                      "Notice de l’établissement actualisée.",
                      "تم تحديث إشعار المؤسسة.",
                    ),
                  );
                });
              }}
            >
              <fieldset disabled={busy} className="sc-grid">
                <label>
                  {t(
                    "Email pour les demandes sur les données",
                    "بريد طلبات البيانات",
                  )}
                  <input
                    name="privacy_contact"
                    type="email"
                    required
                    defaultValue={admin.profile.privacy_contact}
                  />
                </label>
                <label>
                  {t(
                    "Délégué / interlocuteur désigné",
                    "المندوب / جهة التواصل المعينة",
                  )}
                  <input
                    name="dpo_name"
                    required
                    minLength={2}
                    maxLength={120}
                    defaultValue={admin.profile.dpo_name}
                  />
                </label>
                <label>
                  {t(
                    "Durées de conservation et critères",
                    "مدد ومعايير الاحتفاظ",
                  )}
                  <textarea
                    name="retention_policy"
                    required
                    minLength={20}
                    maxLength={2000}
                    defaultValue={admin.profile.retention_policy}
                  />
                </label>
                <label>
                  {t(
                    "Finalités et fondements juridiques à valider",
                    "الأغراض والأسس القانونية المطلوب اعتمادها",
                  )}
                  <textarea
                    name="processing_basis"
                    required
                    minLength={20}
                    maxLength={2000}
                    defaultValue={admin.profile.processing_basis}
                  />
                </label>
                <button className="button">
                  {t("Enregistrer la notice", "حفظ الإشعار")}
                </button>
              </fieldset>
            </form>
          </section>
          <section className="panel">
            <h2>{t("Demandes reçues", "الطلبات المستلمة")}</h2>
            {!admin.requests.length && (
              <p>{t("Aucune demande reçue.", "لا توجد طلبات.")}</p>
            )}
            {admin.requests.map((r: Row) => (
              <article className="sc-request" key={r.id}>
                <h3>
                  {r.requester} · {kinds[r.kind][lang === "fr" ? 0 : 1]}
                </h3>
                <small>
                  {r.email} · {r.status} · {localDate(r.due_at)}
                </small>
                <p>{r.message}</p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void run(async () => {
                      await api(
                        "privacy/requests/" + r.id,
                        "PATCH",
                        Object.fromEntries(f),
                      );
                      setSuccess(t("Réponse enregistrée.", "تم تسجيل الرد."));
                    });
                  }}
                >
                  <fieldset disabled={busy}>
                    <label>
                      {t("Avancement", "الحالة")}
                      <select
                        name="status"
                        defaultValue={
                          r.status === "open" ? "in_progress" : r.status
                        }
                      >
                        <option value="in_progress">
                          {t("En cours", "قيد المعالجة")}
                        </option>
                        <option value="completed">
                          {t("Traitée", "تمت المعالجة")}
                        </option>
                        <option value="refused">
                          {t("Refus motivé", "رفض مبرر")}
                        </option>
                      </select>
                    </label>
                    <label>
                      {t(
                        "Réponse et mesures réellement effectuées",
                        "الرد والإجراءات المنفذة فعليًا",
                      )}
                      <textarea
                        name="response"
                        required
                        minLength={10}
                        maxLength={3000}
                        defaultValue={r.response}
                      />
                    </label>
                    <button className="button secondary">
                      {t("Enregistrer la réponse", "حفظ الرد")}
                    </button>
                  </fieldset>
                </form>
              </article>
            ))}
          </section>
          <section className="panel">
            <h2>
              <ScrollText size={21} />
              {t("Journal de sécurité et des accès", "سجل الأمان والوصول")}
            </h2>
            <p>
              {t(
                "Traçabilité des consultations et modifications, conservée 180 jours. Les mots de passe, codes et contenus des dossiers sont exclus de ce journal.",
                "سجل الاستعلامات والتعديلات محفوظ لمدة 180 يومًا. لا يتضمن كلمات المرور والرموز ومحتويات الملفات.",
              )}
            </p>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                void run(async () => setJournal(await api("privacy/journal")))
              }
            >
              {t("Afficher le journal", "عرض السجل")}
            </button>
            {!!journal.length && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {[
                        t("Date", "التاريخ"),
                        t("Acteur", "المستخدم"),
                        t("Action", "الإجراء"),
                        t("Résultat", "النتيجة"),
                      ].map((x) => (
                        <th key={x}>{x}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {journal.map((r) => (
                      <tr key={r.id}>
                        <td>{localDate(r.created_at)}</td>
                        <td>{r.actor}</td>
                        <td>
                          {r.action}
                          <small>{r.resource}</small>
                        </td>
                        <td>{r.outcome}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
