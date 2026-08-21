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

## Build natif Android

Premier build Android development terminé avec succès :

- build ID : `79f78419-4835-495d-8c6f-0afae527ed84` ;
- profil : `development` ;
- distribution : `internal` ;
- runtimeVersion : `0.1.0` ;
- fingerprint : `cee079712e0ad98baaffb66bb5c2449b978ec5ce` ;
- statut : **finished**.

## Smoke test sur appareil physique

Validation réussie sur un appareil Android physique :

- installation de l'APK : **réussie** ;
- lancement du development client OVERMILES : **réussi** ;
- démarrage de Metro via `pnpm dev` : **réussi** ;
- connexion Metro : **réussie via tunnel Expo** ;
- chargement du bundle JavaScript : **réussi** ;
- affichage de l'écran technique OVERMILES `Bootstrap v0.1.0` : **réussi** ;
- absence de crash pendant le smoke test : **confirmée**.

La tentative initiale de connexion LAN directe à `192.168.1.112:8081` a échoué au niveau réseau ; le passage par le tunnel Expo a permis de valider le client et le bootstrap. Ce point n'indique pas une défaillance applicative COR-54. Le composant ngrok utilisé pour ce tunnel reste un outil local et n'est pas ajouté comme dépendance applicative.

## Revue finale de PR

La revue finale du diff n'a relevé aucun blocage de périmètre COR-54. Aucun statut CI GitHub n'est encore attaché à la branche ; la mise en place CI complète est volontairement suivie dans COR-59.

## Verdict

**COR-54 est techniquement validé pour son périmètre de bootstrap Android et prêt à merger.**

Les validations iOS/TestFlight et la publication App Store / Google Play sont suivies dans le chantier release mobile dédié et ne bloquent pas le merge de ce bootstrap initial.
