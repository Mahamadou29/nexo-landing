# Inscription Nexo — deux cartes

## Périmètre

- `components/signup-form.tsx` conserve React Hook Form, le resolver Zod, les composants UI existants et le transport `postJson`. Aucun changement du backend, du contrat réseau, du consentement ou des statistiques. La validation/normalisation du téléphone évolue dans `lib/signup-schema.ts`.
- Carte 01 : e-mail **ou** pays + numéro national, note facultative (1 000 caractères). Changer de canal efface uniquement l’autre coordonnée ; le pays choisi est conservé.
- Carte 02 : consentement explicite, lien vers les droits, validation. Un seul formulaire ; Entrée utilise la même validation que le bouton.
- `components/signup.css` est entièrement préfixé `signup-`. Les cartes sont côte à côte dès que leur conteneur atteint 42rem ; sinon elles s’empilent dans l’ordre contact → accord. Les contrôles, erreurs et anneaux de focus ne sont pas coupés ; seul le décor est masqué aux bords.
- Les seuls changements dans les appelants sont les classes du conteneur d’inscription : largeur disponible dans l’expérience, bloc pleine largeur dans la découverte. `app/globals.css`, les exercices et les corrections vidéo/respiration restent inchangés.

## Pays et téléphone

- Le canal initial reste l’e-mail. Choisir « Téléphone » affiche d’abord le sélecteur natif « Pays du numéro » / « Phone country », puis le champ national. Par défaut : **Sénégal (+221)** / **Senegal (+221)**, dans les deux langues. L’indicatif est aussi visible à côté du champ et annoncé dans son texte d’aide. Aucun pays n’est géolocalisé.
- Nouvelle dépendance : `libphonenumber-js` (`/max`, métadonnées complètes pour validation des chiffres et longueurs). Tous ses pays/territoires sont proposés via `getCountries()` et `getCountryCallingCode()`, sans table manuelle. Les noms viennent de `Intl.DisplayNames` et sont triés par `Intl.Collator` en FR/EN. Les numéros mondiaux non géographiques sans pays ne sont pas acceptés par ce formulaire à sélection de pays.
- Les espaces, parenthèses, points et tirets sont acceptés. La bibliothèque normalise le préfixe national : France `06…` devient `+336…`, tandis qu’un zéro significatif italien reste conservé. Le numéro doit être possible **et valide selon les métadonnées** ; cela ne prouve ni attribution, ni possession, ni joignabilité. Aucun engagement SMS/WhatsApp n’est ajouté.
- Un numéro international collé avec `+` est analysé tel quel, jamais concaténé aveuglément à l’indicatif. S’il correspond à un autre pays (y compris un autre pays partageant `+1`), une erreur au champ téléphone indique le pays à sélectionner ou demande de corriger le numéro. Le pays n’est pas changé automatiquement. Texte libre et extensions sont refusés.
- Changer de pays conserve la saisie brute et l’accord, efface l’ancienne erreur téléphone et **ne soumet rien**. La prochaine soumission valide avec le nouveau pays. Un pays seul, un indicatif seul, un champ effacé ou un numéro sénégalais trop court/long restent invalides ; le focus revient au champ téléphone visible.
- Changer FR/EN conserve pays, numéro, note, consentement et état ; les libellés et nouvelles erreurs suivent la langue. Rien n’est persisté entre montages/rechargements. Succès : valeurs effacées et pays réinitialisé à SN (le formulaire est alors remplacé par le récapitulatif).
- Payload inchangé : uniquement `phone` en E.164 **ou** `email`, plus les champs existants. Aucun `country` / `phoneCountry` n’est envoyé. Consentement explicite toujours obligatoire.

## États et confidentialité

