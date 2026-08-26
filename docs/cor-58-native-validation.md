# COR-58 — Validation native du verrou biométrique

Cette checklist valide le comportement réel du verrou local biométrique OverMiles. Face ID doit être testé dans un **Development Build** : Expo Go n’est pas un environnement valide pour ce scénario.

## Principes à préserver

- la biométrie protège uniquement l’accès local à l’application ;
- elle ne crée, ne renouvelle et ne réactive jamais une session serveur ;
- une session révoquée/expirée doit rester prioritaire ;
- aucune clé SQLCipher, Access Token, Refresh Token ou mot de passe n’est protégée en les déplaçant dans le mécanisme biométrique ;
- aucun fallback silencieux vers le code appareil : les cas nécessitant un fallback applicatif doivent conduire à une réauthentification OverMiles explicite.

## iOS — Face ID / Touch ID

1. Installer un Development Build contenant le plugin `expo-local-authentication`.
2. Vérifier que la permission Face ID affiche le texte OverMiles configuré.
3. Avec une biométrie enrôlée, activer le verrou.
4. Vérifier qu’un challenge biométrique réussi est requis **avant** d’enregistrer la préférence `enabled`.
5. Relancer le challenge de déverrouillage et valider le succès.
6. Annuler volontairement le prompt.
7. Vérifier que l’annulation laisse l’application verrouillée mais ne détruit pas la session serveur.
8. Tester un appareil/simulateur sans biométrie enrôlée.
9. Tester le lockout biométrique si reproductible.

**Attendu** : succès → `unlocked`, annulation → `cancelled`, absence/enrôlement insuffisant → `unavailable`, lockout/fallback système → `requires_reauth`.

## Android — biométrie forte

1. Tester sur un appareil avec biométrie Class 3 / `strong` enrôlée.
2. Activer puis déverrouiller l’application.
3. Vérifier que le prompt utilise `biometricsSecurityLevel: "strong"`.
4. Tester, si disponible, un appareil ne disposant que d’une biométrie faible.

**Attendu** : une biométrie faible seule ne rend pas le verrou éligible. Aucun downgrade implicite vers `weak`.

## Persistance de la préférence

1. Activer le verrou après un challenge réussi.
2. Tuer complètement l’application.
3. Relancer.
4. Vérifier que `isEnabled()` reste vrai.
5. Désactiver le verrou depuis une session locale déjà déverrouillée.
6. Relancer.

**Attendu** : la préférence est persistante et séparée des credentials. La désactivation supprime uniquement la préférence biométrique.

## Session serveur prioritaire

À valider une fois COR-135/COR-58 intégrés sur la même branche :

1. Se connecter et activer le verrou biométrique.
2. Révoquer/expirer la session côté serveur.
3. Réussir ensuite un challenge biométrique local.

**Attendu** : le succès biométrique ne restaure jamais une session serveur révoquée. L’application exige une authentification OverMiles complète.

## Gate de sortie COR-58

- CI automatisée verte ;
- Face ID/Touch ID validé sur Development Build iOS ;
- biométrie forte validée sur Android ;
- annulation/absence d’enrôlement/lockout validés ;
- persistance activation/désactivation validée ;
- intégration lifecycle définie sans délai caché dans le service ;
- réauthentification serveur explicitement prioritaire ;
- aucun secret ajouté aux logs.
