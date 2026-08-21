# Architecture mobile OVERMILES

## Décision

Le mobile vit dans un dépôt privé séparé du monorepo Web/API. Il consomme une API versionnée et n’importe jamais directement les sources Prisma, NestJS ou Next.js.

## Couches

```text
app/                    routes Expo Router
src/components/ui/      primitives visuelles réutilisables
src/features/           verticales métier futures
src/lib/api/            réseau centralisé (COR-55)
src/lib/auth/           session et stockage sécurisé (COR-55)
src/lib/storage/        SQLite chiffrée (COR-56)
src/lib/sync/           file offline et conflits (COR-57)
src/providers/          composition applicative
src/theme/              tokens et thèmes
```

Les dépendances vont des features vers des contrats `src/lib`, jamais l’inverse. Le backend OVERMILES demeure la source de vérité.

## Runtime et livraison

`runtimeVersion` suit la version applicative. Une modification native impose un nouveau binaire. Les canaux EAS development, preview et production sont isolés. Aucune OTA production ne part sans gate explicite.
