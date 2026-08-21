# État COR-54

## Préparé dans ce lot

- baseline Expo SDK 57 / React Native 0.86.2 ;
- Expo Router et écran technique minimal ;
- TypeScript strict ;
- structure auth/API/storage/sync ;
- profils EAS séparés ;
- règles de secrets et environnements publics ;
- scripts lint, test, format, structure et sécurité, agrégés par `pnpm verify` ;
- documentation architecture, sécurité, auth et offline ;
- assets techniques provisoires.

## À exécuter dès création du dépôt privé

1. créer `CorentinLepy/overmiles-mobile` en privé ;
2. importer ce dépôt ou cloner le bundle fourni ;
3. lancer `corepack enable && pnpm install` avec accès au registre ;
4. committer `pnpm-lock.yaml` ;
5. lancer `pnpm verify` et `pnpm doctor` ;
6. initialiser le projet EAS et injecter son `projectId` ;
7. ouvrir la PR Draft COR-54 puis activer les protections de branche dans COR-59.

Le lockfile, l’installation réelle des dépendances et les builds natifs ne sont pas revendiqués dans cet artefact hors ligne. Les contrôles exécutés sont consignés dans `docs/validation-report.md`.
