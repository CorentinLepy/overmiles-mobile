# Instructions agents — OVERMILES Mobile

Ce dépôt est un projet produit actif. Ne pas repartir du bootstrap historique ni recréer des abstractions déjà stabilisées.

## Architecture

- Expo Router est le routeur unique ; ne pas installer de navigation parallèle.
- Le backend OVERMILES reste la source de vérité métier.
- Les écrans métier consomment les helpers/repositories/providers centraux ; pas de `fetch` ou client réseau parallèle dans les écrans.
- MapLibre est le renderer cartographique natif et OpenFreeMap le fond configurable ; aucun WebView de la carte Web.
- Ne pas ajouter de GPS/live location sans ticket et permissions explicitement validés.

## Auth et secrets

- Access Token : mémoire uniquement.
- Refresh Token : SecureStore device-bound uniquement.
- MFA : aucun token de session avant validation du second facteur ; challenge pré-auth uniquement en mémoire.
- AsyncStorage/localStorage interdits pour credentials, clés ou secrets.
- Ne jamais journaliser Authorization, cookies, access/refresh tokens, mots de passe, codes MFA, recovery codes ou secrets EAS.
- Aucun secret dans `EXPO_PUBLIC_*`, `app.json`, Git ou les exemples d’environnement.

## Offline / sync

- Les changements synchronisables respectent `version`, `updatedAt`, `updatedBy` et les politiques de conflit COR-53/COR-57.
- Aucun silent last-write-wins ni auto-merge métier sans règle explicitement validée.
- La clé SQLCipher, le Refresh Token et l’état biométrique restent séparés.
- La biométrie est un verrou local, jamais une authentification serveur de remplacement.

## Dépendances natives

Toute nouvelle dépendance native doit justifier son besoin, sa maintenance, ses permissions, sa compatibilité Expo/EAS et son impact iOS/Android. Utiliser un Development Build pour la validation ; Expo Go n’est pas une preuve suffisante pour les modules natifs.

## GitHub / CI

- Linear est la source de vérité des tickets ; une PR référence son `COR-xxx`.
- `main` est la cible d’intégration. Éviter les longues chaînes de PR stacked ; si elles sont nécessaires, documenter la base et fermer les PR superseded après consolidation.
- Une PR reste Draft tant qu’un gate runtime requis manque.
- Exécuter `pnpm verify` avant push et conserver `Mobile CI` verte sur le HEAD final.
- Ne pas resynchroniser une branche dormante uniquement pour la rendre « à jour » : cela crée du churn et consomme de la CI.
- Préférer un squash merge pour une tranche fonctionnelle consolidée.
- Ne jamais publier App Store / Google Play automatiquement : la release reste derrière un gate humain explicite.

Voir aussi `CONTRIBUTING.md` et `docs/github-workflow.md`.
