# COR-56 — Validation stockage local chiffré

## État CI

La branche COR-56 conserve la baseline Expo 57 déjà admise par la politique supply-chain et ajoute uniquement les dépendances nécessaires au stockage local :

- `expo-crypto ~57.0.2` ;
- `expo-sqlite ~57.0.1` ;
- SQLCipher activé via le config plugin `useSQLCipher`.

Le `pnpm-lock.yaml` a été régénéré sur runner GitHub à partir de cette baseline sans exécuter d’auto-upgrade Expo. Les validations normales utilisent à nouveau `pnpm install --frozen-lockfile` avec une CI `contents: read`.

## Invariants automatisés

Les tests COR-56 contrôlent notamment :

- clé aléatoire de 32 octets ;
- stockage de la clé dans un service SecureStore distinct de l’auth ;
- `WHEN_UNLOCKED_THIS_DEVICE_ONLY` ;
- application de `PRAGMA key` avant toute lecture du schéma ;
- absence de log de clé ;
- migrations transactionnelles ;
- tables `schema_migrations`, `sync_metadata`, `pending_operations`, `app_state` ;
- valeurs de migration bindées ;
- purge conjointe DB + clé.

## Gates natifs encore requis

COR-56 reste Draft tant que les validations suivantes ne sont pas faites dans un Development Build :

- Android : ouverture SQLCipher, WAL, persistance après restart et perte de clé ;
- iOS : mêmes scénarios ;
- DB illisible sans clé ;
- migration N-1 vers N ;
- opération offline durable après crash/restart ;
- isolation/purge lors d’un logout, d’une révocation ou d’un changement de compte.

Expo Go ne peut pas constituer une preuve pour SQLCipher.
