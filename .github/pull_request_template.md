## Linear

- Ticket : COR-

## Type de PR

- [ ] PR d’intégration vers `main`
- [ ] PR isolée
- [ ] PR stacked temporaire — justification et PR parent précisées ci-dessous

Base cible :

Remplace / supersede :

## Résumé

-

## Portée

- Inclus :
- Hors scope :

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

## Validation automatisée

- [ ] `pnpm verify`
- [ ] `npx expo install --check` si dépendances Expo concernées
- [ ] `pnpm doctor` si config/dépendances natives concernées
- [ ] CI GitHub verte sur le HEAD final

## Validation runtime

- [ ] Android réel / Development Build si impact runtime natif
- [ ] iOS réel ou simulateur pertinent / Development Build si impact runtime natif
- [ ] Réseau dégradé / reprise vérifiés si impact data/network
- [ ] Accessibilité / tailles de texte vérifiées si impact UI
- [ ] Les preuves utiles (logs, device, parcours) sont résumées dans la PR

## Statut de merge

- [ ] La PR reste Draft tant qu’un gate runtime/produit requis manque
- [ ] La base est à jour ou l’écart avec `main` est compris et documenté
- [ ] Aucune PR stacked superseded ne reste ouverte inutilement
- [ ] Le merge final sera squash de préférence pour une tranche fonctionnelle consolidée

## MASVS

- [ ] STORAGE / secrets : aucun stockage sensible non approuvé
- [ ] AUTH / NETWORK : aucune régression sur tokens, TLS, retry ou logs
- [ ] PLATFORM / PRIVACY : permissions et collecte minimales
- [ ] CODE / RESILIENCE : aucune fonctionnalité debug ou bypass sécurité en production

## Risques et rollback

-
