# Nexo — deux portes, FR / EN

Frontend indépendant : Next.js App Router, React, TypeScript strict, Tailwind v4, shadcn/ui. Dépôt : [Mahamadou29/nexo-landing](https://github.com/Mahamadou29/nexo-landing). Le frontend est séparé des projets Flutter et backend. Branding, compagnons et police locale existants uniquement.

## Expérience mobile

Sous 768 px, les trois parcours adoptent une présentation de type application, sans modifier la mise en page desktop décrite ci-dessous :

- Accueil avec invitation visible et deux cartes tactiles libellées, sans dépendre du survol. Le décor typographique est masqué sur mobile.
- Header compact persistant, sélecteur FR/EN de 44 px et navigation inférieure Accueil / Découvrir / Mon instant. Dans l’expérience, cette barre devient Humeur / Vidéo / Démo / Inscription, avec l’étape active indiquée.
- Humeur avec action explicite pour déposer les mots ou continuer sans écrire ; vidéo et champ dans le flux ; activités en grille de cartes ; formulaire accessible par défilement normal.
- Découverte avec liens de section défilants, CTA pleine largeur et sections plus compactes. Les aperçus restent illustratifs.
- Marges de sécurité iOS, viewport dynamique, zoom autorisé et champs d’au moins 16 px. La barre inférieure se masque pendant la saisie pour laisser de la place au clavier. Le contenu et les liens légaux gardent une réserve en bas de page.
- Consentement toujours facultatif et limité à l’accueil, sans changement des traitements de données. Les détails et les contrôles restent dans le flux, avec des cibles tactiles de 44 px.

Les écrans courts restent défilables. Les animations restantes respectent la préférence de réduction des mouvements. Aucun mode PWA, téléchargement ni accès à un compte n’est ajouté.

## Routes

- `/` : le mot « nexo. » reste dans le header sur toutes les pages, accueil compris, avec le sélecteur FR/EN en haut à droite. Aucun titre visible ni encadrement sous les deux avatars cliquables. Ciel ouvre la découverte ; Noir ouvre l’expérience. En bas de page : liens légaux et petits contrôles de consentement à puces verte/rouge, toujours libellés et accessibles au clavier. Les explications du consentement sont dépliables.
- `/decouvrir` : ancienne landing conservée, traduite et formulaire remplacé par la vraie liste d’attente. Le second logo (étoile dans un cercle et mot Nexo) est supprimé de la navigation interne ; les liens de section et l’inscription restent disponibles. Aperçus toujours explicitement illustratifs.
- `/experience` : humeur facultative locale → rencontre vidéo → activités → liste d’attente facultative. Champ crème légèrement distinct du fond, texte centré et couleur identique au placeholder, sans recoloration au focus. Entrée vide immédiatement le champ et dépose **uniquement le dernier texte** comme un tampon sans contour : bref impact de 360 ms, légère inclinaison, puis immobilité. La date et l’heure locales de validation apparaissent en miniature sous le texte ; elles ne changent ni avec le temps ni lors d’un changement de langue. Aucun déplacement, bulle ou bourgeonnement. L’empreinte occupe la marge gauche sur grand écran, une bande réservée au-dessus du contenu sur tablette et un emplacement dans le flux sous la vidéo sur mobile : elle ne peut pas recouvrir le lecteur. Les textes longs sont limités visuellement à deux lignes (une sur écran court), mais restent complets pour les lecteurs d’écran. La réduction des mouvements supprime l’impact. Le champ descend en douceur sous la vidéo, accepte de nouveaux textes et disparaît dès les activités. Son bouton Entrée reste centré verticalement à l’intérieur du champ, à gauche de Ciel, avec une réserve de place pour le texte sur desktop comme sur mobile. La dernière empreinte survit aux changements d’étape et de langue ; quitter `/experience` ou recharger l’efface, sans stockage ni envoi du texte ou de l’horodatage. Hors des champs et contrôles, →/↓ avance et ←/↑ revient ; les raccourcis préservent la saisie, les onglets et les commandes média. Entrée à vide permet de passer directement sans modifier l’empreinte. La lecture externe exige toujours une action explicite. Logo pour revenir aux portes ; sélecteur FR/EN en haut de page. Labels, titres et annonces restent accessibles aux lecteurs d’écran.
- `/confidentialite`, `/conditions` : comportement réel et avertissements de publication, en français/anglais.

Le pied de page est réduit à un petit bloc aligné en bas à droite : texte de 11 px, espacements resserrés, choix statistiques avec détails dépliables et petits boutons côte à côte, puis liens légaux. Il reste dans le flux de la page pour ne jamais recouvrir le contenu, y compris sur mobile et lorsque les détails sont ouverts. Les cibles interactives mesurent au moins 24 px de haut. Le panneau d’autorisation statistique et ses messages d’état s’affichent **uniquement sur l’accueil**. Depuis les autres pages, le lien Statistiques y ramène et place le focus sur les paramètres ; acceptation, refus et retrait restent accessibles. Les détails et messages d’état conservent un texte de 12 px.

Le parcours `/experience` est **plein écran sans défilement de page sur desktop (dès 1 024 px)**. Le pied de page du parcours occupe toute la largeur : **Les deux portes · Confidentialité · Conditions · Statistiques** à gauche et **Humeur · Vidéo · Démo · Inscription** à droite, sur la même ligne dès 640 px. Sur petit écran, les deux groupes se superposent sans débordement. La présentation reste discrète, avec l’étape active indiquée ; les autres pages conservent leur pied de page compact. Les flèches latérales et le bouton de passage à l’inscription dans les activités sont retirés ; les onglets d’activité restent dans la démo et FR/EN reste en haut. Chaque étape est directement accessible ; passer d’Humeur à Vidéo libère le texte saisi. La vidéo s’adapte à l’espace au-dessus du champ ; les flèches clavier droite/bas avancent et gauche/haut reculent sans effacer les empreintes. Elles restent réservées à l’édition dans les champs, aux onglets et aux médias. Les formulaires et activités longs disposent d’un défilement interne accessible, sans masquer les contrôles ou erreurs ; le défilement de page reste disponible sur mobile.

## Décor animé de l’entrée

Une invitation centrée est **tamponnée en quatre impacts silencieux**, un groupe de mots à la fois, au survol ou au focus clavier. Pas de fondu global, de son, de flash ni de secousse de page. Séquences issues de `lib/door-invitation.ts`, via le sélecteur FR/EN existant :

| Porte | FR | EN |
| --- | --- | --- |
| Ciel | Découvrir / ce que / Nexo / peut faire. | Discover / what / Nexo / can do. |
| Noir | Vis / un moment / avec / Nexo. | Share / a moment / with / Nexo. |

Les départs CSS sont à **0 / 130 / 260 / 390 ms**. Chaque empreinte dure **220 ms** : approche à ×1,16, contact puis stabilisation. Six grains de poussière s’écartent pendant **260 ms**, à partir de +45 ms. Dernière empreinte stable à **610 ms**, dernière poussière disparue à **695 ms**. Rotations **−4° / +3° / −2° / +4°**, tailles adaptées à l’espace disponible, emphase sur Nexo. Les empreintes et poussières utilisent les bleus de Nexo : marine, bleu ciel assombri et bleu accent, sans couleur ajoutée. Aucun son, asset, dépendance, timer ou rendu React par image ajouté.

L’accueil seul occupe **100dvh, sans défilement de page**. Les avatars sont centrés sur l’écran, indépendamment du message. Les invitations sont ancrées dans la partie basse, juste au-dessus des contrôles de consentement. Les deux phrases réservent la même cellule de grille, même masquées : aucun déplacement à l’activation. Tailles, espacements et hauteur du header se réduisent sur les écrans courts. Les détails de consentement restent accessibles dans une zone de footer à défilement interne si nécessaire ; rien n’est simplement coupé. Les autres routes conservent leur défilement normal. Les avatars et leurs portails ne sont pas transformés par les impacts.

Un seul message est visible : **focus clavier > appui > survol**. Les sélecteurs `:has` retirent entièrement les noms d’animation quand une phrase est masquée : annulation des impacts en attente et redémarrage au prochain survol/focus, sans boucle quand le pointeur reste en place. Passer du focus au survol sur la même porte déjà active ne relance pas la séquence. Les liens référencent une phrase complète persistante `sr-only` via `aria-describedby` ; tous les groupes visuels et poussières sont `aria-hidden`, sans annonce live répétée. Avec réduction des mouvements, la phrase active est immédiatement complète et statique, sans poussière. L’appui tactile conserve la navigation directe, sans attendre l’animation.

### Vérification ciblée des invitations

`node --test test/door-invitation.test.mjs` contrôle les quatre séquences, les contrats CSS de rythme/reset/priorité et la structure accessible ; il ne remplace pas un test navigateur. Repères stables pour la vérification parent : `.door-avatar-row`, `.door-invitation-stage`, `[data-door="ciel"|"noir"]`, `[data-invitation="ciel"|"noir"]`, `[data-beat="0"…"3"]`, `.door-stamp-ink`, `.door-stamp-dust`.

- FR puis EN, 320 / 390 / 640 / 1 280 px : vérifier le retour à la ligne, `scrollWidth === clientWidth`, la distance à la rangée et l’absence de recouvrement du footer, détails du consentement ouverts inclus.
- Survol Ciel > 2 s : quatre contacts, aucune répétition ; sortie/retour puis Ciel → Noir → Ciel pendant les impacts : annulation et nouveau départ. Vérifier `getAnimations()` sur les descendants : aucune animation d’invitation masquée.
- Tab sur une porte, survol simultané de l’autre : seule la phrase de la porte au focus apparaît ; Tab/sortie du focus rétablit la porte survolée. Comparer les boîtes avatars/footer avant, pendant et après pour exclure un décalage de mise en page.
- Réduction des mouvements avant chargement et pendant la séquence : phrase active complète immédiatement, poussières absentes. Lecteur d’écran : nom du lien + description complète, pas de lecture groupe par groupe. Toucher : une pression ouvre directement la destination.
- Vérifier les portails, les quatre variantes GSAP et leur pause, le sélecteur de langue et les contrôles du footer : leurs composants/comportements ne sont pas modifiés par cette invitation. Aucun navigateur ni serveur de prévisualisation n’a été lancé/redémarré pour cette modification.

Au survol et au focus clavier, les avatars restent parfaitement immobiles. Un portail lumineux suit leur silhouette transparente : cyan pour Ciel, ambre pour Noir, liseré mobile, halo diffus et écho qui s’ouvre derrière le personnage. Les masques réutilisent les images locales, sans nouvel asset ni dépendance. La lumière effectue un tour en 2,8 s ; les animations sont suspendues hors interaction et le halo s’éteint en 280 ms. Au toucher, l’effet accompagne l’appui sans retarder la navigation. Avec réduction des mouvements, seul un halo fixe reste visible ; le contour de focus clavier est conservé.

Uniquement sur `/`, un décor GSAP derrière les avatars, sans intercepter les clics et masqué aux lecteurs d’écran. Une seule expression à la fois : **Respire / Ressens / Sois toi**, ou **Breathe / Feel / Be yourself** via le sélecteur FR/EN existant. Encre issue du token existant `--entrance-ink`. **Aucune peinture**, projection, texture de grain, couleur de peinture ou effacement global ; aucun média, service externe ou dépendance ajouté.

La boucle dure exactement **84 s**, six passages de **14 s** :

| Temps | FR / EN | Chorégraphie | Ordre des lettres |
| --- | --- | --- | --- |
| 0–14 s | Respire / Breathe | Zoom vers le spectateur | gauche → droite |
| 14–28 s | Ressens / Feel | Dispersion latérale | droite → gauche |
| 28–42 s | Sois toi / Be yourself | Pliage en traits | gauche → droite |
| 42–56 s | Respire / Breathe | Évaporation progressive | droite → gauche |
| 56–70 s | Ressens / Feel | Zoom vers le spectateur | gauche → droite |
| 70–84 s | Sois toi / Be yourself | Dispersion latérale | droite → gauche |

Chaque lettre a ses propres groupes de déplacement et de forme ; **aucune mise à l’échelle du mot entier**. Les entrées démarrent à 0,15 s, décalées de 0,08 s, et durent 1,65 s. Après composition, les sorties démarrent à 3,1 s, décalées de 0,62 s (espaces exclus), dans l’ordre indiqué. Les durées de sortie sont propres aux variantes :

- **Zoom — 2,9 s par lettre** : arrivée oblique depuis une échelle de ×0,18, puis avancée puissante jusqu’à **×8 / ×9,5 / ×11** avec rotations et foyers individuels. À 65 % du trajet commence le passage hors axe au-delà de la caméra, toujours en croissance. Les glyphes restent opaques et sortent entièrement du cadre ; **ni pores ni fondu**. La destination tient compte des dimensions réelles du glyphe agrandi et tourné.
- **Latéral — 2,7 s** : entrée depuis le haut/bas, taille naturelle ; léger recul pendant 28 % de la sortie, puis départ accéléré en éventail vers les deux bords, hauteurs et rotations différentes. Disparition hors cadre, **sans dissolution ni agrandissement**.
- **Pliage — 2,65 s** : dépliage de traits alternant axes horizontal et vertical ; sortie par compression et inclinaison pendant 2,1 s, puis contraction des traits jusqu’à une taille nulle pendant 0,55 s. **Pas de fondu**.
- **Évaporation — 3,2 s** : apparition douce ascendante ; les lettres montent légèrement en se désagrégeant du bas vers le haut. Neuf pores elliptiques locaux déterministes par lettre, réservés à ce passage : délai de 0,65 s, croissance sur 2,03 s, décalage de 0,065 s. Le masque finit par consommer intégralement chaque glyphe ; **aucun masque partagé**.

Les espacements réels sont mesurés après chargement de la police ; les espaces sont préservées mais ne sont pas animées. Toutes les lettres FR/EN ont fini avant 12 s ; le reste du passage est vide (au moins 2 s de repos, davantage pour les mots courts), sans fondu collectif final. Le prochain passage commence à 14 s. Aucun flash intentionnel, filtre animé ou boucle de calcul React par image.

Petit bouton pause/reprise en bas à gauche **du bloc des portes**, séparé du consentement : Tab puis Entrée/Espace, libellé et infobulle traduits. L’onglet masqué suspend la timeline ; le retour respecte une pause manuelle. Le choix de pause survit au changement de langue (pas à la sortie de route). `prefers-reduced-motion: reduce` masque entièrement le décor et le bouton, empêche le chargement initial de GSAP et détruit toute animation déjà active si la préférence change. Démontage et changement de langue neutralisent le résultat d’un import encore en attente, retirent l’écoute de visibilité et rétablissent les attributs/styles via `gsap.context().revert()`. Décor et débordements sont confinés au bloc des portes ; header et footer restent inchangés dans le flux. Sans JavaScript ou si le chunk GSAP échoue, les portes restent seules et utilisables.

## Bibliothèque média partagée

Les originaux réutilisables sont centralisés dans [`../nexo-media`](../nexo-media), avec un catalogue de provenance. Les dossiers Codex restent inchangés. Seules les versions web effectivement utilisées sont copiées dans `public/` ; la bibliothèque complète n’est pas exposée sur le site.

Le champ utilise `public/media/companions/ciel-head-on-hands.webp`, dérivé de [`nexo-ciel.png`](../nexo-media/companions/head-on-hands/v1/nexo-ciel.png), pose « tête sur les mains » v1 choisie par l’utilisateur. Source initiale : `2026-10-03/j/outputs/nexo-tete-sur-mains-v1` dans Codex. L’export web conserve la transparence, retire uniquement les marges transparentes et réduit à 480 pixels de large (WebP, qualité 88). Pour changer de pose, partir de la bibliothèque partagée, puis mettre à jour ce dérivé et ses dimensions dans le composant.

Régénérer cet export depuis la racine de la landing (Sharp est déjà fourni par Next.js) :

```bash
node --input-type=module -e "import sharp from 'sharp'; await sharp('../nexo-media/companions/head-on-hands/v1/nexo-ciel.png').trim().resize({width:480,withoutEnlargement:true}).webp({quality:88}).toFile('public/media/companions/ciel-head-on-hands.webp');"
```

### Illustrations des activités

Les quatre choix autour de Noir utilisent maintenant des poses Nexo plutôt que des pictogrammes. Les mêmes poses illustrent les vues Voix/Chat ; Rose accompagne la détente et Ciel alterne inspiration/expiration avec le guide 4/6 secondes. Le chronomètre et les consignes restent du vrai texte accessible. Les pictogrammes sont conservés uniquement pour les petits contrôles fonctionnels. Aucun nouveau visuel à générer n’est nécessaire pour cette version.

Cinq dérivés transparents 480 × 480, WebP qualité 88, sont livrés dans [`public/media/demo/`](./public/media/demo/) :

| Export | Original de la bibliothèque |
|---|---|
| `ciel-speak.webp` | [Ciel parle](../nexo-media/companions/media-v1/masters/characters/ciel/speak.png) |
| `noir-listen.webp` | [Noir écoute](../nexo-media/companions/media-v1/masters/characters/noir/listen.png) |
| `rose-meditating.webp` | [Rose médite, v2](../nexo-media/companions/meditation/v2/nexo-rose-meditating.png) |
| `ciel-inhale.webp` | [Ciel inspire](../nexo-media/companions/media-v1/masters/characters/ciel/inhale.png) |
| `ciel-exhale.webp` | [Ciel expire](../nexo-media/companions/media-v1/masters/characters/ciel/exhale.png) |

Recette Sharp commune : `trim().resize(480, 480, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 88 })`. Elle préserve les proportions et centre les silhouettes sur un carré transparent, sans toucher aux PNG ni au catalogue partagé. `next/image` sert les tailles adaptées ; les deux poses respiratoires sont chargées à l’ouverture de l’exercice pour éviter une apparition tardive au changement de phase. Leur fondu est désactivé avec la réduction des mouvements.

Le choix de langue reste en mémoire durant la navigation, sans cookie ni stockage. Un rechargement repart en français. La locale ne déclenche pas un événement statistique supplémentaire.

## Exécution

Node **22.18+**, npm. Copier les valeurs de `.env.example` vers `.env.local` si nécessaire :

```dotenv
NEXT_PUBLIC_NEXO_API_URL=http://127.0.0.1:8787
```

Cette URL publique est intégrée au build ; reconstruire si elle change. Aucun secret dans une variable NEXT_PUBLIC_. En production, API et site doivent utiliser HTTPS (microphone et absence de contenu mixte).

```bash
npm ci
NEXT_TELEMETRY_DISABLED=1 npm run dev -- --hostname 127.0.0.1 --port 3107
npm test
npx tsc --noEmit
npm run lint
NEXT_TELEMETRY_DISABLED=1 npm run build
NEXT_TELEMETRY_DISABLED=1 npm run start -- --hostname 127.0.0.1 --port 3107
```

Ne pas lancer deux serveurs sur 3107 ; ne pas faire tourner dev et build simultanément dans le même dossier. L’ancien processus de prévisualisation (PID 88449, dossier confirmé) a été remplacé sur autorisation par le nouveau build sur http://127.0.0.1:3107, session attachée `landing-updated-preview`. Les cinq routes répondent HTTP 200 avec les nouvelles portes ; GET config Django et CORS pour cette origine sont vérifiés. La page navigateur partagée n’a pas été naviguée.

## Django direct, sans backend Next

Aucune Route Handler, Server Action, proxy ou base de données Next. Les pages sont pré-rendues statiquement ; leurs composants interactifs appellent directement Django, sans cookies/credentials et sans referrer. Django doit autoriser CORS pour les origines frontend exactes (ex. http://127.0.0.1:3107, et séparément localhost si utilisé), OPTIONS/GET/POST et Content-Type. Ne pas utiliser un proxy Next pour contourner CORS.

Préfixe : `/api/v1/landing`, sans slash final :

| Endpoint | Usage |
| --- | --- |
| GET /config | video_url, privacy_contact, controller_name, policy_version 2026-10-20, demo_enabled, realtime_enabled (absent ⇒ false) |
| POST /events | door_enter, door discover/experience, UUID visiteur/session, locale, consent true, policy_version ; 201 requis |
| POST /events/withdraw | visitor_id seulement ; 200 ou 204 confirment la suppression |
| POST /waitlist | email OU phone, note facultative, locale, consent true, policy_version ; exactement 201 avec status registered |
| POST /demo/chat | locale, messages user/assistant, consent true ; flux texte avec sentinelle erreur LF + NUL + ERROR |
| POST /demo/transcribe | API historique inchangée : multipart file, language, consent=true ; JSON text (non utilisée par la nouvelle activité Voix) |
| WS /demo/realtime | Voix bidirectionnelle PCM16LE mono 24 kHz, accord explicite, 120 s maximum |

La configuration est chargée côté navigateur car elle est publique et l’application ne possède aucun serveur applicatif Next. En cas de panne ou de version de politique inattendue, la vidéo locale dans la langue choisie reste disponible et la démo distante est désactivée. Les exercices locaux restent utilisables. Chat/voix désactivés par défaut, erreurs 503/réseau explicites, jamais de réponse simulée. Le backend valide aussi les champs, limites et consentements.

## Vidéo et activités

Les vidéos fournies sont servies depuis `public/media/video/nexo-video-fr.mp4` et `public/media/video/nexo-video-en.mp4`, selon le sélecteur FR/EN. Les originaux à la racine sont conservés. À l’arrivée dans l’étape Vidéo, la vidéo locale démarre automatiquement avec le son. Si le navigateur le refuse, une deuxième tentative muette affiche « Activer le son » ; si toute lecture automatique est bloquée, un bouton de lecture reste disponible. Le changement de langue arrête l’ancienne vidéo et redémarre la nouvelle depuis le début. Ces fichiers statiques restent disponibles sans backend ; aucune nouvelle fonctionnalité serveur Next n’est ajoutée.

`components/introduction-video.tsx` gère le lecteur et un fondu de 700 ms vers la démo à la fin (immédiat en mouvement réduit). Une projection floutée des images réelles de la vidéo prolonge ses couleurs derrière la page, sans second lecteur : canvas local 64×36, au plus 8 dessins/seconde, callbacks vidéo ou RAF de repli. Les commandes restent contrastées. L’ambiance se fige en mouvement réduit et s’arrête de calculer en pause ou onglet masqué. Changer d’étape/langue nettoie la lecture, les callbacks, écouteurs et temporisateurs ; quitter pendant le fondu annule la navigation différée.

Une URL `video_url` valide configurée côté Django reste une surcharge commune aux deux langues ; la laisser vide pour les deux vidéos locales. Une URL HTTPS de fichier .mp4/.webm/.ogv, YouTube (convertie vers youtube-nocookie) ou Vimeo est acceptée ; les autres iframes sont refusées. HTTP est permis uniquement pour localhost/127.0.0.1 en développement. Seules les surcharges externes restent derrière un bouton explicite avant chargement, avec leur avertissement d’hébergement externe. Elles ne participent pas au canvas local. Fin HTML5 et événements de fin iframe vérifiés (origine + fenêtre source) conduisent à la démo ; l’étape Démo reste directement accessible. Certains bloqueurs/lecteurs empêchent les événements iframe : utiliser cette navigation. Les fichiers de sous-titres et l’alternative textuelle restent à fournir avant publication accessible.

La démo s’ouvre sur une scène épurée : Noir au centre, Voix, Chat, Détente et Respiration autour. Les choix indiquent la durée des exercices locaux ou l’indisponibilité du service distant, sans bloquer l’accès à son explication. Une activité s’ouvre dans un espace dédié avec un menu compact pour changer d’activité et « Les activités » pour retrouver la scène. Le focus entre dans le panneau à l’ouverture puis revient au choix d’origine au retour ; les onglets conservent les flèches gauche/droite, Début et Fin. Quitter une activité démonte ses ressources existantes. Sur desktop, seuls les contenus trop longs défilent dans le panneau, en gardant le menu et le pied de page visibles. Respiration propose un guide typographique ample, deux poses du compagnon et une forme organique qui suit le souffle. Détente présente Rose au milieu de fines ondes bleu ciel, bleu-gris et marine qui s’élargissent et s’effacent comme des gouttes sur l’eau, avec des phrases originales à ses côtés. Dans ces deux activités, chronomètre et commandes restent regroupés en bas ; le bouton garde sa largeur et change de couleur selon l’état. Les scènes s’adaptent au viewport sans défilement, y compris sur mobile. Aucun son, microphone ou envoi ne démarre à l’ouverture ; les mouvements décoratifs respectent la réduction des animations.

Vidéo non disponible à ce jour : emplacement temporaire explicitement validé par l’utilisateur, annoncé comme en attente, sans faux lecteur. Aucun média n’est requis pour continuer le parcours. Respiration locale : inspiration de 4 secondes puis expiration de 6 secondes, sans rétention, six cycles sur une minute. Démarrage, arrêt et nouvelle session explicites ; quitter l’onglet ou l’activité arrête l’exercice sans reprise automatique. Animation et poses synchronisées avec l’horloge, guide statique en mouvement réduit. Voir [le fonctionnement de la respiration](docs/breathing.md). Détente : cinq phrases originales FR/EN, sans attribution, changent toutes les 24 secondes pendant une session de deux minutes. Le bouton explicite démarre un fond sonore WebAudio local à faible volume, sans micro ni envoi. Chronomètre visible, arrêt manuel, nouvelle session possible après la fin ; quitter l’onglet, l’activité ou la langue arrête le son, sans reprise automatique. Vagues statiques et changement de phrase sans transition en mouvement réduit. Voir [le cycle de vie et les contrôles navigateur](docs/relaxation.md). Les contextes audio, microphones, requêtes et timers sont nettoyés en quittant les activités. Voix : échange audio bidirectionnel avec Azure via le serveur Nexo, après accord et clic explicites. Aucun sous-titre ni transcription ; aucun SpeechRecognition tiers direct. Le chat et son API historique restent inchangés. Les activités distantes sont chargées dans le composant de démo ; pas de dépendance média supplémentaire.

## Voix temps réel — frontend uniquement

- Activation indépendante : `realtime_enabled` pour Voix, `demo_enabled` pour Chat. Les deux sont désactivés par défaut ; un serveur ancien sans `realtime_enabled` garde la voix désactivée. Aucun environnement ni flag serveur modifié ici.
- URL : contrepartie WS/WSS de `NEXT_PUBLIC_NEXO_API_URL` (repli `http://127.0.0.1:8787`), chemin absolu `/api/v1/landing/demo/realtime`. Aucune clé Azure ni auth en query string. Les URL avec credentials, query ou fragment sont rejetées. WebSocket natif peut transmettre des cookies applicables au domaine : ne pas utiliser de cookie de session pour cette démo publique ; validation Origin, limites et protections contre les abus relèvent du backend.
- Un clic sur « Accepter et commencer » crée/reprend AudioContext et demande le micro (echoCancellation/noiseSuppression). Aucun micro ni son à l’entrée. HTTPS (ou localhost), WebSocket, AudioWorklet et autorisation micro requis. Le worklet local `public/audio/nexo-pcm-worklet.js` convertit en continu le sampleRate réel vers mono PCM16 little-endian 24 000 Hz, avec état fractionnaire entre quanta. Trames binaires de 4 800 octets maximum, longueur paire ; aucune dépendance audio.
- À l’ouverture : JSON `{type:"start",locale:"fr"|"en",consent:true}`. L’envoi PCM attend `{type:"ready",max_seconds:120}`. Contrôles JSON : `{type:"mute",muted:boolean}`, `{type:"stop"}`, `{type:"interrupt",item_id:string,audio_end_ms:integer}`. Couper le micro désactive aussi les pistes et invalide les chunks en transit/partiels ; la sortie reste audible.
- Serveur : JSON `audio` (audio base64 PCM16LE24k + item_id), `speech_started`, `speech_stopped`, `audio_done` (item_id), `error` (unavailable/connection/protocol/limit), `ended` (time_limit/stopped). Aucun texte de conversation affiché ou simulé. À speech_started, annulation des buffers et interrupt avec durée réellement jouée (horloge de sortie/latence, pas durée planifiée). Le serveur VAD doit annuler sa génération. Les chunks tardifs des items interrompus sont ignorés.
- Les réponses peuvent être générées plus vite qu’elles ne sont écoutées : la file de lecture accepte jusqu’à 120 s / 4 096 buffers (environ 11,5 Mo de PCM décodé), au lieu d’arrêter un échange normal dès 8 s d’avance. Backlog WebSocket à 64 Kio et worklet à deux chunks non acquittés ; dépassements réseau/lecture arrêtent toujours la session. Les interruptions jettent immédiatement l’audio non écouté. Délai micro 15 s, préparation/connexion 10 s ; budget maximal inchangé de 120 s depuis le clic (connexion incluse), même si de l’audio reste en file, sans reconnexion automatique. Le serveur doit imposer lui aussi la limite.
- Arrêt/error/timeout, retrait d’accord, changement langue/activité/étape/route, onglet masqué ou pagehide : socket fermée, sources audio arrêtées, worklet déconnecté, AudioContext fermé, toutes les pistes arrêtées. Une permission micro résolue tardivement est immédiatement libérée. Le retour dans la page ne redémarre rien.
- L’interface FR/EN garde un accord explicite court pour le traitement de la voix, les commandes et l’état de l’échange, sans mention du prestataire technique. Un lien direct vers `/conditions#conversation-vocale` donne les détails : transmission continue, prestataire Azure, conservation, durée, accessibilité et conditions d’arrêt. Ces informations restent aussi dans la confidentialité ; aucune rétention nulle par Azure n’est promise. Aucun contenu en logs, stockage navigateur ou statistiques ; uniquement mémoire volatile. Le backend séparé doit garantir cette absence de conservation et l’exploitant doit vérifier les conditions Azure, la région et les transferts avant activation.
- La scène à quatre activités, les onglets et les médias sont conservés. La voix utilise l’illustration existante et le défilement interne du panneau desktop, avec accord, états, minuterie non annoncée chaque seconde, boutons clavier, arrêt et sourdine. Aucun sous-titre/transcript dans cette version : le chat écrit reste une alternative si activé.

### Interface voix centrée (FR / EN)

`components/realtime-voice.tsx` présente Ciel sur l’axe central, un microphone SVG épuré juste dessous (« Accepter et commencer » / « Agree and start »), et le compte à rebours incliné, agrandi et décalé à droite au milieu de la scène sur tablette et ordinateur. Sur petit écran, il reste à droite du personnage avec une taille adaptée. Le timer est positionné indépendamment pour ne pas décentrer le personnage ; sa taille diminue aussi sur desktop court. Le microphone s’efface progressivement pendant que l’onde se déploie depuis son centre ; la transition s’inverse à l’arrêt. Le bouton au repos n’a plus de fond en mosaïque. Ce clic exprime l’accord au traitement de la voix et déclenche la demande de microphone, sans case supplémentaire. Une courte mention reliée au bouton par `aria-describedby` et le lien `/conditions#conversation-vocale` précisent ce choix au centre du pied de page : sur la même ligne que les deux groupes de navigation à partir de 1 280 px, puis sur une ligne centrée dédiée aux largeurs inférieures pour éviter les chevauchements. Ce portail n’est monté que dans l’activité Voix ; rien ne reste sous le bouton. Pendant l’échange, seul le lien reste dans cet emplacement. Aucun accord n’est persisté : chaque session nécessite une nouvelle activation explicite, et Arrêter retire l’accord pour la session. Le badge « AI demo » / « Démo avec une IA » est supprimé ; la nature du service reste expliquée dans les conditions, sans nom de prestataire dans les commandes.

Pendant la connexion et l’échange uniquement, le démarrage est remplacé par deux commandes discrètes (micro et arrêt), avec cibles de 44 px, noms FR/EN, infobulles et `aria-pressed` pour la sourdine. Le focus suit le remplacement d’une commande utilisée, sans quitter le panneau. Les erreurs, l’état annoncé et la minuterie non live restent disponibles ; le retrait d’accord et les arrêts de cycle de vie sont inchangés. La colonne reste centrée sur desktop et mobile ; sur écran desktop court, le panneau existant défile intérieurement, pas le document.

`components/voice-waveform.tsx` expose `VoiceWaveformSvg` : 23 colonnes (19–27 configurables), chacune de sept petites cellules organiques au maximum, sous Ciel et avant l’état du microphone. Pas de tube, contour, fond ni ombre ; les cinq tokens `--voice-cell-1` à `--voice-cell-5` interpolent de gauche à droite `#ADD6E6`, `#80AABD`, `#556F7D`, `#35414A`, `#222428`. Chaque colonne garde sa teinte, avec un modelé radial soyeux discret (éclaircissement 13 %, bord assombri 6 %, strictement dans la cellule). `lib/voice-cell-geometry.ts` compose six formes de galets/haricots charnus, des tailles variables, un empilement irrégulier et trois crêtes inégales séparées de creux ; plus de grille de petits points façon égaliseur. Identités et chemins fixes, amplitude/visibilité progressives et légère déformation selon l’énergie réelle. L’emplacement reste stable entre états : 96 px, 64 px sur desktop court ; le viewBox 600 × 180 évite d’aplatir les galets.

`lib/voice-signal.ts` sépare l’analyse du rendu : RMS, seuil de silence, douze bandes logarithmiques 80 Hz–8 kHz (limitées à Nyquist), sensibilité, attaque/relâchement temporels. `onWaveform` conserve les deux tableaux temporels de 256 points et ajoute `inputFrequency`/`outputFrequency` (128 valeurs en dB chacun, silence `-Infinity`) et `sampleRate`. Les quatre tableaux et l’objet sont réutilisés à 30 Hz ; les caractéristiques sont extraites immédiatement, sans conserver les échantillons. Les deux AnalyserNodes et le contexte/flux de session existants sont réutilisés, sans capture supplémentaire ni monitoring micro ; seuls les buffers PCM en cours de lecture alimentent l’analyse de sortie. Le SVG ne possède ni ne ferme aucune ressource audio.

Les refs et `requestAnimationFrame` actualisent uniquement les attributs SVG, sans state React par trame ni activité aléatoire. Au repos : cinq petites cellules statiques ; en connexion : les mêmes cellules légèrement plus présentes, sans pulsation ni faux signal. Sourdine : entrée ignorée et enveloppe précédente effacée, sortie toujours représentée. Silence ou absence de nouvelles mesures pendant 180 ms : retour progressif au repos, puis arrêt de rAF. Stop/error/timeout, page masquée/pagehide et démontage annulent le travail visuel ; langue/activité/route conservent leur arrêt de session existant. Le mouvement réduit garde le repos statique. Le texte d’état reste la référence accessible. Réglages et contrat détaillés : [docs/voice-visualization.md](docs/voice-visualization.md).

`node --test test/realtime-voice-ui.test.mjs test/realtime-voice.test.mjs test/voice-signal.test.mjs test/experience-flow.test.mjs` exécute les vrais handlers TSX, les effets SVG, l’analyse et le moteur avec des adaptateurs inertes : accord intégré au clic, FR/EN, focus, sourdine/arrêt, erreurs/minuterie, callbacks périmés, nettoyage, buffers empruntés, bandes fréquentielles, identité des cellules, attaque/relâchement, silence, mouvement réduit et visibilité. L’audio planifié mais non commencé ne produit pas d’activité. Ces régressions ne remplacent pas une vérification visuelle navigateur desktop/mobile ; aucune permission micro ni connexion distante n’est utilisée.

Repères du smoke test navigateur : `[data-voice-ui]` pour la section, `svg[data-voice-waveform]` pour l’onde décorative (`aria-hidden="true"`, sans focus ni annonce live), `[data-voice-controls]` uniquement pendant la connexion/l’échange. Les annonces accessibles proviennent du texte `[role="status"]`, les erreurs de `[role="alert"]` ; `[role="timer"]` reste `aria-live="off"`. À partir de 1 024 px de largeur et jusqu’à 700 px de hauteur, avatar, onde et espacements se resserrent sans ajouter de commandes, sans masquer le consentement et sans réduire les cibles actives sous 44 px. Le défilement interne existant reste disponible si nécessaire.

### Vérification sans périphérique ni Azure

`node --test test/realtime-voice.test.mjs test/landing.test.mjs test/demo-api.test.mjs` utilise seulement des transports, pistes, horloges et contextes mockés ; le worklet est exécuté dans une VM. Couvre payloads binaires et contrôles, rééchantillonnage 16/24/44,1/48/96 kHz, durée jouée/barge-in, saturation, erreurs, timeouts, permissions tardives, callbacks périmés et nettoyage. Les tests de configuration couvrent les flags indépendants et le repli ancien serveur. Compléter avec `npm run typecheck`, `npm run lint`, `npm run build`. Aucun test ne déclenche de microphone ou d’appel Azure. L’interopérabilité réelle, les politiques autoplay des navigateurs et la qualité sonore devront être vérifiées séparément après livraison du backend, avec accord explicite d’un testeur.

## Confidentialité et consentements

- Humeur : mémoire React uniquement, jamais de stockage ni d’envoi, aucun paramètre URL. Après Entrée, le dernier texte et son horodatage local apparaissent comme une empreinte hors du lecteur. Ils restent pendant les changements d’étape, sont remplacés à la prochaine saisie non vide et effacés à la sortie du parcours ou au rechargement. Aucun classement de l’humeur n’est utilisé. Ni diagnostic ni promesse clinique.
- Statistiques : refus par défaut ; pas d’UUID ni de création de stockage analytique avant accord. Accepter/refuser ont le même traitement visuel dans une section non modale. Paramètres disponibles dans le footer.
- Après accord : `nexo.stats.consent.v1` dans localStorage, échéance maximale de 90 jours ; `nexo.stats.session.v1` dans sessionStorage. Permissions périmées/invalides retirées, aucun secours par fingerprinting.
- Les événements observent la destination rendue, pas les clics : porte initiale après consentement, navigation inter-porte, retour arrière et retour depuis les politiques. Ancres, préchargement Next et rerenders de langue ne comptent pas. Aucun historique antérieur au consentement n’est envoyé, aucun retry/stockage de file analytique.
- Retrait : nouvelles émissions stoppées, réponse des événements en vol attendue (pas d’annulation qui pourrait laisser une écriture serveur en transit), POST retrait puis suppression locale. Envois et retrait sont sérialisés en mémoire ; Web Locks coordonne également les onglets compatibles, avec relecture du consentement avant chaque émission. Aucun retry : le backend ne déduplique pas les événements et n’a pas de tombstone de retrait. Une erreur réseau antérieure laisse une incertitude ; même après un 204, le frontend ne promet alors pas l’effacement distant complet. Sans Web Locks, la sérialisation est limitée à l’onglet. Une fermeture d’onglet ou requête serveur restée en transit constitue aussi une limite réelle sans protection backend supplémentaire.
- Liste d’attente séparée : email OU pays + numéro national (Sénégal +221 par défaut en FR/EN ; tous les pays des métadonnées `libphonenumber-js`, numéro normalisé en E.164 sans champ pays envoyé), note 1 000 caractères max, consentement contact distinct obligatoire ; aucun mot de passe ou identifiant statistique dans la requête. Succès uniquement après 201/status registered, champs vidés après confirmation. Voir [les règles téléphone et tests mockés](docs/signup.md).
- Chat/audio : consentement spécifique avant envoi, historique de conversation en mémoire uniquement. Contrat Django : 12 messages maximum, alternance user/assistant, début et fin user, 2 000 caractères par message et 8 000 au total. Une réponse IA dépassant 2 000 caractères reste lisible mais empêche l’envoi du contexte suivant : effacer la conversation pour recommencer (aucune troncature silencieuse). Ne pas partager de contenu sensible. Les prestataires IA et leur rétention doivent être documentés par l’exploitant, même si Django ne conserve pas le contenu.
- Pas de logs frontend de coordonnées, humeur ou conversation. Les logs réseau/hébergement et métriques techniques relèvent de la configuration de l’exploitant.

## Avant toute publication

1. Responsable des données confirmé : **Mahamadou KABA**, contact **ikeecode@gmail.com**. Ces valeurs publiques servent de repli frontend, même si la configuration est inaccessible ou renvoie null ; la configuration Django peut les remplacer. L’adresse juridique, l’hébergement, les prestataires IA, les transferts internationaux et la juridiction applicable restent à valider avant publication. Aucun pays ni adresse n’est inventé ; aucune conformité certifiée n’est revendiquée.
2. Durées confirmées : **90 jours maximum pour les statistiques facultatives**, **12 mois maximum pour les coordonnées et notes waitlist**, avec **effacement anticipé sur demande ou retrait du consentement**. Avant collecte publique, depuis `nexo-backend` avec son environnement Python et la base cible explicitement validés, contrôler `python manage.py cleanup_landing --dry-run`, puis utiliser `python manage.py cleanup_landing`. Installer cette dernière commande dans l’ordonnanceur de production (cron, timer systemd ou tâche planifiée de l’hébergeur), avec l’environnement Django et la base de production corrects. Documenter la fréquence, le responsable, la dernière exécution réussie et les alertes d’échec ; tester les données aux limites de rétention et la procédure d’effacement anticipé. La fréquence et les seuils doivent éviter de dépasser les maxima annoncés entre deux exécutions. Une commande disponible n’est pas une tâche planifiée : **aucune installation de purge automatique en production n’est confirmée par cette livraison frontend**.
3. Vérifier suppression distante, retrait de liste, droits, anti-abus, CORS et absence de journalisation des corps de requête côté backend/proxy. Le frontend ne certifie pas la conformité.
4. Compléter les vidéos FR/EN fournies avec leurs sous-titres et alternatives accessibles ; activer la démo IA uniquement après configuration réelle des fournisseurs.
5. Réaliser les essais navigateur/intégration avec Django, notamment mobile, microphone, médias et navigation arrière. Ne pas confondre tests unitaires mockés et validation fournisseur réelle.
6. Réévaluer les alertes de dépendances de l’outillage déjà signalées dans la version précédente ; aucune correction forcée ou certification de sécurité dans ce travail.
7. Compléter métadonnées canoniques/partage et autoriser l’indexation uniquement au lancement. `robots: noindex/nofollow` reste activé ; ce n’est pas un contrôle d’accès.

## Vérifications de cette livraison

- `npm test` : **72 tests node:test réussis**, dont 5 ciblés sur les mots, le rythme, la suspension en onglet masqué, la pause manuelle et le nettoyage du contrôleur du décor d’entrée. Autres suites : waitlist, consentement, navigation, humeur, API et démo.
- `npx tsc --noEmit`, `npm run typecheck`, `npm run lint`, `npm run build` : réussis ; les cinq routes sont statiques. Aucun redémarrage de prévisualisation ni interaction navigateur pour ce décor ; rendu visuel, masques SVG et clavier à vérifier par le parent.
- Installation de GSAP : npm signale **9 vulnérabilités de sévérité haute** dans l’arbre de dépendances. Aucune correction forcée ni mise à jour sans rapport effectuée.
- Diagnostics IDE : aucune erreur. La découverte de tests et les tâches VS Code ne gèrent pas ce dossier extérieur au workspace courant ; commandes CLI utilisées en remplacement.
- Pas de test navigateur partagé effectué, pas de soumission réelle de contact ni d’appel fournisseur IA validé. Le parent réalise les vérifications navigateur/intégration.

Police Lexend locale : licence dans `public/fonts/Lexend-OFL.txt`. Les composants shadcn existants ont été conservés ; Skeleton ajouté avec la CLI officielle.
