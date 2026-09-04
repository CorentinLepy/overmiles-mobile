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

La connexion utilise exclusivement le transport centralisé COR-55. Le formulaire ne réalise aucun `fetch` direct et l’Access Token reste mémoire-only. La déconnexion invalide d’abord durablement la session locale puis tente la révocation serveur en best effort avec l’Access Token déjà présent en mémoire ; l’attente réseau ne peut jamais retarder le retour local à un état déconnecté.

Google et Apple restent gérés par le chantier SSO dédié ; COR-135 ne simule aucun fournisseur externe.

## Logout local-first et crash-safe — COR-253

Un tap explicite sur **Se déconnecter** est une frontière de sécurité locale. Dès cette action, l’ancienne session doit devenir irrécupérable, même si le réseau est absent, si la révocation serveur est lente ou si le processus est interrompu juste après.

Le client applique donc les invariants suivants :

1. l’Access Token courant est capturé uniquement s’il existe déjà en mémoire ;
2. la génération de session et les écritures locales sont invalidées immédiatement ;
3. un tombstone de logout est persisté **synchroniquement dans SecureStore avant la première attente asynchrone** afin qu’un kill process juste après le tap échoue du côté sûr ;
4. le Refresh Token est supprimé localement ;
5. `restore()` refuse toute restauration tant que le tombstone est présent et retente le nettoyage du Refresh Token si nécessaire ;
6. les mutations de credentials sont sérialisées pour empêcher un refresh en vol de réécrire un token après le logout ;
7. la révocation distante est ensuite tentée en best effort avec l’Access Token déjà capturé, sans refresh supplémentaire uniquement pour obtenir un token de révocation ;
8. `AuthProvider` enchaîne immédiatement avec la purge SQLCipher / média privé et le retour UI `anonymous`.

Le tombstone n’est effacé qu’après une **nouvelle authentification explicite réussie** et la persistance de son nouveau Refresh Token. Ainsi, une interruption pendant un logout ou pendant une réauthentification échoue du côté sûr : un prochain démarrage demande une nouvelle connexion au lieu de ressusciter l’ancienne session.

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

## Validation automatisée COR-135 / COR-176 / COR-253

La CI doit notamment garantir :

- installation figée avec politique supply-chain ;
- TypeScript strict ;
- ESLint sans warning ;
- absence de stockage persistant de l’Access Token ;
- absence de `fetch` direct dans les écrans d’authentification ;
- le chemin `mfaRequired` ne passe jamais par `acceptSession` ;
- le challenge MFA reste mémoire-only ;
- la session n’est acceptée qu’après la réponse authentifiée de `/auth/mobile/login/mfa` ;
- le tombstone de logout production est écrit synchroniquement avant que le nettoyage asynchrone des credentials puisse suspendre ;
- un logout local termine sans attendre une révocation distante bloquée ;
- un refresh en vol ne peut pas réécrire un Refresh Token après invalidation ;
- un cold start avec tombstone retourne `anonymous` sans tenter de restaurer l’ancienne session.

## Appareils connectés

COR-52 prépare la liste des sessions et la révocation fine. Le client doit considérer le serveur comme autoritaire : une session absente, expirée ou révoquée force le retour à l’authentification.
