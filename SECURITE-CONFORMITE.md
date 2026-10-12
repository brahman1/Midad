# Sécurité et préparation à la conformité — 12 octobre 2026

Exploitant déclaré par le porteur du projet : **Brainfor**, **contact@brainfor.fr**. Ce document décrit les contrôles livrés et les conditions restant à remplir. Il ne certifie pas la conformité et ne promet pas de sécurité infaillible.

## Contrôles techniques livrés

| Risque | Contrôle | Limite à connaître |
|---|---|---|
| Accès aux dossiers d'une autre école ou famille | Autorisations serveur et requêtes limitées à l'établissement ; parents aux enfants liés, professeurs à leurs groupes ; coordonnées familiales et date de naissance retirées des listes des enseignants | Les associations parent/enfant restent à vérifier par la direction |
| Vol de mot de passe | Hachage bcrypt coût 12 ; nouveaux mots de passe limités à 72 octets sans troncature, 12 caractères de plusieurs types ou phrase de 20 caractères | Les comptes de démonstration sont partagés et ne conviennent pas à la production |
| Connexions automatisées | Compteurs atomiques PostgreSQL, conservés entre redémarrages : 12 tentatives par compte/15 min, 120 requêtes d'authentification par IP/15 min, 600 requêtes API par IP/min, limites sur confirmation/export/contact | Ce n'est pas un système anti-DDoS réseau ; calibrer pour les utilisateurs partageant une IP |
| Session volée ou oubliée | Jetons aléatoires hachés en base, cookie HttpOnly/Secure/SameSite=Lax, jeton absent de la réponse web habituelle ; 12 h d'inactivité et 7 jours maximum ; dix sessions maximum ; révocation depuis l'interface | Le client natif utilise un jeton dans SecureStore. L'aperçu Expo web utilise sessionStorage et n'est pas le site Next.js |
| Actions sensibles | Confirmation du mot de passe et du facteur activé ; confirmation valable 10 min pour les exports et la révocation ; mot de passe/MFA exigés pour supprimer le compte | La suppression du compte n'efface pas automatiquement le dossier scolaire |
| Compromission d'un compte administratif | TOTP, secrets chiffrés AES-256-GCM avec clé serveur et identité associée ; codes non rejouables ; huit codes de secours hachés, à usage unique ; rotation des sessions lors d'activation/désactivation | MFA facultative sur Render de démonstration. `REQUIRE_ADMIN_MFA=true` dans la configuration Docker de production impose la MFA aux propriétaires, responsables et caissiers |
| Requêtes forgées et scripts injectés | Origine contrôlée même avec Authorization ; en-tête malformé ne contourne plus les contrôles ; CSP avec nonce neuf, scripts sans unsafe-inline/eval en production ; anti-iframe, nosniff, HSTS, referrer absent | Les styles inline sont autorisés pour les graphiques et composants ; aucun scanner antivirus de documents n'est intégré |
| Données dans le cache ou les logs | API et pages dynamiques privées sans cache ; journal des lectures/modifications sans contenu des dossiers, mot de passe, jeton ou OTP ; logs d'erreur sans payload SQL ; journal métier réduit aux champs utiles | Les sauvegardes et l'administration de PostgreSQL restent à protéger séparément |
| Données visibles sur écran verrouillé ou chez un prestataire | Push générique ; contenu pédagogique conservé dans l'espace authentifié ; contenu/recipient de la file d'envoi supprimés après livraison | Expo, Apple/Google et tout prestataire email doivent figurer dans la documentation de production |
| Conservation inutile | Nettoyage au démarrage puis chaque heure : sessions/liens expirés, compteurs périmés, journal sécurité/notifications/demandes commerciales à 180 jours, file email à 7 jours et push à 30 jours, demandes de droits closes après un an | Durées de dossiers, finances, documents, journal métier et sauvegardes à valider ; pas de purge aveugle des dossiers d'élèves |

Les utilisateurs disposent d'un écran **Sécurité & confidentialité** avec appareils, MFA, export personnel, demandes de droits et suivi. La direction peut renseigner le contact de l'école, le délégué, les finalités et durées ; répondre aux demandes et consulter le journal. Cocher « traitée » enregistre une réponse ; cela ne réalise pas automatiquement un effacement ou une rectification. Les mesures réellement effectuées doivent être indiquées.

## Cadre juridique vérifié

La loi algérienne **18-07**, modifiée par **25-11 (24 juillet 2025)**, doit être examinée dans sa version actuelle. L'amendement prévoit notamment le délégué et les registres/carnets ; les articles 44 et 45 encadrent les transferts hors d'Algérie. Le RGPD sert aussi de référence de protection ; son application juridique dépend de la situation de Brainfor, des écoles et des personnes concernées.

