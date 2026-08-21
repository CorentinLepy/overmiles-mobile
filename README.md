# OVERMILES Mobile

Socle natif iOS/Android d’OVERMILES. Le backend de référence reste l’API OVERMILES ; ce dépôt ne duplique ni le code serveur ni ses secrets.

## Baseline

- Expo SDK 57 ;
- React Native 0.86.2 / React 19.2.3 ;
- Expo Router ;
- TypeScript strict ;
- Node.js 22.13 minimum ;
- pnpm 11.20.0 ;
- EAS Build avec profils `development`, `preview` et `production` séparés.

## Installation initiale

```bash
corepack enable
corepack prepare pnpm@11.20.0 --activate
pnpm install
cp .env.example .env.local
pnpm verify
pnpm dev
```

Le premier `pnpm install` doit générer puis faire committer `pnpm-lock.yaml`. Ensuite, la CI utilisera exclusivement `pnpm install --frozen-lockfile`.

## Variables publiques

`EXPO_PUBLIC_*` est lisible dans le bundle applicatif. Ne jamais y placer un token, une clé privée, un secret OAuth, un mot de passe ou un credential EAS.

```dotenv
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_API_BASE_URL=https://dev-api.example.invalid/api/v1
```

En production, la cible canonique est `https://overmiles.app/api/v1`.

## Commandes

| Commande | Rôle |
| --- | --- |
| `pnpm dev` | Démarrer Metro pour un development build |
| `pnpm structure:check` | Vérifier les chemins structurants du socle |
| `pnpm typecheck` | Vérifier TypeScript strict |
| `pnpm lint` | Lancer ESLint sans avertissement toléré |
| `pnpm test` | Vérifier les invariants du bootstrap |
| `pnpm format:check` | Vérifier le formatage |
| `pnpm security:check` | Détecter des motifs de secrets évidents |
| `pnpm verify` | Exécuter la baseline qualité complète |

## EAS

- `development` : development client, distribution interne, canal dédié ;
- `preview` : distribution interne et backend de test/staging uniquement ;
- `production` : canal production, version native auto-incrémentée, API canonique.

Avant le premier build :

```bash
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build --profile development --platform android
```

L’OTA production n’est jamais déclenchée automatiquement. Toute update doit rester compatible avec la `runtimeVersion` dérivée de la version applicative.

## Git et livraison

- dépôt cible privé : `CorentinLepy/overmiles-mobile` ;
- `main` reste stable ;
- branches `cor-XX-description` ;
- PR en Draft par défaut ;
- aucun écran métier dans COR-54 ;
- aucun submodule ou import direct depuis `Adventure-Hub` ;
- les contrats partagés passent par une API/version de schéma explicite.

Projet Linear : **OverMiles Mobile** — ticket bootstrap **COR-54**.

## Documentation

- [Architecture](docs/architecture.md)
- [Sécurité](docs/security.md)
- [Offline et synchronisation](docs/offline-sync.md)
- [Contrat auth mobile](docs/mobile-auth-contract.md)
- [État du bootstrap](docs/bootstrap-status.md)
- [Rapport de validation](docs/validation-report.md)
