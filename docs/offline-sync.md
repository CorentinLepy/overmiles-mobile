# Offline-first et synchronisation

Le niveau hors-ligne cible couvre les fonctions terrain essentielles, sans créer une seconde source de vérité.

## Principes

- base locale chiffrée ;
- file d’opérations persistante ;
- opérations idempotentes ;
- reprise après coupure avec backoff borné ;
- états `pending`, `sending`, `failed`, `conflict` ;
- aucune stratégie globale d’écrasement silencieux en last-write-wins.

## Stockage local COR-56

La fondation locale utilise `expo-sqlite ~57.0.1` avec SQLCipher dans un Development Build et `expo-crypto ~57.0.2` pour générer la clé locale. Ces versions restent sur la baseline Expo 57 ayant passé la politique d’âge minimum des dépendances ; les patches publiés trop récemment ne sont pas adoptés automatiquement.

La clé de base est générée aléatoirement et conservée dans SecureStore, séparément du Refresh Token. Les tables techniques `schema_migrations`, `sync_metadata`, `pending_operations` et `app_state` sont créées par migrations transactionnelles.

SQLCipher n’est pas validé avec Expo Go : le gate de sortie de COR-56 inclut un build natif Android et iOS, ainsi que les scénarios perte de clé, migration et reprise après redémarrage.

## Sync Engine COR-57

Chaque mutation locale est enregistrée avec un `operationId` unique, son `baseVersion`, une version de payload et son état durable. Seules les opérations `pending` arrivées à leur échéance de retry sont réémises. Le backoff exponentiel est borné et son prochain horaire est persisté pour survivre aux redémarrages.

Une opération restée `sending` après un crash est ramenée à `pending` avec le code `SYNC_INTERRUPTED`. Une erreur fatale reste `failed` et n’est jamais relancée automatiquement. Un conflit de version reste `conflict` : aucune résolution implicite n’est appliquée.

Après un succès serveur, la nouvelle version et les métadonnées de synchronisation sont écrites dans `sync_metadata` et l’opération est retirée de `pending_operations` dans une même transaction SQLite. Cela évite un état local incohérent si l’application est interrompue juste après l’accusé de réception serveur.

Le client API conserve également les détails structurés d’un `409 SYNC_VERSION_CONFLICT` (`expectedVersion`, `currentVersion`, `serverSnapshot`) afin que la future UX de résolution puisse prendre une décision explicite plutôt que parser un message texte.

## Métadonnées synchronisables

Les entités éligibles convergent vers :

```text
id
version
updatedAt
updatedBy
```

COR-53 définit les contrats serveur et les politiques par entité. COR-56 met en place la base locale. COR-57 implémente le moteur, la file et la résolution des conflits.
