"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  GraduationCap,
  CalendarDays,
  Wallet,
  Languages,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { api } from "../lib/api";
export default function Home() {
  const [ar, setAr] = useState(false),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const t = (fr: string, a: string) => (ar ? a : fr);
  async function contact(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const form = e.currentTarget;
      const f = new FormData(form);
      await api("public/contact", "POST", Object.fromEntries(f));
      setNotice(t("Votre demande a été enregistrée.", "تم تسجيل طلبك."));
      form.reset();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="landing" dir={ar ? "rtl" : "ltr"}>
      <nav className="public-nav">
        <Link href="/" className="brand">
          <span className="brand-mark">م</span>Midad
          <span className="brand-ar">مداد</span>
        </Link>
        <div className="nav-links">
          <a href="#workflow">{t("La plateforme", "المنصة")}</a>
          <a href="#plans">{t("Les offres", "العروض")}</a>
          <button className="text-button" onClick={() => setAr(!ar)}>
            <Languages size={17} />
            {ar ? "Français" : "العربية"}
          </button>
          <Link href="/auth">{t("Connexion", "دخول")}</Link>
          <Link href="/auth?mode=register" className="button dark">
            {t("Ouvrir mon espace", "إنشاء حساب")}
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </nav>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="dot" />
            {t(
              "Pour les centres qui font grandir les savoirs",
              "للمراكز التي تنمّي المعرفة",
            )}
          </span>
          <h1>
            {t("Votre centre.", "مركزك.")}
            <br />
            <em>{t("En toute clarté.", "بكل وضوح.")}</em>
          </h1>
          <p>
            {t(
              "Les élèves, les séances, la caisse et les familles, réunis dans un espace simple. Retrouvez du temps pour ce qui compte : transmettre.",
              "التلاميذ والحصص والصندوق والعائلات في مساحة واحدة. وفّر وقتك لما يهم: التعليم.",
            )}
          </p>
          <div className="hero-actions">
            <Link className="button dark large" href="/auth?mode=register">
              {t("Créer mon établissement", "إنشاء مؤسستي")}
              <ArrowRight size={18} />
            </Link>
            <a className="button outline large" href="#contact">
              {t("Parlons de votre centre", "لنتحدث عن مركزك")}
            </a>
          </div>
          <div className="hero-details">
            <span>
              <Check size={16} />
              {t("Français et arabe", "الفرنسية والعربية")}
            </span>
            <span>
              <Check size={16} />
              {t("Web, iPhone et Android", "الويب وiPhone وAndroid")}
            </span>
          </div>
        </div>
        <div
          className="hero-art"
          aria-label={t("Illustration des espaces Midad", "تصوّر لمساحات مداد")}
        >
          <div className="art-orbit" />
          <div className="sample-dashboard">
            <div className="sample-top">
              <span className="brand-mark">م</span>
              <span>Midad</span>
              <span className="sample-label">
                {t("Aperçu de l’interface", "معاينة الواجهة")}
              </span>
            </div>
            <div className="sample-content">
              <span className="eyebrow">
                {t("VOTRE JOURNÉE, ORGANISÉE", "يومك منظم")}
              </span>
              <h3>{t("Une vue pour agir.", "نظرة تساعدك على العمل.")}</h3>
              <div className="sample-stats">
                <div>
                  <GraduationCap />
                  <b>{t("Élèves", "التلاميذ")}</b>
                  <small>
                    {t("Dossiers & inscriptions", "الملفات والتسجيلات")}
                  </small>
                </div>
                <div>
                  <Wallet />
                  <b>{t("Caisse", "الصندوق")}</b>
                  <small>
                    {t("Versements & échéances", "الدفعات والمستحقات")}
                  </small>
                </div>
              </div>
              <div className="sample-lesson">
                <span className="calendar-icon">
                  <CalendarDays />
                </span>
                <div>
                  <b>{t("Le prochain cours", "الدرس القادم")}</b>
                  <small>
                    {t(
                      "Planning · Salle · Enseignant",
                      "الجدول · القاعة · الأستاذ",
                    )}
                  </small>
                </div>
                <span className="badge green">{t("Planifié", "مجدول")}</span>
              </div>
              <div className="sample-chart">
                {[32, 50, 42, 68, 57, 83, 71, 95].map((v, i) => (
                  <span key={i} style={{ height: v + "%" }} />
                ))}
              </div>
              <small>
                {t(
                  "Illustration — aucune donnée client affichée",
                  "تصوّر — بدون بيانات عملاء",
                )}
              </small>
            </div>
          </div>
          <div className="floating-note">
            <ShieldCheck size={25} />
            <div>
              <b>{t("Chacun son espace", "لكل شخص مساحته")}</b>
              <small>
                {t(
                  "Direction · Professeurs · Familles",
                  "الإدارة · الأساتذة · العائلات",
                )}
              </small>
            </div>
          </div>
        </div>
      </section>
      <div className="marquee">
        <span>{t("MOINS DE DOUBLES SAISIES", "إدخال أقل للبيانات")}</span>
        <i>✦</i>
        <span>{t("DES COMPTES PLUS CLAIRS", "حسابات أوضح")}</span>
        <i>✦</i>
        <span>{t("DES FAMILLES INFORMÉES", "عائلات مطلعة")}</span>
        <i>✦</i>
        <span>{t("UNE ÉQUIPE CONNECTÉE", "فريق متصل")}</span>
      </div>
      <section id="workflow" className="workflow">
        <div>
          <span className="eyebrow">
            {t("UNE JOURNÉE AVEC MIDAD", "يوم مع مداد")}
          </span>
          <h2>
            {t("Du premier contact", "من أول تواصل")}
            <br />
            {t("au dernier reçu.", "إلى آخر إيصال.")}
          </h2>
        </div>
        <div className="workflow-steps">
          {[
            [
              GraduationCap,
              t("Inscrivez sans vous disperser", "سجّل بدون تشتت"),
              t(
                "Un dossier par élève. Des groupes, des responsables et des inscriptions reliés.",
                "ملف لكل تلميذ، مع مجموعاته وأوليائه وتسجيلاته.",
              ),
            ],
            [
              CalendarDays,
              t("Gardez le rythme des cours", "نظّم سير الدروس"),
              t(
                "Planifiez les séances, faites l’appel et examinez les justificatifs d’absence.",
                "جدول الحصص وسجّل الحضور وراجع مبررات الغياب.",
              ),
            ],
            [
              Wallet,
              t("Suivez chaque dinar", "تابع كل دينار"),
              t(
                "Paiements partiels, soldes dus, remboursements et reçus. Une histoire claire de la caisse.",
                "دفعات جزئية وأرصدة مستحقة ومبالغ مستردة وإيصالات.",
              ),
            ],
          ].map(([Icon, title, text], i) => (
            <article key={i}>
              <span className="step-number">0{i + 1}</span>
              <div>
                <h3>{String(title)}</h3>
                <p>{String(text)}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section id="plans" className="plans">
        <span className="eyebrow">
          {t("UN ACCOMPAGNEMENT À VOTRE TAILLE", "مرافقة تناسب حجمك")}
        </span>
        <h2>{t("Une offre adaptée à votre centre.", "عرض يناسب مركزك.")}</h2>
        <p>
          {t(
            "Les conditions commerciales sont confirmées avec vous avant activation. Les accès familles et enseignants font partie de la plateforme.",
            "يتم تأكيد الشروط التجارية قبل التفعيل. مساحات العائلات والأساتذة جزء من المنصة.",
          )}
        </p>
        <div className="plan-grid">
          {[
            [
              "Essentiel",
              "الأساسي",
              "Les opérations quotidiennes",
              "العمليات اليومية",
            ],
            ["Centre", "المركز", "Une gestion plus complète", "إدارة أشمل"],
            ["Réseau", "الشبكة", "Plusieurs établissements", "عدة مؤسسات"],
          ].map(([fr, a, sub, suba], i) => (
            <article className={i === 1 ? "featured" : ""} key={fr}>
              <span className="eyebrow">0{i + 1}</span>
              <h3>{t(fr, a)}</h3>
              <p>{t(sub, suba)}</p>
              <strong>{t("Sur proposition", "حسب العرض")}</strong>
              <ul>
                <li>
                  <Check size={16} />
                  {t(
                    "Gestion web & accès mobile",
                    "إدارة الويب والوصول المحمول",
                  )}
                </li>
                <li>
                  <Check size={16} />
                  {t("Inscriptions et présences", "التسجيلات والحضور")}
                </li>
                <li>
                  <Check size={16} />
                  {t("Échéances et versements", "المستحقات والدفعات")}
                </li>
                <li>
                  <Check size={16} />
                  {t("Prise en main accompagnée", "مرافقة عند الانطلاق")}
                </li>
              </ul>
              <a className="button outline" href="#contact">
                {t("Échanger avec nous", "تواصل معنا")}
                <ArrowUpRight size={16} />
              </a>
            </article>
          ))}
        </div>
      </section>
      <section id="contact" className="contact-section">
        <div>
          <span className="eyebrow">
            {t("VOTRE PROCHAINE ÉTAPE", "خطوتك التالية")}
          </span>
          <h2>
            {t("Faisons place", "لنفسح المجال")}
            <br />
            <em>{t("à votre centre.", "لمركزك.")}</em>
          </h2>
          <p>
            {t(
              "Décrivez votre établissement et vos besoins. Vous pouvez également ouvrir votre espace pour commencer la configuration.",
              "صف مؤسستك واحتياجاتك. يمكنك أيضًا إنشاء مساحة لبدء الإعداد.",
            )}
          </p>
        </div>
        <form onSubmit={contact} className="contact-form">
          <label>
            {t("Votre nom", "اسمك")}
            <input name="name" required minLength={2} />
          </label>
          <label>
            {t("Email", "البريد الإلكتروني")}
            <input name="email" type="email" required />
          </label>
          <label>
            {t("Établissement", "المؤسسة")}
            <input name="school" required minLength={2} />
          </label>
          <label>
            {t("Votre besoin", "احتياجك")}
            <textarea name="message" required minLength={10} rows={3} />
          </label>
          <button className="button dark" disabled={busy}>
            {busy
              ? t("Enregistrement…", "جاري التسجيل…")
              : t("Envoyer ma demande", "إرسال طلبي")}
            <ArrowUpRight size={16} />
          </button>
          {notice && <p role="status">{notice}</p>}
        </form>
      </section>
      <footer>
        <Link href="/" className="brand">
          <span className="brand-mark">م</span>Midad
        </Link>
        <span>
          {t(
            "Les savoirs avancent. Votre gestion aussi.",
            "المعرفة تتقدم. وإدارتك أيضًا.",
          )}
        </span>
        <Link href="/legal">
          {t("Confidentialité & conditions", "الخصوصية والشروط")}
        </Link>
      </footer>
    </main>
  );
}