Sources officielles : [loi 18-07, JO n° 34](https://www.joradp.dz/FTP/jo-francais/2018/F2018034.pdf), [loi 25-11, JO n° 48](https://www.joradp.dz/FTP/jo-francais/2025/F2025048.pdf), [notice ANPDP](https://plaintes.anpdp.dz/notice.php), [RGPD](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX%3A32016R0679), [guide de sécurité CNIL](https://www.cnil.fr/sites/cnil/files/2024-03/cnil_guide_securite_personnelle_2024.pdf).

## Conditions avant de traiter de vrais dossiers

1. Confirmer l'identité juridique complète de Brainfor et des établissements ; compléter les mentions légales. Le nom et l'email fournis ne remplacent pas une immatriculation ou une adresse juridique.
2. Désigner le délégué/interlocuteur requis, vérifier les formalités ANPDP et tenir le registre du responsable ainsi que celui du sous-traitant. Le journal applicatif est une aide et ne constitue pas à lui seul l'ensemble des registres réglementaires.
3. Valider les fondements juridiques, l'information des mineurs/représentants légaux, les demandes de droits et les règles pour les justificatifs pouvant contenir des données de santé. Ne pas importer de telles données avant cette validation.
4. Signer les contrats écoles/Brainfor et prestataires, avec objet, accès, sous-traitants ultérieurs, assistance, incidents, restitution/effacement, audit et mesures de sécurité.
5. Valider les transferts. **Render Francfort est hors d'Algérie** : examiner les autorisations/conditions pertinentes, les prestataires et toute circulation ultérieure. Ne pas supposer qu'un datacenter européen règle toutes les obligations.
6. Définir les durées scolaires/comptables et les archives ; organiser un effacement effectif à échéance et dans les sauvegardes. Ne pas appliquer automatiquement des délais comptables français aux écoles algériennes.
7. Utiliser des comptes individuels, activer MFA pour tous les accès privilégiés, fournir un prestataire email et une procédure de récupération contrôlée, protéger GitHub/Render/DB avec MFA et accès minimaux. Aucun administrateur ne doit demander le code OTP d'un parent.
8. Mettre en place des sauvegardes chiffrées hors du serveur, avec clé distincte et accès limités, puis tester la restauration. **La base Free Render expire le 10 novembre 2026** dans cette installation : ce service de test n'offre pas le dispositif de continuité requis pour l'exploitation réelle.
9. Réaliser une analyse de risques, examiner la nécessité d'une analyse d'impact et effectuer un audit/pentest indépendant avant l'ouverture réelle. Prévoir veille des dépendances, correctifs, supervision et revue des droits.

## Clés et déploiement

`SECURITY_ENCRYPTION_KEY` doit être aléatoire, contenir au moins 32 caractères et rester côté serveur. Le Blueprint Render utilise `generateValue: true` (secret de 256 bits créé seulement s'il n'existe pas). `.env` local et secrets sont ignorés par Git. Ne jamais mettre cette clé dans une variable `NEXT_PUBLIC_*` ou `EXPO_PUBLIC_*`.

Sauvegarder la clé dans un coffre distinct de PostgreSQL. La perdre rend les secrets MFA indéchiffrables. Sa rotation nécessite de déchiffrer avec l'ancienne clé et rechiffrer avec la nouvelle pendant une opération contrôlée ; remplacer simplement la variable casserait les comptes MFA. Les codes de secours doivent être conservés par l'utilisateur hors de l'appareil.

La vérification des facteurs suit [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238) et les vecteurs publics sont testés. TOTP n'est pas une authentification résistante au phishing ; des passkeys et une protection réseau peuvent compléter ce socle selon les risques.

## Procédure d'incident

- Informer immédiatement l'interlocuteur de sécurité et le délégué ; relever heure de découverte, périmètre, comptes et données potentiellement concernés.
- Contenir : révoquer les sessions, suspendre les comptes affectés, fermer les accès exposés. Préserver les preuves avec accès restreint et horodatage ; ne pas partager une copie de dossiers dans des messages ordinaires.
- Évaluer avec le responsable les obligations de notification et l'information des familles. Si le RGPD s'applique, l'article 33 prévoit une notification à l'autorité dans les meilleurs délais et si possible sous 72 h, sauf exception liée à l'absence de risque ; l'information des personnes dépend notamment du risque élevé. Vérifier séparément les obligations algériennes applicables.
- Documenter décision, faits, mesures, notifications, restauration et prévention. Les contacts/analyse doivent exister avant l'incident ; la plateforme n'envoie pas automatiquement de déclaration à une autorité.

Référence : [CNIL — notifier une violation](https://www.cnil.fr/fr/services-en-ligne/notifier-une-violation-de-donnees-personnelles).

## Vérifications effectuées

Tests sur PostgreSQL réel : MFA et codes de secours à usage unique, chiffrement authentifié, cookie/anti-CSRF, session inactive, confirmation récente et révocation, export limité à l'enfant lié, demandes inter-écoles refusées, compteur persistant, JSON malformé/volume excessif, purge de traces sans suppression du dossier scolaire. Tests HTTP Next.js : nonce renouvelé et appliqué aux scripts, cache privé désactivé et en-têtes de protection. TypeScript et builds web/API vérifiés.

Ces contrôles ne sont ni une preuve d'absence de vulnérabilité ni une certification. Les tests de charge, de reprise, de compromission du fournisseur et l'audit indépendant ne sont pas remplacés par cette suite.

## Dépendances mobiles à surveiller

Au 12 octobre 2026, l'audit npm ciblé API/web/shared ne signale aucune vulnérabilité. L'arbre Expo/Metro mobile conserve deux avis de base sans version corrigée publiée : `braces@3.0.3` ([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)) et `node-forge@1.4.0` ([GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv)). npm les propage à quinze entrées de dépendances de sévérité élevée. Les dernières versions du registre npm ont été vérifiées ; les rétrogradations proposées vers Expo 44/React Native 0.72 ne constituent pas une correction compatible avec cette application.

Les chemins observés passent par CLI/certificats Expo et Metro/micromatch. Aucun serveur Metro ni service de signature mobile n'est publié sur Render ; le site est construit uniquement avec les workspaces API/web/shared. Les constructions mobiles doivent rester sur un environnement isolé, avec sources et motifs de fichiers maîtrisés, sans exposition publique du serveur de développement. Revoir les avis et intégrer les correctifs compatibles avant une publication mobile de production. Cette limitation est conservée dans le rapport, pas supprimée de l'audit.
