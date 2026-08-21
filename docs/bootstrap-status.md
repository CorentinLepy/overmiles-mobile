# État COR-54

## Validé dans ce lot

- dépôt privé `CorentinLepy/overmiles-mobile` créé ;
- branches `main` et `cor-54-m05-bootstrapper-overmiles-mobile` poussées ;
- baseline Expo SDK 57 / React Native 0.86.2 ;
- Expo Router et écran technique minimal ;
- TypeScript strict ;
- structure auth/API/storage/sync ;
- profils EAS séparés ;
- règles de secrets et environnements publics ;
- scripts lint, test, format, structure et sécurité agrégés par `pnpm verify` ;
- documentation architecture, sécurité, auth et offline ;
- assets techniques provisoires ;
- dépendances réellement installées ;
- `pnpm-lock.yaml` versionné ;
- politique de build pnpm explicite avec `unrs-resolver: false` ;
- `pnpm run verify` réussi ;
- `npx expo install --check` réussi ;
- Expo Doctor : **21/21** ;
- Draft PR COR-54 ouverte.

## Reste à faire avant merge

1. relier le dépôt au projet Expo/EAS avec `eas init` ;
2. revoir et committer uniquement les changements EAS attendus ;
3. créer un development build Android ;
4. installer le build sur un appareil Android et effectuer un smoke test ;
5. lancer Metro avec le development client ;
6. finaliser la revue de PR puis merger COR-54.

Les warnings transitifs remontés par `pnpm peers check` restent suivis mais ne bloquent pas COR-54 tant que `expo install --check` et Expo Doctor restent verts.
