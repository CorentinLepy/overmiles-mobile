# État COR-54

## Fondations en place

- dépôt privé `CorentinLepy/overmiles-mobile` créé et branché sur GitHub ;
- baseline Expo SDK 57 / React Native 0.86.2 / React 19.2.3 ;
- Expo Router et écran technique minimal ;
- TypeScript strict ;
- structure auth/API/storage/sync ;
- profils EAS `development`, `preview` et `production` séparés ;
- projet EAS `@corentinlpc/overmiles-mobile` lié ;
- `expo-updates` configuré avec le projet EAS et les channels ;
- Android `versionCode` initialisé à 1 ;
- keystore Android généré et géré côté EAS ;
- règles de secrets et environnements publics ;
- lockfile pnpm versionné ;
- politique de build pnpm explicite (`unrs-resolver: false`) ;
- scripts lint, test, format, structure et sécurité agrégés par `pnpm verify` ;
- documentation architecture, sécurité, auth et offline ;
- assets techniques provisoires.

## Validations connectées réussies

- `pnpm install` : réussi ;
- `pnpm run verify` : réussi ;
- tests Node : 4/4 ;
- `npx expo install --check` : dépendances à jour ;
- Expo Doctor : 21/21 ;
- `git diff --check` : réussi ;
- aucun secret évident détecté.

## Build Android development

Le premier build EAS Android development a été terminé avec succès le 21 août 2026 :

- build ID : `79f78419-4835-495d-8c6f-0afae527ed84` ;
- profil : `development` ;
- distribution : `internal` ;
- channel : `development` ;
- runtimeVersion : `0.1.0` ;
- versionCode : `1` ;
- fingerprint : `cee079712e0ad98baaffb66bb5c2449b978ec5ce` ;
- statut EAS : `finished`.

Le build a été archivé depuis le working tree contenant la configuration `expo-updates`; cette configuration est également versionnée sur la branche COR-54 dans le commit `3c3f150`.

## Smoke test Android physique

Le smoke test a été exécuté avec succès sur un appareil Android physique :

- APK installé ;
- development client OVERMILES lancé ;
- Metro démarré via `pnpm dev` ;
- connexion au serveur de développement réussie via tunnel Expo après échec du LAN direct ;
- bundle JavaScript chargé ;
- écran technique OVERMILES `Bootstrap v0.1.0` affiché ;
- environnement `development` visible ;
- Expo SDK 57 / React Native 0.86 / Expo Router / TypeScript strict visibles ;
- aucun crash observé.

## État de merge

Les critères techniques prévus pour COR-54 sont satisfaits côté bootstrap Android. Il reste uniquement la revue finale de la PR avant merge.

Les builds iOS/TestFlight et la publication stores sont traités dans le chantier release mobile dédié et ne bloquent pas ce bootstrap Android initial.
