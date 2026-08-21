# Offline-first et synchronisation

Le niveau hors-ligne cible couvre les fonctions terrain essentielles, sans créer une seconde source de vérité.

## Principes

- base locale chiffrée ;
- file d’opérations persistante ;
- opérations idempotentes ;
- reprise après coupure avec backoff borné ;
- états `pending`, `syncing`, `failed`, `conflict` ;
- aucune stratégie globale d’écrasement silencieux en last-write-wins.

## Métadonnées synchronisables

Les entités éligibles convergent vers :

```text
id
version
updatedAt
updatedBy
```

COR-53 définit les contrats serveur et les politiques par entité. COR-56 met en place la base locale. COR-57 implémente le moteur, la file et la résolution des conflits.
