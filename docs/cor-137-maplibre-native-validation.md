# COR-137 — Validation native MapLibre Phase B

Cette checklist valide uniquement ce que la CI JavaScript/TypeScript ne peut pas prouver : intégration native, rendu MapLibre, gestes et comportement réel sur iOS/Android.

## Préconditions

- branche : `cor-137-maplibre-native-phase-b` ;
- CI Mobile verte ;
- un Development Build contenant `@maplibre/maplibre-react-native` ;
- un compte OverMiles bêta avec au moins un voyage contenant une étape ou un événement géolocalisé ;
- aucun secret dans les variables `EXPO_PUBLIC_*`.

MapLibre Native est une dépendance native : Expo Go ne constitue pas une validation suffisante pour cette tranche.

## Construire le Development Build

Depuis le repo mobile :

```bash
pnpm install --frozen-lockfile
npx expo-doctor@latest
eas build -p ios --profile development
eas build -p android --profile development
```

Une fois le client installé :

```bash
npx expo start --dev-client
```

## Matrice iOS + Android

À reproduire sur les deux plateformes.

### Démarrage

- l’application démarre sans crash natif ;
- la connexion fonctionne normalement ;
- l’onglet Carte s’ouvre sans écran blanc ;
- le style OpenFreeMap Liberty se charge ;
- attribution et logo MapLibre restent visibles ;
- aucune demande de permission GPS/localisation n’apparaît.

### Données OverMiles

- les étapes géolocalisées apparaissent ;
- les événements géolocalisés apparaissent ;
- un compte sans point affiche l’état vide, pas une erreur ;
- un point unique produit un cadrage local utile ;
- plusieurs points produisent un cadrage global sans couper les repères ;
- longitude/latitude ne sont pas inversées.

### Gestes et sélection

- pan fluide ;
- pinch-to-zoom fluide ;
- rotation/compas cohérents avec la plateforme ;
- toucher un repère ouvre sa fiche ;
- le repère sélectionné change visuellement ;
- fermer la fiche rend la carte immédiatement interactive ;
- le bouton d’actualisation ne déclenche pas plusieurs rafraîchissements concurrents visibles.

### Réseau dégradé

- ouvrir la carte avec un réseau normal puis couper le réseau ;
- actualiser : les données déjà disponibles ne doivent pas disparaître ;
- le statut hors-ligne est visible mais non bloquant ;
- rétablir le réseau puis actualiser : retour à l’état normal ;
- une panne du fond de carte doit afficher un message sans faire disparaître les données métier OverMiles.

### Thèmes et accessibilité

- vérifier thème clair et sombre ;
- vérifier lisibilité des overlays sur le fond de carte ;
- vérifier Dynamic Type / taille de texte supérieure ;
- vérifier VoiceOver/TalkBack sur les contrôles d’actualisation et fermeture ;
- aucun contrôle essentiel ne doit être uniquement représenté par une couleur.

## Garde-fous de cette phase

Ne pas ajouter pendant cette validation :

- tracking GPS live ;
- permission localisation ;
- appels directs Geoapify/Google depuis le mobile ;
- seuil de clustering arbitraire ;
- downsampling arbitraire des `LocationPoint`.

Les traces historiques haute densité restent dans COR-138. La politique de clustering/downsampling sera décidée avec la volumétrie réelle et des mesures de performance.

## Critère de sortie

Phase B peut passer Ready lorsque :

1. la CI reste verte ;
2. iOS Development Build validé ;
3. Android Development Build validé ;
4. aucun crash natif ou blocage pan/zoom ;
5. les repères OverMiles sont correctement cadrés et sélectionnables ;
6. le mode réseau dégradé conserve les données déjà disponibles.
