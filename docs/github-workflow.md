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

Les PR stacked restent possibles quand une dépendance technique réelle l’impose, mais elles doivent être temporaires. Dès qu’une PR d’intégration reprend leur contenu, les PR intermédiaires superseded sont fermées pour éviter les doubles CI et les branches ambiguës.

Une PR reste Draft tant qu’un gate requis manque. Une CI verte ne remplace pas une validation appareil lorsqu’un module natif, une permission, l’auth, le stockage, le réseau ou l’UX runtime sont concernés.

## CI

`Mobile CI` est la gate automatisée centrale.

Sur Pull Request, elle exécute les contrôles forts du dépôt (`pnpm verify`, configuration Expo, Expo Doctor et signal de compatibilité Expo). Les changements de documentation seuls sont ignorés.

Sur push `main`, la vérification est volontairement plus légère afin de conserver un filet de sécurité sans doubler inutilement la consommation de minutes GitHub Actions.

La concurrence annule les runs obsolètes d’une même PR.

## Validation native

Pour un changement runtime natif, utiliser un Development Build. Expo Go n’est pas une preuve suffisante pour les modules natifs comme MapLibre, SQLCipher ou la biométrie.

Les preuves utiles sont résumées dans la PR : plateforme/device, parcours, résultat et logs pertinents. Ne jamais copier de secret, token, mot de passe, code MFA ou donnée sensible dans GitHub.

## Branches dormantes

Une branche n’est pas resynchronisée avec `main` uniquement « pour être à jour ». On la resynchronise lorsqu’un chantier reprend réellement, afin d’éviter du churn et des runs CI sans valeur.

Après merge, les branches devenues inutiles doivent être supprimées. L’activation GitHub `delete_branch_on_merge` est recommandée dès que le réglage peut être appliqué proprement.

## Sécurité de `main`

COR-180 porte la configuration cible :

- Pull Request obligatoire ;
- check `Mobile CI / quality` requis ;
- pas d’approbation externe obligatoire tant que le projet est solo ;
- force-push et suppression de `main` interdits ;
- bypass propriétaire uniquement pour récupération exceptionnelle et tracée.

Aucun contournement de ces gates ne doit devenir un raccourci de développement.

## Releases

Une CI verte n’autorise jamais à elle seule une publication App Store / Google Play. La release reste derrière un gate humain explicite et le chantier COR-104.
