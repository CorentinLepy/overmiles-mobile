# Baseline sécurité

## Secrets

- Aucun secret dans Git, `app.json`, `.env.example` ou `EXPO_PUBLIC_*`.
- Credentials EAS/Apple/Google gérés hors dépôt.
- Les fichiers de signature et configurations Firebase natives sont ignorés par Git.

## Réseau

- HTTPS obligatoire hors hôtes locaux de développement explicitement autorisés.
- Aucun bypass TLS.
- Timeouts, erreurs typées, limitation des retries et redaction des logs seront centralisés dans COR-55.
- Aucun header Authorization ou token ne doit apparaître dans les logs.

## Stockage

- AsyncStorage interdit pour le Refresh Token et toute donnée sensible.
- Keychain/Keystore via une abstraction dédiée pour les secrets.
- SQLite chiffrée et clé native protégée prévues dans COR-56.

## Appareil

- Le verrou biométrique local de COR-58 protège l’accès local mais ne remplace jamais l’authentification serveur.
- Tout changement biométrique ou invalidation de clé déclenche une réauthentification complète.
