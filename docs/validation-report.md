# Rapport de validation COR-54

Date : 21 août 2026.

## Contrôles connectés exécutés

- `pnpm install` : **réussi** ;
- `pnpm run verify` : **réussi** ;
- vérification des chemins structurants : **13/13 réussis** ;
- TypeScript strict : **réussi** ;
- ESLint : **réussi** ;
- tests Node : **4/4 réussis** ;
- Prettier : **réussi** ;
- analyse simple de motifs de secrets : **réussie** ;
- `npx expo install --check` : **Dependencies are up to date** ;
- Expo Doctor : **21/21 checks passed** ;
- `git diff --check` : **réussi**.

## Dépendances et politique de build

- lockfile pnpm : versionné ;
- `unrs-resolver` : script de build explicitement refusé via `allowBuilds: false` ;
- le lint et les validations Expo fonctionnent sans exécuter ce postinstall ;
- `pnpm peers check` signale trois avertissements transitifs (`react-native-worklets`, `@react-native/metro-config`, `react-dom`) qui ne sont pas remontés comme incompatibilités par `expo install --check` ni Expo Doctor.

## Expo / EAS

- compte : `corentinlpc` ;
- projet : `@corentinlpc/overmiles-mobile` ;
- project ID : `2361a89e-a0e0-446b-be67-0e7f60bfee4d` ;
- `expo-updates@~57.0.16` installé et versionné ;
- `updates.url` configurée vers le projet EAS ;
- channel `development` créé ;
- Android `versionCode` initialisé à `1` ;
- keystore Android généré dans le cloud et géré par EAS.

## Build natif

Premier build Android development lancé :

- build ID : `79f78419-4835-495d-8c6f-0afae527ed84` ;
- profil : `development` ;
- distribution : `internal` ;
- runtimeVersion : `0.1.0` ;
- statut au dernier contrôle : **in progress**.

Le build n’est pas encore considéré validé tant que l’APK n’a pas été généré, installé sur un appareil physique et smoke-testé avec Metro.

## À terminer

1. attendre la fin du build Android ;
2. installer l’APK sur un appareil physique ;
3. lancer `pnpm dev` ;
4. connecter le development client à Metro ;
5. confirmer lancement sans crash et affichage de l’écran technique OVERMILES.
