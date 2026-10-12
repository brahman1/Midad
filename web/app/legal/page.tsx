import Link from "next/link";
export default function Legal() {
  return (
    <main className="legal">
      <Link className="brand" href="/">
        Midad · مداد
      </Link>
      <h1>Confidentialité et utilisation de Midad</h1>
      <p>
        Version du 12 octobre 2026. Exploitant déclaré :{" "}
        <strong>Brainfor</strong>. Contact pour la protection des données :{" "}
        <a href="mailto:contact@brainfor.fr">contact@brainfor.fr</a>.
      </p>
      <h2>Version de démonstration</h2>
      <p>
        Le site Render actuel est une démonstration. Utilisez uniquement des
        personnes et des dossiers fictifs. Cette notice ne constitue ni une
        certification de sécurité ni une attestation de conformité. Les
        coordonnées juridiques complètes de Brainfor, les contrats et les
        formalités nécessaires au traitement de vrais dossiers restent à
        finaliser.
      </p>
      <h2>Qui est responsable ?</h2>
      <p>
        Chaque établissement détermine les finalités, les informations
        nécessaires à ses cours, ses modalités d’inscription et ses durées de
        conservation. Brainfor fournit la plateforme et doit encadrer le
        traitement effectué pour le compte de l’école par un contrat de
        sous-traitance. Brainfor organise aussi la gestion des comptes et la
        sécurité du service. Les contacts de l’établissement sont visibles dans
        « Sécurité & confidentialité » lorsqu’ils ont été renseignés par la
        direction.
      </p>
      <h2>Données utilisées et finalités</h2>
      <p>
        Les comptes contiennent le nom, l’email, le rôle et la langue ; le mot
        de passe est haché. Les dossiers scolaires peuvent comprendre identité,
        coordonnées, date de naissance, groupe, présences et inscriptions. Les
        factures et reçus documentent les montants et opérations saisis ; aucune
        donnée de carte bancaire n’est collectée. Documents, annonces et
        notifications servent aux échanges pédagogiques. Les traces de sécurité
        servent à contrôler les accès et à investiguer les incidents.
      </p>
      <p>
        Les dossiers peuvent concerner des mineurs. L’établissement doit
        vérifier l’identité et l’autorité du représentant légal, informer les
        familles, documenter le fondement du traitement et recueillir les
        accords lorsqu’ils sont nécessaires. Ne renseignez pas de diagnostic
        médical, de pièce d’identité ou d’information sensible dans les notes et
        demandes libres sans procédure légale dédiée. Les informations ne sont
        pas vendues et aucun ciblage publicitaire n’est intégré.
      </p>
      <h2>Accès et prestataires</h2>
      <p>
        La direction gère son établissement. Un professeur accède aux groupes
        qui lui sont attribués ; les familles aux dossiers liés à leur compte.
        Les documents sont téléchargés après vérification des droits. Le serveur
        de test et la base PostgreSQL sont hébergés par Render à Francfort, en
        Allemagne. Cet hébergement hors d’Algérie nécessite l’examen des règles
        applicables aux transferts avant toute utilisation avec des dossiers
        réels. Un hébergement européen ne suffit pas, à lui seul, à établir la
        conformité.
      </p>
      <p>
        Les notifications mobiles sont facultatives ; lorsqu’elles sont
        activées, le jeton d’appareil et une alerte générique transitent par
        Expo et les infrastructures Apple/Google. Le contenu des annonces et
        dossiers n’est pas envoyé dans ces alertes. Les emails dépendent du
        prestataire configuré par l’exploitant ; leur envoi n’est actuellement
        pas configuré sur Render. Les prestataires et contrats de production
        doivent être validés avant la mise en service.
      </p>
      <h2>Conservation</h2>
      <p>
        Une session est valable au plus sept jours et expire après douze heures
        sans activité. Les liens d’authentification expirent après une heure.
        Les contrôles de limitation temporaires sont nettoyés après expiration ;
        les journaux de sécurité, les notifications internes et les demandes
        commerciales sont conservés au plus 180 jours. Les messages email
        techniques sont supprimés après sept jours et les messages push après
        trente jours. Les demandes de droits traitées sont conservées un an
        après la dernière réponse.
      </p>
      <p>
        Ces délais sont des paramètres de fonctionnement du service, pas des
        durées légales universelles. L’école doit définir les durées applicables
        aux dossiers scolaires, documents, pièces financières, journaux métier
        et archives de sauvegarde, en tenant compte des obligations pertinentes.
        Ces données ne sont pas automatiquement effacées par la fermeture d’un
        compte.
      </p>
      <h2>Vos droits</h2>
      <p>
        Dans « Sécurité & confidentialité », vous pouvez télécharger les
        informations liées à votre compte et adresser à votre école une demande
        d’accès, de rectification, d’effacement, de limitation, d’opposition ou
        de portabilité. L’école doit examiner le droit applicable et répondre
        avec les mesures effectuées ou un motif de refus. L’échéance interne est
        fixée à un mois ; elle ne remplace pas les délais impératifs
        applicables. Vous pouvez aussi écrire à contact@brainfor.fr pour une
        question sur Midad.
      </p>
      <p>
        La suppression du compte personnel désactive l’accès et retire les
        éléments d’authentification ; elle ne supprime pas automatiquement un
        dossier scolaire ni les écritures devant être conservées. Les données
        propres aux enfants doivent faire l’objet d’une demande auprès de leur
        établissement. Un recours peut être exercé auprès de l’ANPDP en Algérie
        et, lorsque le RGPD est applicable, auprès de l’autorité de contrôle
        compétente.
      </p>
      <h2>Cookies et protection</h2>
      <p>
        Le site utilise un cookie de session nécessaire au fonctionnement,
        protégé contre l’accès JavaScript et envoyé par HTTPS en production.
        Aucun outil publicitaire ou statistique tiers n’est intégré. La double
        authentification peut être activée par chaque titulaire de compte ; elle
        est particulièrement recommandée pour les personnes ayant un accès
        administratif ou financier. Aucune protection ne garantit l’absence
        totale de vulnérabilité.
      </p>
      <h2>Cadre juridique et conditions</h2>
      <p>
        La préparation de Midad prend en compte la loi algérienne n° 18-07,
        modifiée par la loi n° 25-11, et les principes du RGPD. Leur champ
        d’application, les formalités auprès de l’ANPDP, la désignation du
        délégué, les transferts, les bases juridiques et les contrats doivent
        être confirmés par l’exploitant et les écoles avant la production. Les
        modalités commerciales doivent être convenues séparément.
        L’établissement reste responsable des décisions pédagogiques, des tarifs
        et du traitement comptable de ses opérations.
      </p>
      <hr />
      <section dir="rtl" lang="ar">
        <h1>الخصوصية واستخدام مداد</h1>
        <p>
          المشغل المعلن: Brainfor. جهة اتصال حماية البيانات:
          contact@brainfor.fr. نسخة 12 أكتوبر 2026.
        </p>
        <h2>نسخة تجريبية</h2>
        <p>
          استعمل بيانات وهمية فقط في نسخة Render. هذه الصفحة ليست شهادة أمان أو
          إثبات امتثال. يجب استكمال الهوية القانونية والعقود والإجراءات اللازمة
          قبل معالجة الملفات الحقيقية.
        </p>
        <h2>المسؤوليات والبيانات</h2>
        <p>
          تحدد المؤسسة أغراض معالجة ملفات التلاميذ والحضور والفواتير والوثائق
          ومدد الاحتفاظ بها. يوفر Brainfor المنصة ويجب تنظيم المعالجة لحساب
          المؤسسة بعقد. لا تجمع المنصة بيانات البطاقات البنكية ولا تبيع
          البيانات. يجب التحقق من صلاحية الولي وإبلاغ العائلات وتحديد الأساس
          القانوني، وعدم إدخال معلومات طبية أو حساسة في الحقول الحرة دون إجراءات
          مخصصة.
        </p>
        <h2>الاستضافة والحماية</h2>
        <p>
          نسخة الاختبار مستضافة لدى Render في فرانكفورت بألمانيا. يجب فحص
          متطلبات نقل البيانات خارج الجزائر قبل استعمال ملفات حقيقية. إشعارات
          الهاتف اختيارية، وتستعمل Expo وApple/Google لإرسال تنبيه عام فقط.
          يمكنك تفعيل المصادقة الثنائية وإلغاء الجلسات الأخرى من صفحة الأمان
          والخصوصية.
        </p>
        <h2>الاحتفاظ والحقوق</h2>
        <p>
          تنتهي الجلسة بعد 12 ساعة من الخمول وبحد أقصى 7 أيام. تحفظ سجلات الأمان
          والإشعارات الداخلية والطلبات التجارية 180 يومًا، والرسائل التقنية
          البريدية 7 أيام، ورسائل الهاتف 30 يومًا. تحفظ طلبات الحقوق المعالجة
          سنة بعد آخر رد. تحدد المؤسسة مدد الملفات المدرسية والمالية والنسخ
          الاحتياطية وفق الالتزامات المعمول بها.
        </p>
        <p>
          يمكن تنزيل بيانات حسابك وطلب الوصول أو التصحيح أو المحو أو التقييد أو
          الاعتراض أو النقل عبر صفحة الأمان والخصوصية. تدرس المؤسسة الطلب وتوضح
          الإجراءات الفعلية أو سبب الرفض. حذف الحساب لا يمحو الملف المدرسي أو
          السجلات المطلوب الاحتفاظ بها تلقائيًا. يمكن التواصل مع
          contact@brainfor.fr أو الجهة الرقابية المختصة.
        </p>
        <h2>قبل التشغيل الفعلي</h2>
        <p>
          تؤخذ في الاعتبار أحكام القانون 18-07 المعدل بالقانون 25-11 ومبادئ
          RGPD. يجب التحقق من مجال التطبيق وإجراءات ANPDP وتعيين مندوب حماية
          البيانات والأسس القانونية والعقود وشروط النقل. لا يوجد أمان معصوم من
          الثغرات.
        </p>
      </section>
      <Link className="button dark" href="/">
        Retour · العودة
      </Link>
    </main>
  );
}
