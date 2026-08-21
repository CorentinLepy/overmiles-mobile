# Baseline OWASP MASVS — OVERMILES Mobile

Cette baseline traduit les catégories OWASP MASVS en règles concrètes pour le dépôt mobile OVERMILES. Elle constitue un gate minimal avant les premières features métier et sera enrichie à mesure que COR-55 à COR-59 progressent.

## STORAGE

- Access Token : mémoire uniquement, jamais persisté.
- Refresh Token : `expo-secure-store`, service dédié et versionné.
- Données offline sensibles : base locale chiffrée dans COR-56.
- Aucun secret dans AsyncStorage, logs, clipboard ou stockage public.
- Suppression locale des secrets sur logout/révocation.

## CRYPTO

- Utiliser les primitives plateforme et bibliothèques maintenues.
- Aucune crypto maison.
- Aucune clé hardcodée ou exposée via `EXPO_PUBLIC_*`.
- Clés/signatures/store credentials hors repository.

## AUTH

- Access Token Bearer court et lié à la session serveur.
- Refresh Token rotatif/révocable côté serveur.
- Refresh single-flight côté mobile pour éviter la réutilisation concurrente d’un token rotatif.
- Biométrie = verrou local uniquement ; elle ne remplace pas l’autorisation serveur/MFA.
- Permissions et rôles toujours validés par le backend.

## NETWORK

- HTTPS obligatoire en production (`https://overmiles.app/api/v1`).
- Aucun bypass TLS, `rejectUnauthorized=false` ou pinning artisanal.
- Timeouts bornés.
- Retry faible, avec backoff/jitter, uniquement pour opérations idempotentes et erreurs transitoires.
- Aucun secret dans URL/query lorsque cela peut être évité.
- Logs réseau redacted : jamais Authorization, cookies, tokens ou contenu sensible.

## PLATFORM

- Permissions minimales et demandées au moment pertinent.
- Deep links et universal/app links validés avant activation métier.
- Fichiers privés par défaut.
- Pas de WebView permissive par défaut.
- Les modules natifs ajoutés doivent être justifiés, maintenus et compatibles EAS.

## CODE

- TypeScript strict.
- ESLint sans warning toléré.
- Tests automatiques sur primitives sécurité/réseau/offline.
- `pnpm install --frozen-lockfile` en CI.
- Expo packages installés avec la compatibilité SDK vérifiée.
- Aucun secret ni credential dans tests, fixtures ou logs.
- Aucune fonctionnalité debug/test active en production.

## RESILIENCE

- Les builds release n’exposent pas de dev menu ni endpoint debug métier.
- Les secrets et autorisations critiques restent côté serveur.
- L’obfuscation n’est pas considérée comme une frontière de sécurité.
- Anti-tamper/root detection avancé uniquement si le threat model futur le justifie.

## PRIVACY

- Pas de télémétrie additionnelle au bootstrap sans besoin produit validé.
- Crash/network logs redacted.
- Photos, localisation, fichiers et contacts : permissions à la demande et usage minimal.
- Les déclarations App Store / Play Store doivent correspondre aux données réellement collectées.

## Gate PR minimal

Une PR mobile ne doit pas être mergée si :

- le workflow CI est rouge ;
- un secret ou fichier d’environnement réel est commité ;
- une dépendance native non justifiée est ajoutée ;
- une régression TypeScript/lint/test est introduite ;
- un changement auth/storage/network contourne les helpers centraux ;
- une permission plateforme est ajoutée sans justification ;
- un changement natif requis n’a pas de stratégie de build/test associée.

## Gate release minimal

Avant preview externe ou store :

- CI verte ;
- build natif vert ;
- aucune issue sécurité P0/P1 ouverte ;
- runtime/version cohérents ;
- backend compatible ;
- secrets EAS/store séparés ;
- checklist privacy/permissions à jour.
