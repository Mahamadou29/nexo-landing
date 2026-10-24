# Découvrir Nexo — vision produit

## Périmètre et sources

La porte `/decouvrir` explique Nexo ; `/experience` reste la porte de la démo immersive. Cette évolution ne crée ni application mobile, ni backend de rappels, ni produit physique. Elle conserve le choix illustratif Ciel/Noir, les informations utiles, la FAQ native et le formulaire existant.

- La démo web propose voix, chat, détente et respiration (`components/demo-activities.tsx`, appel depuis `components/experience.tsx`). Les échanges IA dépendent des indicateurs de disponibilité du service ; aucune disponibilité permanente n’est promise.
- La présentation existante décrit une application avec journal, conversations et pauses. Elle propose une liste d’attente, sans téléchargement ni accès à l’application après inscription. « En préparation » ne signifie pas « lancée ».
- Clarification produit : les rappels envisagés comprennent **les rappels programmés par la personne ET les invitations facultatives de Nexo** à prendre un moment pour soi.
- Clarification produit : **peluche classique d’abord, peluche connectée ensuite**. Ces deux étapes sont des intentions, pas des produits disponibles.

## Parcours visible FR / EN

Titre : **« Le chemin se dessine. » / « The journey ahead. »**

| Étape | Statut FR / EN | Ce que la page peut affirmer |
| --- | --- | --- |
| Démo | Aujourd’hui · démo web / Today · web demo | Premier aperçu interactif, voix/chat selon disponibilité, détente et respiration. Pas l’application complète. |
| Application | En préparation · application / In preparation · app | Conversations, journal personnel et pauses avec Ciel ou Noir. Liste d’attente, pas encore d’accès par inscription. |
| Rappels | Prévu · rappels dans l’application / Planned · in-app reminders | Concept non disponible ; accord préalable, horaires et types choisis, modification/pause/désactivation. |
| Peluche classique | À venir · peluche classique / Future · classic plush | Imaginer Ciel et Noir en peluches sans connexion. Ni vente, ni précommande. |
| Peluche connectée | Plus loin · peluche connectée / Further ahead · connected plush | Exploration après la classique ; fonctionnement à définir. |

La note visible **« Une vision qui peut évoluer, pas un calendrier de lancement. Aucune date annoncée. » / « An evolving vision, not a launch schedule. No dates have been announced. »** s’applique à l’ensemble. Aucun trimestre, délai, pourcentage d’avancement ou engagement de livraison. L’ordre décrit une direction, pas une dépendance technique ni une promesse de livraisons séparées.

## Concept des rappels — à concevoir, pas implémenté

Deux usages complémentaires :

1. **Rappels programmés** : la personne choisit de programmer un rappel pour un moment qu’elle souhaite consacrer à Nexo.
2. **Invitations facultatives de Nexo** : si elle les active, Nexo peut l’inviter à prendre de ses nouvelles, dans les horaires et les types qu’elle a choisis.

Garde-fous envisagés : consentement explicite, aucune activation implicite ; maîtrise des horaires et des types de rappels ; possibilité de modifier, mettre en pause ou désactiver. Les invitations ne supposent ni surveillance de l’état émotionnel, ni détection, ni diagnostic, ni intervention proactive fondée sur un état supposé.

À définir avant une implémentation : parcours de réglages, permissions éventuelles, canaux de notification, règles de programmation et traitement des données. Aucun mécanisme de push, fréquence, capteur, collecte ou service en arrière-plan n’est annoncé. L’accord pour recevoir les nouvelles du lancement via la **liste d’attente n’active aucun rappel** et n’est pas un consentement à une future fonction de l’application.

## Suivre l’aventure — Instagram existant

