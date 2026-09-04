# COR-104 — Store release readiness

Ce document prépare la distribution iOS/Android sans déclencher de publication. Toute mise en production publique reste soumise à un gate humain explicite.

## Identité technique stable

- nom produit : OVERMILES ;
- iOS bundle identifier : `app.overmiles.mobile` ;
- Android application id : `app.overmiles.mobile` ;
- schéma deep link : `overmiles` ;
- EAS `appVersionSource` : `remote` ;
- build production : `autoIncrement` ;
- API production : `https://overmiles.app/api/v1` ;
- profils `development` et `preview` : distribution interne uniquement.

Ne pas changer bundle identifier/application id après la première publication sans migration explicitement décidée.

## Secrets et signatures

Ne jamais committer :

- certificat Apple `.p12` ;
- provisioning profiles ;
- mot de passe Apple ou app-specific password ;
- clé App Store Connect ;
- clé/service account Google Play ;
- keystore Android ;
- mot de passe de keystore ;
- `EXPO_TOKEN` ;
- credentials EAS.

Les credentials restent dans Apple/Google/EAS/GitHub Secrets selon le workflow retenu. Les variables `EXPO_PUBLIC_*` ne contiennent jamais de secret.

## Parcours de distribution cible

### iOS

1. Development Build réel iPhone ;
2. build production EAS signé ;
3. TestFlight interne ;
4. QA des parcours critiques ;
5. metadata + privacy App Store Connect validées ;
6. soumission review ;
7. publication seulement après validation humaine.

### Android

1. Development Build réel Android ;
2. build production EAS signé ;
3. Google Play Internal Testing ;
4. QA des parcours critiques ;
5. Data safety + fiche Play Console validées ;
6. promotion vers la piste décidée ;
7. production seulement après validation humaine.

## Gate fonctionnel avant store

Les deux plateformes doivent valider au minimum :

- inscription/connexion et restauration de session ;
- logout et révocation de session ;
- MFA quand activé sur le compte ;
- navigation Accueil / Voyages / Carte / Profil ;
- ouverture d’un voyage et données API réelles ;
- comportement réseau dégradé/offline ;
- base locale chiffrée et récupération après perte de clé ;
- verrou biométrique lorsqu’il est activé ;
- carte MapLibre sur Development Build ;
- thème clair/sombre ;
- accessibilité essentielle ;
- absence de crash sur cold start et reprise foreground.

## Inventaire privacy à vérifier avant déclaration store

Ce tableau est un inventaire de vérification, pas une déclaration juridique pré-remplie. Les réponses finales App Store/Play doivent correspondre exactement au build candidat et au comportement serveur au moment de la soumission.

| Domaine      | Données/fonctionnalités à auditer                              | Preuve attendue                            |
| ------------ | -------------------------------------------------------------- | ------------------------------------------ |
| Compte       | email, profil, identifiants internes                           | contrat API + écrans compte                |
| Auth         | refresh token device-bound, sessions appareils, MFA            | COR-51/52/55 + SecureStore                 |
| Voyages      | noms, dates, pays, étapes, événements                          | API Trips/Stops/Timeline                   |
| Médias       | photos/covers et éventuelles métadonnées                       | modules Photos/Media                       |
| Journal      | texte/souvenirs saisis par l’utilisateur                       | module Journal/Memories                    |
| Budget       | dépenses, justificatifs, OCR si activé                         | module Expenses                            |
| Documents    | documents de voyage ajoutés par l’utilisateur                  | module Documents                           |
| Localisation | coordonnées déjà enregistrées ; toute future collecte GPS live | COR-137/138 + permissions natives du build |
| Diagnostics  | logs techniques réellement envoyés hors appareil               | audit réseau/logging du build candidat     |

Aucune case de privacy store ne doit être cochée à partir de ce document seul.

## Permissions natives

À chaque Release Candidate :

1. générer/configurer le projet natif ;
2. lister les permissions iOS/Android réellement présentes ;
3. justifier chaque permission par une fonctionnalité visible ;
4. supprimer toute permission non nécessaire ;
5. aligner les déclarations store avec ces permissions.

La Phase B MapLibre de COR-137 n’a pas besoin de permission GPS live. Une future fonctionnalité de tracking devra passer par un ticket explicite avant d’ajouter `expo-location` ou une permission de localisation.

## Metadata qui nécessite une décision humaine

Ne pas inventer automatiquement :

- URL publique de politique de confidentialité ;
- URL support ;
- catégorie App Store/Play ;
- classification d’âge ;
- texte marketing final ;
- captures définitives ;
- pays de distribution ;
- disponibilité/prix ;
- réponses finales privacy/data safety ;
- date de publication.

Ces éléments sont préparables mais doivent être validés par le responsable produit avant soumission.

## Commandes de build — après gate humain

```bash
npx eas-cli@latest build -p ios --profile production
npx eas-cli@latest build -p android --profile production
```

La soumission n’est pas chaînée automatiquement à ces commandes. Une étape séparée permet de vérifier les binaires avant envoi aux stores.

## Critère de sortie COR-104

Le ticket ne passe Done que lorsque les builds signés, TestFlight, Play Internal Testing, metadata/privacy, QA appareils et reviews stores ont tous été réellement validés. Une CI verte seule n’est pas suffisante.
