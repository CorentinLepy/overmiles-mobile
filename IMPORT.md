# Import du bootstrap COR-54

## Option A — bundle Git recommandé

```bash
git clone overmiles-mobile-cor-54.bundle overmiles-mobile
cd overmiles-mobile
git switch main
git remote add origin git@github.com:CorentinLepy/overmiles-mobile.git
git push -u origin main
git push origin cor-54-m05-bootstrapper-overmiles-mobile
```

## Option B — archive ZIP

1. Extraire l’archive.
2. Créer le dépôt privé `CorentinLepy/overmiles-mobile`.
3. Initialiser Git et pousser `main`.

## Première installation connectée

```bash
corepack enable
corepack prepare pnpm@11.20.0 --activate
pnpm install
pnpm verify
pnpm doctor
```

Committer ensuite le `pnpm-lock.yaml` généré et initialiser EAS avec `npx eas-cli@latest init`.
