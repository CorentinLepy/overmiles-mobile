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

## Appareils connectés

COR-52 prépare la liste des sessions et la révocation fine. Le client doit considérer le serveur comme autoritaire : une session absente, expirée ou révoquée force le retour à l’authentification.
