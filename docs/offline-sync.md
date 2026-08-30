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

## Politique de stockage local du compagnon

COR-212 sépare explicitement les données locales selon leur capacité à être récupérées ailleurs. Cette distinction doit rester centrale lorsque les médias distants, documents et régions MapLibre seront préchargés.

### Données privées non réhydratables

Une capture terrain non synchronisée, un brouillon Carnet ou un brouillon Moment peut être la seule copie existante du contenu utilisateur. Ces données ne sont donc **jamais candidates à une éviction automatique**. Une pression disque doit bloquer ou réduire le nouveau préchargement avant de toucher à ces données.

### Données métier durables

Les snapshots SQLCipher nécessaires au compagnon offline restent gérés par leur cycle de vie account/trip scoped. Ils ne deviennent pas un cache jetable par simple changement d’état UI. Leur purge reste explicite, notamment lors d’un logout ou d’une invalidation de session selon les règles de sécurité existantes.

### Cache réhydratable

Un artefact téléchargé qui peut être récupéré à nouveau depuis sa source canonique peut être classé `rehydratable_cache`. Seule cette classe pourra alimenter un futur mécanisme d’éviction automatique.

La priorité de conservation est :

1. voyage en cours ;
2. prochain voyage ;
3. voyage récent explicitement préparé ;
4. historique ancien.

La première tranche COR-212 ne supprime aucun fichier. Elle fournit uniquement une politique déterministe `keep / evictable / stop_prefetch`. Les seuils de réserve disque et de budget de cache sont des paramètres explicites de politique. Ils ne doivent pas être disséminés sous forme de constantes cachées dans les features médias, documents ou carte.

## Inventaire des caches réhydratables

COR-213 introduit une table SQLCipher dédiée `rehydratable_cache_inventory`. Elle sert uniquement à décrire des artefacts qu’OverMiles sait récupérer à nouveau depuis une source canonique : médias distants, documents téléchargés et futures régions cartographiques.

Chaque entrée est account-scoped et possède un identifiant stable, un type, une clé de stockage relative détenue par OverMiles, une taille, une date de dernier accès et un `sourceFingerprint` opaque. Le fingerprint doit représenter une version ou une empreinte de la source ; il ne doit jamais contenir une URL signée, un token ou un secret.

Les captures terrain `local_only`, brouillons Carnet et brouillons Moment restent dans leurs tables privées dédiées et ne sont jamais inscrits implicitement dans cet inventaire.

L’inventaire permet de calculer le volume total de cache réhydratable par compte et de fournir les métadonnées nécessaires à la politique COR-212. COR-213 ne supprime toujours aucun fichier physique : une future tranche devra d’abord associer de façon explicite l’inventaire à un gestionnaire de cache propriétaire, mesurer la pression disque réelle et tester le cycle suppression → réhydratation avant d’activer une éviction automatique.
