import Link from "next/link";
export default function Legal() {
  return (
    <main className="legal">
      <Link className="brand" href="/">
        Midad · مداد
      </Link>
      <h1>Confidentialité et conditions d’utilisation</h1>
      <p>
        Midad est une plateforme de gestion éducative. L’établissement organise
        les cours, détermine les tarifs et reste responsable des décisions
        pédagogiques et administratives. Les reçus enregistrent les opérations
        saisies ; leur traitement comptable et fiscal relève de l’établissement.
      </p>
      <h2>Données et accès</h2>
      <p>
        Les dossiers, inscriptions, présences et opérations financières servent
        à la gestion du centre. Les accès dépendent du rôle : administration,
        enseignant, parent ou élève. Une famille accède aux dossiers qui lui
        sont associés. La plateforme ne vend pas ces informations.
      </p>
      <h2>Demandes et suppression</h2>
      <p>
        Vous pouvez demander la rectification de vos informations à votre
        établissement et supprimer votre compte depuis les paramètres. Les
        opérations financières et historiques nécessaires à la gestion peuvent
        être conservés selon les obligations applicables. Le propriétaire doit
        transférer la responsabilité de son établissement avant de supprimer son
        compte.
      </p>
      <h2>Notifications</h2>
      <p>
        Les notifications dans l’application sont liées aux cours et à la
        gestion du dossier. Les notifications push sont facultatives et peuvent
        être désactivées sur le téléphone. Leur réception dépend des
        autorisations et de la connexion.
      </p>
      <h2>Avant une mise en service publique</h2>
      <p>
        L’exploitant doit compléter les coordonnées de contact, les
        prestataires, les durées de conservation et les engagements commerciaux
        correspondant à son déploiement. Ces informations sont encore à
        renseigner dans cette installation locale.
      </p>
      <hr />
      <section dir="rtl" lang="ar">
        <h1>الخصوصية وشروط الاستخدام</h1>
        <p>
          مداد منصة للإدارة التعليمية. المؤسسة مسؤولة عن تنظيم الدروس والتسعير
          والقرارات التعليمية والإدارية. تُستخدم الملفات والحضور والعمليات
          المالية لإدارة المركز، ويعتمد الوصول على صلاحيات كل مستخدم.
        </p>
        <h2>حقوقك</h2>
        <p>
          يمكن طلب تصحيح البيانات من المؤسسة وحذف الحساب من الإعدادات. قد تُحفظ
          السجلات المالية والإدارية وفق الالتزامات المعمول بها. يجب نقل ملكية
          المؤسسة قبل حذف حساب مالكها.
        </p>
        <h2>الإشعارات</h2>
        <p>
          الإشعارات المحمولة اختيارية ويمكن تعطيلها من الهاتف. قبل التشغيل
          العام، يجب استكمال بيانات المشغّل ومقدّمي الخدمة ومدد الاحتفاظ والشروط
          التجارية.
        </p>
      </section>
      <Link className="button dark" href="/">
        Retour · العودة
      </Link>
    </main>
  );
}
