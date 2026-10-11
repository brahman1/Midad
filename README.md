# Midad · مداد

Gestion des écoles privées et centres de formation algériens : site public, espaces web par rôle et application Android/iOS en français et arabe.

Stack retenue : TypeScript, Next.js, NestJS, PostgreSQL et Expo/React Native. Les validations sont partagées et les fonctions métier résident dans une seule API. Rust n'est pas nécessaire pour les parcours et la charge de ce produit.

## Fonctions développées

- Établissements séparés, vérification email, invitations, connexion, réinitialisation de mot de passe et révocation des sessions.
- Direction, responsable, caissier, enseignant, parent et élève, avec droits contrôlés côté serveur.
- Élèves et familles, groupes, enseignants, inscriptions et capacité des groupes.
- Séances, conflits d'horaires, salles, présences, retards, absences et justificatifs.
- Calendrier web interactif : vues jour, semaine, mois et liste, couleurs par groupe, filtres, fiche détaillée et création depuis un créneau libre. Semaine du dimanche au samedi, horaires d'Alger et cours simultanés affichés côte à côte.
- Programmation des cours récurrents en une fois : jours de semaine, horaire, durée, semaines alternées, mois exclus et pauses. Fermetures de l'école partagées, aperçu des dates et conflits, arrêt des séances futures d'une série. Voir **PLANNING.md**.
- Factures ponctuelles ou mensuelles, versements partiels, remboursements, reçus, ouverture et clôture de caisse avec écart.
- Rémunérations à l'heure, à la séance ou au pourcentage des encaissements nets, historique des tarifs et règlements protégés contre les doublons.
- Annonces ciblées, notifications, documents protégés, journal administratif et export des données.
- Site commercial et formulaire de contact enregistré en base ; interfaces responsive, arabe de droite à gauche, dinars et heures d'Alger.
- Tableau de bord avec indicateurs, encaissements des sept derniers jours, prochaines séances, échéances et reçus ; données calculées par l'API selon les droits du compte.

La démonstration locale comprend 77 élèves, 10 groupes et 6 enseignants fictifs, avec inscriptions, présences, factures, règlements et planning. `npm run demo` crée et enrichit cet établissement de test ; les captures de la refonte sont dans `verification/refonte-*.jpg`.

Les paramètres avancés et l'export complet passent par le web ; le mobile propose un lien vers cet espace. Les paiements CCP, virement et carte externe enregistrent des opérations réalisées ailleurs. Le paiement bancaire en ligne, la facturation automatique des abonnements SaaS, les SMS et WhatsApp ne sont pas intégrés.

## Structure

| Dossier | Contenu |
|---|---|
| api/ | Serveur NestJS et migrations PostgreSQL |
| web/ | Site Next.js et espaces de gestion/familles |
| mobile/ | Application Expo Android/iOS, icônes et configuration EAS |
| shared/ | Validations, droits et libellés partagés |
| tests/ | Tests d'intégration sur une vraie base et un serveur email local |
| ops/ | Docker, HTTPS, sauvegarde et compilation Android locale |
| scripts/ | Données fictives, démarrage et demandes commerciales |
| verification/ | Résultats et captures des interfaces |

Lire **GUIDE-LANCEMENT.md**, **ACCES-LOCAL.md** et **DELIVERY.md**. L'archive des sources exclut les caches, secrets, bases et projets natifs générés. L'APK est fourni séparément.

Les builds web/API, les tests d'intégration et les bundles Android/iOS ont été exécutés. Une version de test est hébergée sur Render gratuit : https://midad-test-brahman1.onrender.com (conditions et limites dans RENDER.md). Aucune publication Apple/Google n'a été effectuée. La compilation native iOS et les essais sur appareils réels restent à effectuer.
