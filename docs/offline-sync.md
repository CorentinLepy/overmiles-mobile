# Offline-first et synchronisation

Le niveau hors-ligne cible couvre les fonctions terrain essentielles, sans créer une seconde source de vérité.

## Principes

- base locale chiffrée ;
- file d’opérations persistante ;
- opérations idempotentes ;
- reprise après coupure avec backoff borné ;
- états `pending`, `syncing`, `failed`, `conflict` ;
- aucune stratégie globale d’écrasement silencieux en last-write-wins.

## Stockage local COR-56

La fondation locale utilise `expo-sqlite` avec SQLCipher dans un Development Build. La clé de base est générée aléatoirement et conservée dans SecureStore, séparément du Refresh Token. Les tables techniques `schema_migrations`, `sync_metadata`, `pending_operations` et `app_state` sont créées par migrations transactionnelles.

SQLCipher n’est pas validé avec Expo Go : le gate de sortie de COR-56 inclut un build natif Android et iOS, ainsi que les scénarios perte de clé, migration et reprise après redémarrage.

## Métadonnées synchronisables

Les entités éligibles convergent vers :

```text
id
version
updatedAt
updatedBy
```

COR-53 définit les contrats serveur et les politiques par entité. COR-56 met en place la base locale. COR-57 implémente le moteur, la file et la résolution des conflits.
