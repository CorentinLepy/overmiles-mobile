# Instructions agents — OVERMILES Mobile

- Ne pas créer d’écran métier dans COR-54.
- Expo Router est le routeur unique ; ne pas installer une navigation parallèle.
- L’Access Token reste en mémoire ; le Refresh Token sera stocké via Keychain/Keystore dans COR-55.
- AsyncStorage est interdit pour les secrets.
- Le backend OVERMILES est la source de vérité.
- Les changements offline respectent `version`, `updatedAt`, `updatedBy` et les politiques de conflit définies par COR-53/COR-57.
- Ne jamais journaliser Authorization, cookies, refresh tokens, données MFA ou secrets EAS.
- Toute nouvelle dépendance native doit justifier son besoin, sa maintenance, ses permissions et son impact EAS.
