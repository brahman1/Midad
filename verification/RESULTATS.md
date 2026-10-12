# Validation du 10 octobre 2026

- API NestJS et web Next.js compilés ; images Docker lancées et santé API positive.
- TypeScript validé pour shared, api, web et mobile.
- Tests Node/PostgreSQL/Mailpit : 18 réussites, 0 échec, 0 ignoré, environ 7 secondes sur les images Docker. Les 17 scénarios couvrent email, rôles, capacité, planning, présence, factures, paiements, remboursements, paie et concurrence, documents, annonces, isolation, caisse, export et révocation.
- Dump PostgreSQL restauré dans une base neuve. Décomptes identiques tenants/élèves/paiements/séances/documents : 10 / 15 / 18 / 13 / 5. La base de contrôle et le dump temporaire ont ensuite été retirés. Données fictives uniquement.
- Audit npm de production api/web : 0 vulnérabilité signalée. Avis ouverts de la chaîne Expo décrits dans DELIVERY.md.
- Bundles Expo Android, iOS et web générés. APK Android natif recompilé avec succès : 602 tâches Gradle, environ 2 minutes 11 secondes pour le dernier passage.
- Expo Doctor : 21 contrôles réussis sur le projet CNG avant régénération du dossier Android de compilation. Les sources livrées excluent ce dossier généré.
- Web inspecté dans le navigateur : création réelle d'un dossier fictif, tableau de bord et présentation arabe à largeur téléphone.
- Aperçu web React Native avec parent fictif : son enfant, groupe, solde et planning. Les essais sur appareils natifs restent à réaliser.

Ces résultats locaux ne constituent pas un engagement de capacité ni un audit indépendant. Les captures contiennent uniquement les données de test.

## Refonte et validation du 11 octobre 2026

- Tableau de bord API enrichi avec des données calculées et limitées par établissement, rôle et enfant lié : présences, encaissements, échéances, groupes et élèves récents.
- Tests d'intégration : 18 réussites, zéro échec ; assertions ajoutées pour ces nouvelles données et les accès famille/enseignant/autre établissement.
- TypeScript validé sur les quatre workspaces ; build Next.js et exports Expo Android/iOS/web réussis.
- Démonstration enrichie : 77 élèves, 10 groupes, 6 enseignants, factures, paiements, présences et séances fictifs. Deux exécutions de l'enrichissement, décomptes stables.
- Aperçu React Native web inspecté sur ordinateur et à 390 × 844 pixels en français et arabe ; montants complets et disposition de droite à gauche vérifiés. Captures : `refonte-ordinateur.jpg`, `refonte-telephone.jpg`, `refonte-arabe-telephone.jpg`.
- APK Android local recompilé avec succès après la dernière correction d'affichage : 602 tâches Gradle, 45 secondes. Aucun essai sur appareil natif ajouté à cette validation.
- API, site Next.js et aperçu mobile relancés localement. Sources et APK mis à jour ; archive et empreintes régénérées.

## Calendrier web interactif — 11 octobre 2026

- Grilles jour/semaine/mois et agenda en liste ; couleurs et légende par groupe, filtres, recherche et navigation entre périodes.
- Détail d'une séance et accès à sa feuille de présence inspectés ; création depuis un créneau avec début et fin préremplis vérifiée sans enregistrer de séance supplémentaire.
- Vue mensuelle : 87 séances fictives en octobre ; passage à novembre sans séances vérifié. Filtre Samir Benali : 13 séances dans la semaine du 11 au 17 octobre.
- Vue jour inspectée à 390 × 844 pixels en français/arabe ; largeur de page sans débordement. Horaires numériques conservés dans le sens de lecture de gauche à droite en arabe.
- API : dates bornées à 62 jours, rejet des dates invalides et périodes inversées, historique/futur et isolation entre établissements vérifiés.
- 22 tests réussis (18 existants avec assertions API ajoutées, 4 sur dates, mois, cours simultanés et séances traversant minuit). Builds API/shared/web réussis.
- Captures du calendrier dans ce dossier ; archive des sources actualisée. Pas de modification du planning natif dans cette livraison.

## GitHub et test Render gratuit — 11 octobre 2026

- Dépôt https://github.com/brahman1/Midad : push de `main` réussi, fichiers privés et secrets exclus du commit.
- Build shared/API/Next.js réussi ; 24 tests locaux réussis et formatage vérifié.
- Render : build et démarrage réussis sur Linux, commit applicatif `a333cb6`. Web Node Free et PostgreSQL 17 Free à Francfort. Aucun moyen de paiement ajouté ; aucun plan payant sélectionné.
- URL vérifiée : https://midad-test-brahman1.onrender.com ; connexion réelle dans le navigateur, tableau de bord renseigné, vues semaine/mois du calendrier.
- Dix vérifications HTTPS, dont les six rôles : cookies sécurisés, refus anonyme/origine étrangère/ancien mot de passe, portée des élèves/séances et révocation après déconnexion. Rapport `render-smoke.json` sans mot de passe ni jeton.
- 76 élèves fictifs, 10 groupes, 6 enseignants ; 53 séances du 11 au 17 octobre. Captures `render-calendrier.png` et `render-free-service.png`.
- Base gratuite expirant le 10 novembre 2026. Emails cloud non configurés ; aucune publication mobile sur les stores ajoutée à cette validation.

