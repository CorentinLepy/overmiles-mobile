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

Le premier build EAS Android development a été lancé le 21 août 2026 :

- build ID : `79f78419-4835-495d-8c6f-0afae527ed84` ;
- profil : `development` ;
- distribution : `internal` ;
- channel : `development` ;
- runtimeVersion : `0.1.0` ;
- versionCode : `1` ;
- commit de référence affiché par EAS : `28efe6c` ;
- statut au dernier contrôle utilisateur : `in progress`.

Le build a été archivé depuis le working tree contenant la configuration `expo-updates`; cette configuration est désormais aussi versionnée sur la branche COR-54 dans le commit `3c3f150`.

## Reste avant merge de COR-54

1. attendre la fin du build Android development ;
2. installer l’APK sur un appareil Android physique ;
3. démarrer Metro avec `pnpm dev` ;
4. connecter le development client ;
5. effectuer le smoke test : lancement, connexion Metro, affichage de l’écran technique, absence de crash ;
6. mettre la PR prête à review puis merger si le smoke test est vert.

Les builds iOS/TestFlight et la publication stores sont traités dans le chantier release mobile dédié et ne bloquent pas ce bootstrap Android initial.
