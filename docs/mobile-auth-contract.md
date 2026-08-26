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
- `offline_auth_pending` → le credential local n’est pas détruit et l’utilisateur peut relancer la vérification lorsque le réseau revient.

La connexion utilise exclusivement le transport centralisé COR-55. Le formulaire ne réalise aucun `fetch` direct et l’Access Token reste mémoire-only. La déconnexion appelle la révocation serveur puis efface les credentials locaux même si le serveur devient indisponible pendant l’opération.

Google et Apple restent gérés par le chantier SSO dédié ; COR-135 ne simule aucun fournisseur externe.

## Appareils connectés

COR-52 prépare la liste des sessions et la révocation fine. Le client doit considérer le serveur comme autoritaire : une session absente, expirée ou révoquée force le retour à l’authentification.
