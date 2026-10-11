# État de livraison — 11 octobre 2026

Le code du périmètre décrit dans README.md est livré avec son infrastructure et ses tests. Cette version fonctionne localement et sur une instance de test Render gratuite ; elle ne constitue pas une publication commerciale déjà exploitée.

| Élément | État vérifié |
|---|---|
| API et site | Compilation réussie, images Docker construites et lancées |
| Types des quatre workspaces | Vérification TypeScript réussie |
| Tests métier, calendrier et configuration Render | 24 tests réussis, aucun échec |
| Isolation et rôles | Accès croisés et parcours famille/enseignant testés |
| Paiements, remboursements, caisse et paie | Testés sur PostgreSQL, y compris concurrence et doublons |
| Emails | Livraison Mailpit et consommation unique des liens testées |
| Documents | Permissions et contenu des téléchargements testés |
| Web | Connexion, création d'élève, planning/appel et présentation arabe étroite inspectés dans le navigateur |
| Mobile | Aperçu web du code React Native inspecté avec un compte parent ; ne remplace pas un appareil natif |
| Bundles Android/iOS/web | Génération Expo réussie |
| Android natif | APK compilé ; signature de développement et serveur local |
| iOS natif | Source et bundle fournis ; compilation Xcode/TestFlight non effectuée |
| Sauvegarde | Dump restauré dans une base neuve, décomptes comparés |
| Déploiement web de test | https://midad-test-brahman1.onrender.com — service Node Free et PostgreSQL Free, vérifiés le 11 octobre 2026 |
| Stores | Non publiés ; comptes développeur et signatures de publication à fournir |
| Push | Code et file d'envoi présents ; APNs/FCM/EAS non configurés, livraison native non vérifiée |

## Refonte du 11 octobre 2026

Le tableau de bord web et mobile a été repris : navigation latérale sur ordinateur, cartes d'indicateurs, graphique des encaissements, prochaines séances, échéances et derniers reçus. Les valeurs proviennent de PostgreSQL et respectent les droits de l'utilisateur. La démonstration locale comporte désormais 77 élèves, 10 groupes et 6 enseignants fictifs. Le script d'enrichissement a été exécuté deux fois sans doubler ses données.

Les 18 tests d'intégration passent, avec de nouvelles assertions d'isolation des données du tableau de bord pour les familles, enseignants et établissements. Les quatre vérifications TypeScript et les builds Next.js/Expo réussissent. L'aperçu React Native web a été inspecté sur ordinateur et à 390 pixels en français et arabe. L'APK Android local a été recompilé après correction des montants sur téléphone. Les captures `verification/refonte-*.jpg` montrent cette interface. Le nouveau tableau de bord Next.js est compilé ; son inspection visuelle spécifique n'a pas été effectuée lors de cette refonte.

### Calendrier web interactif

Le planning web dispose de quatre vues (jour, semaine, mois, liste), d'une navigation par période et date, de couleurs par groupe, de filtres par groupe/professeur/statut et d'une recherche. Le détail d'une séance présente date, horaires, durée, professeur, salle, matière, niveau, effectif actuel et notes ; il ouvre les présences, la reprogrammation et le changement de statut selon les droits. Cliquer sur un créneau libre préremplit les horaires de création. Les cours simultanés et les séances traversant minuit restent visibles. Sur téléphone, la vue jour est sélectionnée à l'ouverture ; l'arabe conserve les plages horaires dans l'ordre de lecture numérique.

Les séances sont chargées pour la période affichée, avec une période maximale de 62 jours et les mêmes contrôles d'accès que le planning existant. Le calendrier Next.js a été inspecté dans le navigateur sur ordinateur et téléphone en français/arabe. Les builds API/web et les 22 tests passent. Cette évolution concerne le planning web ; l'APK fourni conserve le planning mobile précédent.

## Test Render gratuit — 11 octobre 2026

Sources poussées sur https://github.com/brahman1/Midad (`main`). Le commit applicatif `a333cb6` a été compilé et déployé avec succès par Render. Le site et l'API partagent le même domaine HTTPS ; PostgreSQL 17 est à Francfort, avec les connexions externes désactivées. Les deux ressources sont explicitement sur le plan Free. Le compte Hobby ne comporte aucune carte bancaire ; aucun achat, disque payant ou upgrade n'a été activé.

Vérifications HTTPS : santé PostgreSQL/API, refus des accès anonymes et origines étrangères, refus du mot de passe local, connexion des six rôles fictifs, cookies Secure/HttpOnly/SameSite, accès au tableau de bord, élèves et planning selon le rôle, borne de dates invalide et révocation après déconnexion. La démonstration hébergée comporte 76 élèves, 10 groupes, 6 enseignants et 53 séances dans la semaine du 11 au 17 octobre. Le navigateur montre le calendrier et ses vues semaine/mois. Preuves : `verification/render-smoke.json`, `verification/render-calendrier.png` et `verification/render-free-service.png`.

Cette base gratuite expire le **10 novembre 2026**. Le service dort après 15 minutes d'inactivité et peut demander environ une minute pour se réveiller. Aucun SMTP cloud configuré : utiliser les comptes fictifs déjà vérifiés ; les emails d'inscription, invitation et récupération ne sont pas livrés. L'APK local fourni continue d'utiliser la configuration locale. Voir `RENDER.md` pour les réglages et limites. Le mot de passe hébergé distinct n'est pas publié dans Git.

## Avant ouverture aux clients

1. Fournir domaine, hébergement, SMTP transactionnel et identité commerciale ; compléter confidentialité, conditions et offres.
2. Déployer en HTTPS avec secrets de production ; programmer les sauvegardes chiffrées hors serveur, les alertes et les restaurations périodiques.
3. Créer les comptes Apple/Google et Expo/EAS, confirmer les identifiants définitifs, configurer signatures et APNs/FCM ; compiler les versions de publication.
4. Réaliser la recette sur Android, iPhone et tablette : présence, encaissement, documents, liens email, push, clavier arabe, réseau interrompu, reprise de session, accessibilité et suppression de compte.
5. Effectuer une revue de sécurité et un essai de charge adapté au nombre réel d'établissements. Les tests livrés ne constituent pas un audit indépendant.

L'audit npm des dépendances de production API/web signale zéro vulnérabilité à la date de validation. Celui du monorepo signale encore des avis élevés dans la chaîne d'outils Expo, notamment braces et node-forge, sans correctif compatible stable identifié pendant ce travail. Réévaluer ces avis avant les builds de publication ; aucun audit fix --force vers un ancien SDK n'a été appliqué. Ne pas conclure que toute la chaîne mobile est exempte de vulnérabilités.

Les reçus et clôtures sont des outils de gestion ; la conformité fiscale et les conditions commerciales de l'exploitant n'ont pas été validées. La facturation des abonnements des écoles et l'intégration CIB/Edahabia nécessitent un périmètre et les accès du prestataire.