## Cours récurrents et fermetures — 11 octobre 2026

- Moteur partagé : répétitions, semaines alternées, mois et dates exclus, pauses et fermetures inclusives, cours traversant minuit et rejet des dates invalides. Horaires d'Alger.
- Migration 004 appliquée localement : fermetures, séries et liaison aux séances ; export administratif enrichi.
- 30 tests réussis, zéro échec : PostgreSQL réel, création simultanée sans doublon, conflits, fermeture avec annulation explicite, protection des ajouts individuels, arrêt idempotent, droits professeur/famille et isolation entre établissements.
- Builds shared/API/web et contrôles TypeScript des quatre workspaces réussis.
- Navigateur : aperçu français vérifié (quatre séances en novembre, décembre et le 15 novembre exclus), disposition arabe à 390 × 844 pixels, aucune largeur de page excessive. Capture `recurrence-mobile-ar.png`.
- Interface de création dans le web responsive ; aucune nouvelle compilation des applications natives pour cette fonction.
- Création réelle de quatre séances depuis le formulaire local, puis arrêt confirmé de la série : quatre séances conservées, zéro séance à venir.
- Déploiement Render gratuit réussi en 1 min 58 s, commit applicatif `aeff6f6`. Migration et nouveaux endpoints vérifiés par HTTPS pour direction, professeur et parent ; aperçu en ligne conforme à l'exemple. Rapport `render-recurrence-smoke.json`, capture `render-recurrence.png`. Aucun cours ni fermeture ajouté sur Render pendant cette vérification.

## Connexion depuis le site sur téléphone — 12 octobre 2026

- Cause reproduite : le lien de connexion était masqué par la règle CSS des liens de navigation sous 900 pixels.
- Lien présenté comme bouton permanent ; seuls les liens secondaires et la création d'établissement dans l'en-tête sont masqués sur les petits écrans. L'en-tête peut passer sur deux lignes pour les écrans les plus étroits.
- Build Next.js/TypeScript et formatage des fichiers modifiés réussis. Visibilité et disposition vérifiées dans le navigateur à 390 et 320 pixels en français et arabe ; clic sur le bouton arabe ouvrant le formulaire de connexion vérifié.
- Render gratuit : déploiement `3dd68de` réussi en 1 min 51 s. Bouton visible sur la version en ligne à 390 pixels et navigation vers le formulaire de connexion vérifiée ; capture `render-mobile-connexion.png`.

## Couche de sécurité et protection des données — 12 octobre 2026

- Migration 005, limitations atomiques PostgreSQL, expiration/révocation des sessions, confirmation récente, anti-CSRF renforcé, journal sans contenu des dossiers ni secret ; accès enseignant minimisé et fichiers avec extension/encodage contrôlés.
- Double authentification TOTP et codes de secours à usage unique, secret chiffré AES-256-GCM et rotation des sessions à l'activation/désactivation. Configuration de production Docker exigeant MFA pour les comptes privilégiés ; option facultative sur le service de démonstration.
- CSP avec nonce neuf appliqué aux scripts Next.js, pages dynamiques et API sans cache, en-têtes anti-iframe/nosniff/referrer/HSTS. Secrets des liens d'authentification retirés de la barre d'adresse après lecture.
- Écran français/arabe avec sessions, export personnel, demandes de droits et gestion par la direction. Notice Brainfor/contact@brainfor.fr, registre à compléter et conditions de conformité dans SECURITE-CONFORMITE.md. Aucune certification ni déclaration à une autorité réalisée.
- Suite complète : **40 tests réussis, zéro échec**, sur API/PostgreSQL réel et HTTP Next.js. Contrôles TypeScript des quatre workspaces, builds shared/API/web et formatage vérifiés.
- Audit npm production API/web/shared : zéro vulnérabilité signalée. Deux avis non corrigés dans l'outillage mobile (braces/node-forge, propagés à 15 entrées), détail et mesures de limitation dans SECURITE-CONFORMITE.md.
- Bundles Expo Android/iOS/web actualisés ; APK Android local recompilé en 59 s, 602 tâches Gradle. Signature de développement et configuration locale conservées, aucun nouvel essai natif sur appareil.
- Interface ordinateur et téléphone à 390 pixels en arabe inspectée sans débordement de page. Capture security-mobile-ar.png. Aucune MFA activée sur le compte partagé de démonstration.
- Premier déploiement `180527d` réussi sur Render en 1 min 40 s ; sept contrôles HTTPS réalisés pour direction/professeur/parent (CSP, cookies, clé MFA disponible, notices, export personnel et permissions). Rapport render-security-smoke.json.
- Migration 006 : les anciennes sessions ne reçoivent pas artificiellement une confirmation récente lors du passage au nouveau schéma. Test de migration supplémentaire réussi sur PostgreSQL dans une transaction annulée ; les 40 tests de la suite et ce contrôle passent.
- Déploiement final `9561f99` réussi sur Render en 1 min 24 s ; sept contrôles HTTPS répétés avec succès et clé MFA conservée. Dans le navigateur : export bloqué en l'absence de confirmation récente, puis confirmation du mot de passe réussie ; aucun MFA ni dossier modifié. Capture render-security-center.png.
