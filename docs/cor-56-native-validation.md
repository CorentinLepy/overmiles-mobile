# COR-56 — Validation native SQLCipher

Cette checklist couvre les gates appareil de la base locale chiffrée OverMiles. Elle doit être exécutée dans un **Development Build** iOS et Android : Expo Go n’est pas un environnement valide pour SQLCipher.

## Préconditions

- branche `cor-56-offline-storage-foundation` ;
- `pnpm install --frozen-lockfile` réussi ;
- `pnpm verify` réussi ;
- build natif contenant le config plugin `expo-sqlite` avec `useSQLCipher: true` ;
- aucun secret, token ou contenu de clé ajouté aux logs de debug.

## 1. Installation propre

1. Installer le Development Build sur un appareil sans données OverMiles existantes.
2. Ouvrir l’application.
3. Vérifier qu’aucune erreur SQLCipher/SQLite n’apparaît au démarrage.
4. Vérifier que les migrations locales sont appliquées une seule fois.
5. Tuer complètement l’application puis la relancer.

**Attendu** : la même base chiffrée se rouvre avec la clé SecureStore existante, sans recréation ni perte silencieuse.

## 2. Persistance après redémarrage

1. Écrire une donnée de test non sensible dans une table technique/local-first prévue pour la validation.
2. Fermer l’application depuis le sélecteur système.
3. Relancer l’application.

**Attendu** : la donnée est toujours présente et la base ne repasse pas par une initialisation destructive.

## 3. Base inutilisable sans sa clé

Le test doit être réalisé avec un outil/dev hook contrôlé, jamais en journalisant la clé.

1. Créer une base locale valide et fermer proprement la connexion.
2. Supprimer uniquement l’entrée SecureStore `overmiles.storage.database-key.v1`, sans supprimer le fichier de base.
3. Relancer l’ouverture de `LocalDatabase`.

**Attendu** : l’ancienne base n’est jamais réutilisée avec une nouvelle clé. Elle est considérée cryptographiquement irrécupérable, supprimée puis recréée proprement. Aucune donnée chiffrée ancienne ne doit être exposée.

## 4. Purge sécurisée

1. Ouvrir la base puis déclencher `LocalDatabase.purge()` dans le scénario de test.
2. Vérifier la fermeture de la connexion.
3. Vérifier la suppression de la base.
4. Vérifier la suppression de la clé SecureStore même si la suppression de la base retourne une erreur simulée.
5. Ouvrir de nouveau la base.

**Attendu** : une nouvelle clé aléatoire est générée et une nouvelle base vide est migrée. La clé précédente n’est jamais réutilisée.

## 5. Migration monotone

À exécuter avec une base créée par la version locale précédente puis ouverte par une version contenant une migration supplémentaire.

**Attendu** :

- les migrations déjà enregistrées ne sont jamais rejouées ;
- chaque nouvelle migration est appliquée dans une transaction ;
- `schema_migrations` reflète exactement les versions appliquées ;
- aucune donnée existante n’est perdue.

## 6. Crash / fermeture pendant utilisation

1. Ouvrir la base et effectuer plusieurs opérations locales.
2. Forcer la fermeture de l’application.
3. Relancer.

**Attendu** : la base reste lisible avec la clé existante et aucune migration partielle n’est observée.

## 7. Isolation de compte

Lorsque l’intégration logout/auth est disponible :

1. Se connecter avec un compte A et créer des données locales.
2. Se déconnecter avec purge locale.
3. Se connecter avec un compte B.

**Attendu** : aucune donnée locale du compte A n’est visible par le compte B. La politique retenue pour la première version est la purge plutôt qu’un partage implicite de base entre comptes.

## Gate de sortie COR-56

COR-56 peut passer Ready uniquement si :

- CI automatisée verte ;
- SQLCipher validé sur un Development Build réel ;
- redémarrage/persistance validés ;
- scénario perte de clé validé ;
- purge validée ;
- migration validée ;
- aucune clé/token/donnée sensible visible dans les logs ;
- comportement iOS et Android documenté en cas de différence.