Le compte officiel **[@nexo.companion](https://www.instagram.com/nexo.companion)** existe déjà, confirmé par l’utilisateur. Il n’est pas une étape future de la roadmap. Sous l’introduction, « Suivre l’aventure sur Instagram » / « Follow the journey on Instagram » accompagne un lien discret vers ce compte.

Lien HTML natif dans le même onglet, nom accessible contextualisé FR/EN, `rel="noreferrer"` pour ne pas transmettre de référent. Aucun embed, SDK, script, préchargement, requête Instagram au rendu ou événement de suivi ajouté. Sélecteur de contrôle : `#roadmap a[href="https://www.instagram.com/nexo.companion"]`. Les tests FR/EN vérifient destination, libellé accessible et absence d’intégration/préchargement.

## Peluches — classique → connectée

La première intention physique est une peluche **classique, non connectée**, déclinée autour de Ciel et Noir. La version connectée vient plus loin comme piste d’exploration. Aucune spécification, microphone, capteur, autonomie, compatibilité, détection ou capacité thérapeutique n’est définie par cette page. Les illustrations Ciel/Noir existantes ne sont pas des photos de produits fabriqués.

## Composition et accessibilité

- Un seul en-tête compact : logo, Le projet, La suite, FAQ, Essayer Nexo, M’inscrire et FR/EN. Les onglets « Découvrir / Ressentir » et la seconde barre ont été retirés sur cette page. Sous 1024px, les liens passent dans un menu natif ; Échap le ferme et rend le focus au déclencheur. Les autres pages conservent leur navigation.
- Hero existant allégé dans ses intentions : « Essayer Nexo » vers `/experience`, lien secondaire vers la liste d’attente.
- Trois bénéfices ouverts : Parler / Écrire / Souffler, distinguant la démo du journal de l’application en préparation.
- Roadmap en liste ordonnée, sur un fil légèrement courbe, sans cartes de tableau de bord ni faux compteurs. Lecture verticale dans le même ordre sur tous les écrans ; introduction à gauche sur grand écran.
- Décor CSS et icônes masqués aux technologies d’assistance ; statut écrit pour chaque étape, titres sémantiques, liens natifs accessibles au clavier. Aucun défilement animé ou animation propre à la roadmap. Les transitions décoratives de découverte sont neutralisées en mouvement réduit.
- Confiance simplifiée visuellement, informations de stockage/transmission conservées, lien vers la politique complète. FAQ en `details`/`summary`.
- Introduction d’inscription redondante retirée : un seul formulaire avec ses deux cartes et son propre titre. Transport, validation, consentement et confirmations exactes **« Tu fais partie de l’aventure. » / « You are part of the journey. »** inchangés ; voir `docs/signup.md`.
- CSS entièrement préfixé `.discovery-page` dans `components/discovery.css`, sans modification des styles globaux, autres routes ou composants partagés.

## Vérification

```bash
cd /Users/kaba/Clients/nexo-landing
node --test test/*.test.mjs
npx tsc --noEmit
npm run lint
npm run build
```

`test/discovery.test.mjs` rend les deux langues avec le renderer React serveur et les vrais composants découverte/roadmap/icônes. Seuls Next Image/Link et les feuilles interactives preview/signup sont adaptés ; les tests signup existants vérifient leur propre comportement. Couverture : ordre, statuts, distinctions, garde-fous des rappels, ancres existantes, liens, absence d’immersion embarquée, un seul signup, sélecteurs CSS isolés. Ces tests ne prouvent pas la géométrie ou le focus dans un navigateur.

### Sélecteurs pour la validation navigateur finale

| Sélecteur | Contrôle |
| --- | --- |
| `.discovery-page` | Langue et absence de débordement horizontal |
| `#accueil a[href="/experience"]` | CTA principal démo |
| `#accueil a[href="#inscription"]` | CTA liste d’attente |
| `#possibilites article` | Trois bénéfices sans grille de cartes |
| `#parcours` / `#roadmap` | Ancienne ancre conservée / alias explicite roadmap |
| `#roadmap-title`, `#roadmap-note` | Titre localisé, vision évolutive sans dates |
| `[data-roadmap-step]` | Cinq étapes dans l’ordre |
| `[data-roadmap-step="reminders"]` | Rappels planifiés, consentement et contrôle |
| `[data-roadmap-step="classic-plush"]` | Classique non connectée avant connectée |
| `[data-roadmap-step="connected-plush"]` | Exploration lointaine sans specs |
| `[data-roadmap-status]` | Statuts textuels, pas seulement une couleur |
| `.discovery-page fieldset button[aria-pressed]` | Choix Ciel/Noir de l’aperçu |
| `#faq summary` | Ouverture au clavier |
| `#inscription [data-signup-state]` | Formulaire conservé ; scénario mocké de `docs/signup.md` |

Validation navigateur laissée au parent : FR/EN, 1440×900, 1024×600, 390×844, 320×568, paysage, zoom 200 %, clavier, mouvement réduit, ancres sous navigation sticky. Ne pas utiliser les pages partagées ou relancer les serveurs depuis ce travail. Après `npm run build`, le parent doit redémarrer les previews de production existantes 3107/3109 avant ce contrôle. Ne pas soumettre de coordonnées au backend réel ; intercepter le transport selon `docs/signup.md`.
