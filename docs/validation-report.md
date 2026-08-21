# Rapport de validation COR-54

Date : 21 août 2026.

## Contrôles connectés exécutés

- installation réelle des dépendances avec pnpm 11.20.0 : **réussie** ;
- `pnpm-lock.yaml` généré et versionné ;
- politique de build pnpm explicite : `unrs-resolver: false` ;
- `pnpm run verify` : **réussi** ;
  - structure : **13/13** ;
  - TypeScript : **réussi** ;
  - ESLint : **réussi** ;
  - tests Node : **4/4 réussis** ;
  - Prettier : **réussi** ;
  - scan simple de motifs de secrets : **réussi** ;
- `npx expo install --check` : **Dependencies are up to date** ;
- `pnpm run doctor` : **21/21 checks passed** ;
- `git diff --check` : **réussi**.

## Warnings de peer dependencies

`pnpm peers check` signale encore trois warnings transitifs :

- `react-native-worklets` ;
- `@react-native/metro-config` ;
- `react-dom`.

Ils ne sont pas considérés comme bloquants pour COR-54 : Expo valide l’ensemble des dépendances et Expo Doctor ne remonte aucun problème. Ils restent à surveiller dans le chantier CI / durcissement des dépendances COR-59 plutôt que d’ajouter des dépendances directes non nécessaires au bootstrap.

## Contrôles restant à exécuter

1. relier le dépôt au projet Expo/EAS ;
2. vérifier les modifications générées par `eas init` ;
3. créer un development build Android ;
4. installer et tester ce build sur un appareil Android ;
5. lancer Metro avec le development client ;
6. préparer ensuite la validation iOS dans un lot adapté.

Aucun build Android/iOS réussi n’est revendiqué tant qu’il n’a pas effectivement été généré et installé.
