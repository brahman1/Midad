# Test gratuit sur Render

Instance vérifiée le 11 octobre 2026 : https://midad-test-brahman1.onrender.com. Dépôt : https://github.com/brahman1/Midad. Le service web et PostgreSQL sont sur Free ; la base actuelle expire le 10 novembre 2026. Le mot de passe distinct est fourni à l'utilisateur séparément et reste absent de Git. Captures et rapport de vérification dans `verification/`.

Le fichier `render.yaml` crée uniquement un service web Node gratuit (Next.js + API sur boucle locale) et une base PostgreSQL gratuite à Francfort. L'API conserve les cookies sécurisés HTTPS et les contrôles d'origine. Le site utilise `/api` sur le même domaine. Les migrations s'appliquent au démarrage.

Créer un Blueprint depuis ce dépôt, choisir `main`, puis renseigner `MIDAD_DEMO_PASSWORD` avec un mot de passe de test distinct d'au moins 20 caractères. Aucun secret dans Git. Les jeux fictifs sont activés explicitement pour cette instance de test, sur une base dédiée, et initialisés une seule fois. Établissement : `midad-local`, direction : `direction@midad.test` ; autres rôles identiques au test local.

Le service dort après 15 minutes d'inactivité ; le réveil peut prendre une minute. La base gratuite expire après 30 jours, sans sauvegardes gratuites. Les quotas sont partagés avec les autres services du compte. Ne pas activer de plan payant, disque, réplica ou upgrade. Aucun envoi SMTP configuré : utiliser les comptes de test déjà vérifiés ; inscription, récupération de mot de passe et envoi de mails attendent un fournisseur mail.

Les déploiements automatiques sont désactivés pour maîtriser les minutes de compilation. Pour garantir l'absence de dépassement facturé, ne pas ajouter de moyen de paiement et conserver une limite de dépenses de compilation à zéro si un moyen de paiement existe déjà.

Documentation officielle : https://render.com/docs/free
