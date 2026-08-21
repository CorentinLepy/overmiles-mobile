## Linear

- Ticket : COR-

## Résumé

-

## Sécurité / données

- [ ] Aucun secret, credential, `.env` réel ou donnée sensible ajouté
- [ ] Aucun log de token, Authorization, cookie, mot de passe ou MFA
- [ ] Les environnements development / preview / production restent séparés
- [ ] Aucun `EXPO_PUBLIC_*` ne contient une valeur secrète

## Impact architecture

- [ ] Changement natif / config plugin ? Build EAS requis ou justification documentée
- [ ] Impact auth / stockage / réseau ? Helpers centraux conservés
- [ ] Impact offline / migration ? Migration et rollback documentés
- [ ] Permission plateforme ajoutée ? Besoin et portée minimale justifiés
- [ ] Nouvelle dépendance native ? Maintenance, permissions et compatibilité Expo/EAS vérifiées

## Validation

- [ ] `pnpm verify`
- [ ] `npx expo install --check`
- [ ] `pnpm doctor`
- [ ] Test Android si impact runtime natif
- [ ] Test iOS / build EAS iOS si impact spécifique iOS ou avant release

## MASVS

- [ ] STORAGE / secrets : aucun stockage sensible non approuvé
- [ ] AUTH / NETWORK : aucune régression sur tokens, TLS, retry ou logs
- [ ] PLATFORM / PRIVACY : permissions et collecte minimales
- [ ] CODE / RESILIENCE : aucune fonctionnalité debug ou bypass sécurité en production

## Risques et rollback

-
