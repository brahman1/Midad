# Guide de lancement Midad

## Démarrer sur ce PC

Après installation et compilation, **Demarrer-Midad.cmd** lance Docker, la base, l'API, le web et l'aperçu mobile. Sur ce PC, RTK est déjà installé ; ce lanceur l'utilise. Les serveurs restent actifs après sa fermeture. L'aperçu mobile est accessible sur http://127.0.0.1:8085. Si ses fichiers sont absents, exécuter d'abord `npm.cmd run export -w mobile`.

Prérequis : Node.js 22.13 ou supérieur, npm et Docker Desktop lancé. Exécuter les commandes depuis le dossier contenant package.json. Sur PowerShell, utiliser npm.cmd si la politique d'exécution bloque npm.ps1.

```powershell
npm.cmd ci
Copy-Item .env.example .env
docker compose -p midad -f ops/compose.local.yml up -d --wait
npm.cmd run build
npm.cmd run demo
```

Ne recopier .env.example que lors de la première installation : cela remplacerait les réglages existants. Ouvrir ensuite deux terminaux :

```powershell
npm.cmd run start:api
```

```powershell
npm.cmd run start:web
```

Site : http://127.0.0.1:3000. Emails de test : http://127.0.0.1:8028. Utiliser **ACCES-LOCAL.md**, établissement midad-local. Les données sont fictives. Les nouveaux comptes confirment leur email via Mailpit avant de modifier les dossiers.

Ports locaux : PostgreSQL 5438, API 4100 et site 3000. En cas de conflit, ajuster les adresses et ports correspondants ; préférer 127.0.0.1 à localhost sur ce PC. Les migrations s'appliquent au démarrage de l'API. Ctrl+C arrête les terminaux ; `docker compose -p midad -f ops/compose.local.yml stop` arrête la base sans supprimer les données. Ne pas utiliser down -v sur une base à conserver.

Les demandes commerciales restent en base même sans destinataire email. Les consulter avec `npm.cmd run leads`. Définir CONTACT_EMAIL et un SMTP pour les recevoir par email.

## APK Android fourni

**Midad-Android-test-local.apk** sert aux essais avec ce PC. Signature de développement, API http://127.0.0.1:4100/api : il ne constitue pas une version Play Store.

Avec un téléphone Android de test connecté en USB, débogage USB accepté et outils officiels Android installés :

```powershell
adb reverse tcp:4100 tcp:4100
adb reverse tcp:3000 tcp:3000
adb install -r Midad-Android-test-local.apk
```

L'API et le site doivent tourner sur le PC. Aucune installation sur téléphone n'a été réalisée durant cette validation.

Reconstruction avec Android SDK et Java 17 :

```powershell
Set-Location mobile
npx.cmd expo prebuild --platform android --no-install
Set-Location ..
powershell -ExecutionPolicy Bypass -File ops/build-android-local.ps1
```

Le script utilise temporairement une lettre de lecteur libre pour contourner les limites de chemins Windows et retire cette association après compilation. Les dossiers android/ios sont générés et exclus de l'archive.

Développement mobile : `npm.cmd run dev:mobile`. Pour un téléphone sur le Wi-Fi local, définir EXPO_PUBLIC_API_URL=http://ADRESSE_DU_PC:4100/api et EXPO_PUBLIC_WEB_URL=http://ADRESSE_DU_PC:3000 dans mobile/.env.local. Sans ces variables, Expo utilise son adresse de développement. Le push distant exige un projet EAS et une compilation de développement ; Expo Go ne valide pas ce parcours.

## Vérifier les sources

L'API, PostgreSQL et Mailpit doivent tourner pour npm test. Les tests créent des établissements fictifs : les exécuter uniquement dans un environnement de test.

```powershell
npm.cmd run check
npm.cmd run format:check
npm.cmd test
npm.cmd run export -w mobile
npx.cmd expo-doctor mobile
npm.cmd audit --workspace api --workspace web --omit=dev
```

Une CI est fournie dans .github/workflows/check.yml ; elle n'a pas été exécutée sur GitHub durant cette livraison.

## Déployer le web et l'API

Sur un serveur Docker avec ports 80/443 accessibles, pointer le DNS du domaine vers le serveur. Copier ops/production.env.example vers ops/production.env et remplir domaine, email TLS, mot de passe PostgreSQL aléatoire hexadécimal d'au moins 48 caractères, SMTP et adresse commerciale. Garder ce fichier privé.

```sh
docker compose --env-file ops/production.env -f ops/compose.production.yml up -d --build --wait
```

Caddy obtient le certificat TLS et distribue site/API sur le même domaine. PostgreSQL n'est pas exposé publiquement. Ne pas créer les comptes fictifs en production. Contrôler https://VOTRE_DOMAINE/api/public/health, une inscription, les emails et un parcours complet avant ouverture.

Hors Docker, API_INTERNAL_URL fixe la cible des réécritures Next.js au moment de la compilation. NEXT_PUBLIC_API_URL reste /api. Les Dockerfiles règlent la cible sur le service interne api.

## Sauvegarde et restauration

```sh
docker compose --env-file ops/production.env -f ops/compose.production.yml --profile backup run --rm backup
```

Les dumps PostgreSQL et SHA-256 sont créés dans ops/backups. Programmer cette commande et transférer les dumps chiffrés sur un autre stockage. Les documents sont sauvegardés en base ; l'export JSON ne contient que leurs métadonnées et ne remplace pas le dump.

Restaurer d'abord dans une base neuve : copier le dump dans le conteneur PostgreSQL, créer la base avec createdb, puis employer `pg_restore --no-owner -U midad -d NOM_BASE_NEUVE CHEMIN_DUMP`. Comparer les données et tester l'application avant de basculer sa connexion. Ne pas utiliser pg_restore --clean sur la base courante. La restauration a été essayée localement ; stockage hors serveur et alertes restent à configurer.

## App Store et Google Play

Créer les comptes Apple/Google et un projet Expo/EAS. Confirmer disponibilité/propriété des identifiants dz.midad.app, choisir les signatures et configurer APNs/FCM. Ces identifiants sont un choix de travail à valider avant publication.

Variables de l'environnement EAS :

```text
EXPO_PUBLIC_API_URL=https://VOTRE_DOMAINE/api
EXPO_PUBLIC_WEB_URL=https://VOTRE_DOMAINE
EXPO_PUBLIC_EAS_PROJECT_ID=IDENTIFIANT_DU_PROJET_EAS
```

Depuis mobile/, utiliser EAS CLI officiel pour lier le projet et configurer les credentials, puis `eas build --platform all --profile production`. Ce profil refuse une API sans HTTPS ou un identifiant EAS absent. Garder les dossiers natifs générés exclus du dépôt pour qu'EAS reconstruise la configuration de production ; ne pas envoyer le projet Android local autorisant HTTP et signé pour les essais.

Préparer fiches stores, captures sur appareils, confidentialité, URL de suppression de compte, déclarations des données et support. Valider Android en tests internes et iOS via TestFlight avant soumission. Le bundle iOS de Metro ne prouve pas une compilation Xcode ni une acceptation Apple.
