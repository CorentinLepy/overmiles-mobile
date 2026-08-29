# Contribuer à OverMiles Mobile

Linear reste la source de vérité produit/technique. GitHub porte le code, les Pull Requests, la revue et les gates CI.

## Chemin normal

1. Partir du ticket Linear concerné et confirmer sa branche/base cible.
2. Créer une branche dédiée `cor-XX-description` depuis la bonne base.
3. Garder un périmètre cohérent ; éviter les chaînes de PR stacked quand une PR d’intégration suffit.
4. Exécuter `pnpm verify` avant push.
5. Ouvrir une PR en Draft avec ticket Linear, portée, risques, validation et rollback.
6. Laisser `Mobile CI` valider le HEAD final.
7. Ajouter les preuves runtime adaptées au risque : Development Build, device, réseau, accessibilité, auth, stockage, etc.
8. Passer Ready uniquement quand les gates requis sont réellement terminés.
9. Utiliser de préférence un squash merge pour une tranche fonctionnelle consolidée.
10. Fermer les PR superseded et supprimer les branches devenues inutiles après intégration.

Le workflow détaillé est documenté dans [`docs/github-workflow.md`](docs/github-workflow.md).

## Règles non négociables

- ne jamais committer de secret, credential, `.env` réel, token, mot de passe ou code MFA ;
- ne jamais contourner TLS, SecureStore, la séparation des environnements ou les politiques de stockage chiffré ;
- ne pas utiliser Expo Go comme preuve de validation pour un module natif ;
- ne pas merger une PR uniquement parce que la CI est verte si une validation appareil est requise ;
- ne pas resynchroniser une branche dormante juste pour la rendre « à jour » si le chantier n’est pas repris ;
- aucune publication App Store / Google Play sans gate humain explicite.
