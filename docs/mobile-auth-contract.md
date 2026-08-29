# Contrat d’authentification mobile

## État serveur déjà préparé

Le backend accepte les Access Tokens Bearer courts, liés à une session serveur. Le mobile n’utilise pas le cookie Web comme mécanisme de session.

## Cible COR-55

- Access Token court conservé uniquement en mémoire ;
- Refresh Token opaque et rotatif stocké dans Keychain/Keystore ;
- rotation sérialisée côté client ;
- révocation serveur par session/appareil ;
- détection de réutilisation d’un ancien Refresh Token ;
- effacement atomique de la session locale en cas de révocation ou de famille compromise ;
- aucune persistance des tokens dans AsyncStorage, logs, crash reports ou analytics.

## Parcours client COR-135

Au démarrage, `AuthProvider` tente une restauration via le Refresh Token SecureStore. Pendant cette vérification, l’application affiche un état de restauration dédié et ne rend pas les tabs métier accessibles.

Les états sont explicites :

- `authenticated` → accès à l’AppShell ;
- `anonymous` → écran de connexion ;
- `mfa_required` → mot de passe validé mais aucun token de session n’a encore été émis ;
- `offline_auth_pending` → le credential local n’est pas détruit et l’utilisateur peut relancer la vérification lorsque le réseau revient.

La connexion utilise exclusivement le transport centralisé COR-55. Le formulaire ne réalise aucun `fetch` direct et l’Access Token reste mémoire-only. La déconnexion appelle la révocation serveur puis efface les credentials locaux même si le serveur devient indisponible pendant l’opération.

Google et Apple restent gérés par le chantier SSO dédié ; COR-135 ne simule aucun fournisseur externe.

## MFA mobile — COR-176

Le MFA utilisateur V1 reste **TOTP + codes de récupération** et réutilise le moteur MFA serveur existant. Le mobile ne possède aucune implémentation cryptographique TOTP locale.

Le contrat de connexion est désormais en deux branches :

1. compte sans MFA : `POST /auth/mobile/login` retourne directement la session mobile ;
2. compte avec MFA : `POST /auth/mobile/login` retourne uniquement `mfaRequired=true`, un `challengeId` opaque et son expiration.

Dans le second cas :

- aucun Access Token n’est créé côté client ;
- aucun Refresh Token n’est reçu ou stocké ;
- le challenge reste uniquement en mémoire ;
- l’utilisateur valide un TOTP ou un code de récupération via `POST /auth/mobile/login/mfa` ;
- le backend consomme le challenge à usage unique et n’émet la session mobile qu’après validation du facteur ;
- le Refresh Token final est ensuite stocké dans SecureStore avant que le nouvel Access Token soit exposé par `AuthSessionManager`.

Un challenge expiré ou déjà consommé impose de recommencer la connexion par mot de passe. Un mauvais code ne doit jamais produire de token. Les valeurs MFA et les challenges ne doivent pas être journalisés.

## Validation automatisée COR-135 / COR-176

La CI doit notamment garantir :

- installation figée avec politique supply-chain ;
- TypeScript strict ;
- ESLint sans warning ;
- absence de stockage persistant de l’Access Token ;
- absence de `fetch` direct dans les écrans d’authentification ;
- le chemin `mfaRequired` ne passe jamais par `acceptSession` ;
- le challenge MFA reste mémoire-only ;
- la session n’est acceptée qu’après la réponse authentifiée de `/auth/mobile/login/mfa`.

## Appareils connectés

COR-52 prépare la liste des sessions et la révocation fine. Le client doit considérer le serveur comme autoritaire : une session absente, expirée ou révoquée force le retour à l’authentification.
