# Workflow GitHub — OverMiles Mobile

Ce document fixe le chemin normal de contribution au dépôt mobile. Il est volontairement simple pour un projet actuellement maintenu par une seule personne, sans sacrifier les gates de qualité.

## Branche de référence

`main` est la branche de référence. Le chemin normal est :

1. ticket Linear identifié ;
2. branche de travail dédiée ;
3. Pull Request ;
4. CI verte sur le HEAD final ;
5. validation runtime adaptée au risque ;
6. passage explicite Draft → Ready ;
7. squash merge de préférence pour une tranche fonctionnelle consolidée.

Le push direct sur `main` doit devenir une exception d’incident une fois la protection COR-180 activée.

## Pull Requests

Une PR doit annoncer sa base cible, son ticket Linear, ce qui est inclus/hors scope, les risques et les preuves de validation.

Les PR stacked restent possibles quand une dépendance technique réelle l’impose, mais elles doivent être temporaires. Dès qu’une PR d’intégration reprend leur contenu, les PR intermédiaires superseded sont fermées pour éviter les doubles sources de vérité et les branches ambiguës.

Une PR reste Draft tant qu’un gate requis manque. Une CI verte ne remplace pas une validation appareil lorsqu’un module natif, une permission, l’auth, le stockage, le réseau ou l’UX runtime sont concernés.

## CI

Le dépôt mobile est public : la stratégie CI privilégie la **couverture et la fiabilité**, pas l’économie de minutes GitHub Actions. Un contrôle n’est retiré que s’il est techniquement redondant ou sans valeur.

`Mobile CI / quality` est la gate automatisée centrale et se déclenche sur **toutes les Pull Requests**, y compris une PR de documentation, afin qu’un futur required check COR-180 existe toujours sur le HEAD.

La gate exécute :

- installation pnpm verrouillée ;
- `pnpm verify` (structure, TypeScript, ESLint, tests, Prettier, secret scan) ;
- validation de la configuration Expo ;
- Expo Doctor ;
- signal de compatibilité des dépendances Expo ;
- export/bundle de production iOS ;
- export/bundle de production Android.

Le push sur `main` conserve la même gate forte. Les pushes ne contenant que de la documentation peuvent être filtrés, car ils ne participent pas au mécanisme de required check d’une PR.

La concurrence annule les runs obsolètes d’une même PR. Les Actions tierces sont épinglées sur des SHA immuables et le checkout ne persiste pas les credentials GitHub.

`CodeQL` complète cette gate avec une analyse JavaScript/TypeScript sur PR, `main`, planification hebdomadaire et lancement manuel.

Les builds EAS natifs complets restent ciblés sur les changements qui le justifient : configuration native, dépendance native, stockage, permissions, cartographie, biométrie ou release. Ils ne sont pas remplacés par un simple bundle Metro.

## Validation native

Pour un changement runtime natif, utiliser un Development Build. Expo Go n’est pas une preuve suffisante pour les modules natifs comme MapLibre, SQLCipher ou la biométrie.

Les preuves utiles sont résumées dans la PR : plateforme/device, parcours, résultat et logs pertinents. Ne jamais copier de secret, token, mot de passe, code MFA ou donnée sensible dans GitHub.

## Branches dormantes

Une branche n’est pas resynchronisée avec `main` uniquement « pour être à jour ». On la resynchronise lorsqu’un chantier reprend réellement, afin d’éviter du churn Git et des validations sans objectif produit.

Après merge, les branches devenues inutiles doivent être supprimées. L’activation GitHub `delete_branch_on_merge` est recommandée dès que le réglage peut être appliqué proprement.

## Sécurité de `main`

COR-180 porte la configuration cible :

- Pull Request obligatoire ;
- check `Mobile CI / quality` requis ;
- pas d’approbation externe obligatoire tant que le projet est solo ;
- force-push et suppression de `main` interdits ;
- bypass propriétaire uniquement pour récupération exceptionnelle et tracée.

COR-182 complète cette protection avec CodeQL et les réglages de sécurité natifs GitHub du dépôt public.

Aucun contournement de ces gates ne doit devenir un raccourci de développement.

## Releases

Une CI verte n’autorise jamais à elle seule une publication App Store / Google Play. La release reste derrière un gate humain explicite et le chantier COR-104.