- `idle` : consentement décoché, cellules statiques. Avant hydratation, les contrôles sont désactivés et le message `noscript` est disponible.
- Validation : messages FR/EN, focus sur le premier champ visible invalide, y compris téléphone vide. Aucun envoi en cas d’erreur.
- `sending` : les deux groupes et le bouton sont désactivés ; garde anti-double envoi, annonce accessible hors du formulaire `aria-busy`. Les cellules ne célèbrent pas encore.
- **Seuls HTTP 201 et un corps JSON contenant `status: "registered"` déclenchent `registered`.** Recevoir les en-têtes ne suffit pas : le décodage du corps doit aussi réussir.
- Succès : effacement des données du formulaire, récapitulatif sans afficher de coordonnée/note, remplacement du consentement par la confirmation, focus sur son titre. Sept cellules translucides se déploient puis se stabilisent en moins de 5 secondes. Pas de bouton de renvoi ni de minuterie de fausse confirmation.
- `error` : réponse inattendue, JSON invalide, problème réseau, délai dépassé ou HTTP 429. Rien n’est confirmé ; saisie et accord restent disponibles, bouton « Réessayer l’inscription ». Aucun nouvel envoi automatique.
- Le transport existant conserve son délai de 15 secondes et `credentials: omit`, `cache: no-store`, `referrerPolicy: no-referrer`.
- Démontage : annulation via `AbortController`, réponse/décodage tardif ignorés, pas de requête si la validation finit après démontage. Les données ne sont pas persistées. Quitter puis revenir ouvre un formulaire neuf ; une annulation côté navigateur ne garantit pas qu’un serveur n’a pas déjà accepté la requête.
- FR/EN conserve les valeurs et l’état ; la confirmation ne redémarre pas au changement de langue. `prefers-reduced-motion: reduce` affiche directement la composition finale sans animation ; changement de préférence pris en charge par CSS. Pas de RAF, intervalle, audio ou listener d’animation ; aucune nouvelle dépendance d’animation.

## Vérifications automatisées

```bash
cd /Users/kaba/Clients/nexo-landing
node --test test/signup-phone.test.mjs test/signup-schema.test.mjs test/signup-ui.test.mjs test/landing.test.mjs test/mobile-layout.test.mjs
npx tsc --noEmit
npm run lint
npm run build
```

Les tests Node suivent le harnais TSX/hooks existant : resolver Zod et transport réels, `fetch` remplacé intégralement en mémoire. Ils couvrent structure, hydratation, validation/focus, changement de canal, payload minimal FR/EN, double soumission, décodage différé, confirmation, erreurs/reprise, annulation et réduction du mouvement. Ils ne remplacent pas un contrôle navigateur de la géométrie, du focus natif ou des lecteurs d’écran. Aucun contact n’est envoyé.

## Contrat navigateur sûr

Utiliser une **nouvelle page/contexte isolé**. Ne pas réutiliser les onglets partagés, ne pas relancer les previews existantes. Entrées : `/decouvrir#inscription`, ou `/experience` puis le bouton « Inscription » / « Sign up » de la navigation « Étapes du parcours » / « Experience steps ».

| Sélecteur | Usage |
| --- | --- |
| `[data-signup-state]` | Racine ; valeurs `idle`, `sending`, `error`, `registered` |
| `[data-signup-card="contact"]` | Carte coordonnées / récapitulatif |
| `[data-signup-card="confirm"]` | Carte accord / célébration |
| `[data-signup-state] input[name="email"]` | E-mail |
| `[data-signup-state] select[name="phoneCountry"]` | Pays (`selectOption("SN")`, `"FR"`, `"US"`…), après sélection du canal téléphone |
| `[data-signup-dial-code]` | Indicatif visible, `+221` par défaut |
| `[data-signup-state] input[name="phone"]` | Numéro national ou international collé (après sélection du canal) |
| `[data-signup-state] textarea[name="note"]` | Note facultative |
| `[data-signup-state] input[name="consent"]` | Accord explicite |
| `[data-signup-state] button[type="submit"]` | Inscription / réessai (absent après succès) |
| `[data-signup-state] [role="status"]` | Message réseau vivant |
| `[data-signup-success]` | Confirmation, absente avant succès réel ou mocké |
| `[data-signup-success] h3` | Cible de focus après succès |
| `.signup-cells[data-confirmed="true"]` | Décor de succès, masqué aux technologies d’assistance |
| `[data-signup-receipt]` | Récapitulatif sans donnée personnelle |

