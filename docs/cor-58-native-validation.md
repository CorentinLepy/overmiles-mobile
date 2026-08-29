# COR-58 — Validation native du verrou biométrique

Cette checklist valide le verrou local biométrique OverMiles sur la stack produit M1. La biométrie est un **verrou local optionnel** : elle ne crée, ne renouvelle et ne restaure jamais une session serveur.

## Garde-fous

- Face ID / Touch ID / biométrie Android ne remplacent jamais l’authentification OverMiles ;
- le Refresh Token reste dans SecureStore et l’Access Token reste en mémoire ;
- la préférence biométrique utilise son propre service SecureStore ;
- la clé SQLCipher reste séparée de la préférence biométrique et des credentials ;
- aucun fallback silencieux vers le code de l’appareil ;
- Android exige une biométrie `strong` ;
- une erreur de lecture de la préférence pendant une restauration de session échoue fermée ;
- une session serveur révoquée reste prioritaire sur un succès biométrique local.

## iOS — Development Build

1. Installer un Development Build contenant `expo-local-authentication`.
2. Vérifier le texte de permission Face ID OverMiles.
3. Se connecter normalement.
4. Profil → activer le verrou biométrique.
5. Vérifier qu’un challenge biométrique réussi est demandé avant l’activation.
6. Mettre l’application en arrière-plan puis revenir.
7. Vérifier que l’écran OverMiles est masqué par le verrou local.
8. Déverrouiller avec Face ID / Touch ID.
9. Refaire le scénario en annulant le prompt : l’application doit rester verrouillée.
10. Désactiver le verrou depuis Profil, tuer l’application puis relancer : aucun prompt local ne doit être imposé.

## Android — appareil physique

1. Installer un Development Build contenant `expo-local-authentication`.
2. Enrôler une biométrie forte compatible.
3. Activer le verrou depuis Profil.
4. Mettre l’application en arrière-plan puis revenir.
5. Vérifier que l’écran de verrouillage apparaît immédiatement.
6. Déverrouiller avec la biométrie forte.
7. Annuler le prompt : l’application reste verrouillée.
8. Tester, si possible, un appareil ne proposant qu’une biométrie faible : l’activation doit être refusée.

## Réauthentification serveur prioritaire

1. Activer le verrou biométrique.
2. Révoquer ou invalider la session serveur.
3. Relancer l’application.
4. Vérifier qu’une authentification OverMiles complète est exigée et qu’un succès biométrique ne restaure jamais la session serveur.

## Persistance

1. Activer le verrou biométrique après challenge réussi.
2. Tuer complètement l’application.
3. Relancer : la session restaurée doit rester derrière le verrou local.
4. Désactiver le verrou depuis une session déverrouillée.
5. Relancer : la préférence doit rester désactivée.

## Gate de sortie COR-58 / COR-147C

- `pnpm verify` vert ;
- Expo config / Doctor verts ;
- prebuild natif iOS + Android vert ;
- Development Build iOS + Android contenant le module natif ;
- activation / désactivation validées ;
- background → foreground → verrou validé ;
- annulation du prompt validée ;
- biométrie indisponible / faible traitée sans fallback ;
- session serveur révoquée prioritaire ;
- aucun secret ajouté aux logs.