**Intercepter avant toute saisie/soumission** le chemin `/api/v1/landing/waitlist`, quel que soit l’hôte configuré par `NEXT_PUBLIC_NEXO_API_URL`. Ne jamais appeler `route.continue()` ou `route.fallback()` pour cette route. L’exemple ci-dessous s’exécute dans un contexte Playwright isolé avec `serviceWorkers: "block"`. Toutes les coordonnées ci-dessous sont des **fixtures exclusivement mockées** : ne jamais les soumettre à un service réel. Les exemples SN/FR ne sont pas garantis non attribués. L’ancien exemple britannique `+447700900123` est réservé à la fiction et échoue maintenant à la validation stricte des métadonnées ; utiliser US `202 555 0123` pour une fixture du bloc de fiction nord-américain.

| Pays choisi | Saisie mockée | Résultat attendu |
| --- | --- | --- |
| SN (défaut FR et EN) | `77 123 45 67` | Payload `phone: "+221771234567"` |
| SN | `+221 77 123 45 67` | Même payload, indicatif une seule fois |
| FR | `06 12 34 56 78` | Payload `phone: "+33612345678"`, zéro national retiré |
| SN | `+33 6 12 34 56 78` | Aucun POST, erreur proposant France (+33), focus téléphone |
| FR après correction du pays | même saisie collée | Aucun POST au changement ; soumission explicite normalisée |
| US | `(202) 555-0123` | Payload `phone: "+12025550123"` |
| SN | vide, `+221`, `77123456`, `7712345678` | Aucun POST, focus téléphone |
| E-mail (n’importe quel pays précédent) | `signup@example.invalid` | Payload e-mail seul, ni téléphone ni pays |

Contrôler aussi : changer FR/EN après choix de FR conserve pays/saisie ; effacer le numéro n’envoie jamais l’indicatif seul ; changer de canal vide l’ancienne coordonnée ; une erreur réseau conserve pays/saisie pour réessai ; succès efface les données sans modifier les confirmations exactes « Tu fais partie de l’aventure. » / « You are part of the journey. ».

```typescript
// Installer sur le contexte AVANT de naviguer ; aucune transmission au backend.
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};
let mode: "success" | "error" | "rate-limit" | "invalid" = "success";
await context.route(/\/api\/v1\/landing\/waitlist(?:\?.*)?$/, async route => {
  if (route.request().method() === "OPTIONS") {
    await route.fulfill({ status: 204, headers: cors });
    return;
  }
  if (route.request().method() !== "POST") {
    await route.abort();
    return;
  }
  await route.fulfill({
    status: mode === "error" ? 503 : mode === "rate-limit" ? 429 : 201,
    headers: cors,
    contentType: "application/json",
    body: JSON.stringify({ status: mode === "invalid" ? "pending" : "registered" }),
  });
});
```

Pour visualiser `sending`, retenir la résolution du handler avec une promesse libérée manuellement, puis `route.fulfill` ; ne pas attendre plus de 15 secondes si le but n’est pas de tester le timeout. Pour le réseau interrompu : `route.abort("failed")`. Pour tester la reprise : erreur initiale, `mode = "success"`, clic sur le même bouton. Même HTTP 200 avec `registered` doit rester une erreur.

Matrice de contrôle prévue pour la vérification finale navigateur : FR/EN, 1440×900, 1024×600, 390×844, 320×568, paysage, zoom 200 %, clavier seul et mouvement réduit. Vérifier les deux cartes sur desktop, consentement/CTA entièrement accessibles sur mobile et écrans courts (défilement de la zone prévu), focus après validation/succès, aucune célébration pendant pending/error, aucun débordement horizontal. Les previews et onglets existants n’ont pas été modifiés par cette implémentation.
