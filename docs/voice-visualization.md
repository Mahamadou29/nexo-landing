# Cellules SVG de l’activité Voix

## Structure et réglages

`VoiceWaveformSvg` (`components/voice-waveform.tsx`) dessine le contenu décoratif du bouton natif de consentement sous Ciel, avant le statut du micro. Les boutons, textes FR/EN, consentement, minuterie, portail de pied de page et navigation restent ceux de `RealtimeVoice`.

- `columns` : 23, borné à 19–27 ; sept cellules possibles par colonne.
- `spacing` : 1, borné à 0,8–1,12 ; conserve la composition dans le viewBox 600 × 180. La largeur des cellules reste bornée pour conserver les interstices.
- `palette` : tuple de cinq couleurs CSS, par défaut `var(--voice-cell-1)` … `var(--voice-cell-5)`, définies dans `app/globals.css` : `#ADD6E6`, `#80AABD`, `#556F7D`, `#35414A`, `#222428`.
- Repos : microphone SVG simple en `--navy`, sans disque ni fond cellulaire. Les cellules sont invisibles ; les tokens bleus de transition et la palette active restent disponibles pendant leur déploiement.
- `deformation` : 0,12, bornée à 0–0,25 ; étirement discret dépendant de l’énergie, jamais du temps seul.
- `sensitivity` : 4, bornée à 0,1–20.
- `silenceThreshold` : RMS 0,008, borné à 0–0,5.
- `smoothing` : `{ attackMs: 65, releaseMs: 240 }`, bornes respectives 1–2 000 et 1–4 000 ms.

Le bouton initial affiche seulement un microphone lisible : capsule pleine, berceau arrondi et pied, sans pavé de cellules. Au clic, le micro se réduit légèrement et s’efface pendant que les galets s’ouvrent depuis son centre. À l’arrêt, le même mouvement s’inverse. Ce fondu avec déploiement remplace volontairement le dessin du micro en mosaïque ; il ne prétend pas transformer point par point le contour du pictogramme.

`lib/voice-cell-geometry.ts` conserve les 161 identités (133–189 selon `columns`), les chemins entièrement courbes et les dimensions actives. Les anciennes poses de placement ne sont plus affichées en coussin : elles sont resserrées au centre (14 % des positions relatives, 20 % des dimensions) avec une opacité initiale nulle. La waveform ne devient visible qu’à l’ouverture de session, puis ne réagit qu’aux mesures audio. Aucun fond, disque, contour englobant ou halo n’est ajouté.

Toutes les cellules ont une clé, un chemin et une correspondance gauche-droite déterministes. Au clic, les mêmes éléments se déplacent, changent de taille et interpolent leur matière en 560 ms. Les identités et chemins restent fixes. En activité, empilement irrégulier, tailles variables, trois crêtes inégales et deux creux restent commandés par les niveaux audio réels ; seuls cinq petits galets sont visibles au silence. La transition de matière ne réécrit les stops des dégradés que pendant le morph, pas à chaque trame audio.

Le SVG conserve son emplacement `h-32` (128 px ; 96 px sur desktop court), son viewBox 600 × 180 et sa largeur responsive. Le microphone reste discret et centré sous l’avatar. Aucun changement de minuterie, de bouton parent, de consentement ou de moteur audio.

## Contrat audio et propriété des ressources

Le handle impératif reçoit `setState({ status, muted })` puis `draw(frame)` ; `draw(null)` efface immédiatement les enveloppes. `RealtimeVoice` transmet les états sans attendre le rendu React et ignore toute trame d’une session terminée/remplacée. Seuls `listening` et `speaking` acceptent des mesures.

`RealtimeVoiceSession.onWaveform` livre un objet emprunté, réutilisé environ 30 fois par seconde :

- `input`, `output` : deux `Float32Array` de 256 points temporels, nominalement −1 à 1 ;
- `inputFrequency`, `outputFrequency` : deux `Float32Array` de 128 bins en décibels, silence à `-Infinity` ;
- `sampleRate` : fréquence réelle de l’AudioContext, pas systématiquement les 24 kHz du transport PCM.

Les AnalyserNodes restent dans le graphe existant : micro → analyseur entrée → worklet silencieux → destination ; PCM → analyseur sortie → destination. Aucun second flux, contexte ou chemin de lecture n’est ajouté en production. La sortie n’est échantillonnée que lorsqu’un buffer est en cours de lecture, pas à son arrivée réseau ni pendant sa seule planification. La réduction des mouvements n’altère jamais l’audio.

`lib/voice-signal.ts` extrait immédiatement RMS et douze bandes logarithmiques (80 Hz–8 kHz, limitées à Nyquist). La résolution réelle est celle du FFT 256 ; les bandes graves peuvent donc partager un bin, particulièrement à 96 kHz. Il ne s’agit pas d’un analyseur phonétique. Le maximum des contributions entrée/sortie évite leur annulation de phase. Les seuls éléments mémorisés par le rendu sont les douze niveaux/cibles numériques, jamais les buffers audio.

Le lissage attaque/relâchement est indépendant de la cadence d’affichage. `requestAnimationFrame` modifie les refs SVG, pas un state React. Une fois le silence stabilisé, la boucle s’arrête. Après 180 ms sans mesure, la cible devient nulle et décroît ; aucun signal n’est inventé pour remplir une attente.

## États et nettoyage

- Repos hors session : coussin bleu complet et microphone ivoire, immobiles, déjà présents dans le HTML initial.
- Silence pendant une session : cinq petites cellules fixes, transparentes autour.
- Connexion : morph fini vers cinq cellules légèrement plus présentes, puis arrêt de la boucle ; aucun faux signal pendant l’attente.
- Sourdine : effacement immédiat de l’enveloppe précédente, entrée ignorée ; une sortie mesurée peut toujours animer.
- Stop/error/timeout (deux minutes) : retour fini au coussin et à sa matière bleue/ivoire, y compris si le premier morph est interrompu ; nouvelle session uniquement après consentement.
- Hide/pagehide/démontage : annulation de rAF et des listeners ; aucune fermeture de contexte/piste par le SVG. Le moteur continue de posséder et nettoyer ses ressources.
- Langue/activité/route : remount et arrêt existants conservés.
- `prefers-reduced-motion` (y compris changement à chaud) : passage immédiat au bon état visuel, sans morph ni animation audio, état textuel inchangé. Les SVG sont décoratifs, `aria-hidden`, non focusables.

## Vérification

```bash
node --test test/realtime-voice.test.mjs test/realtime-voice-ui.test.mjs test/voice-signal.test.mjs test/voice-cell-geometry.test.mjs test/experience-flow.test.mjs
npm test
npm run typecheck
npx tsc --noEmit
npm run lint
npm run build
```

Les tests UI exécutent le vrai TSX compilé et les effets avec des refs SVG/rAF mockées ; les tests moteur exécutent le vrai moteur et le worklet. Ils vérifient notamment buffers réutilisés, sortie planifiée versus en lecture, sourdine, interruption, absence de double sortie, spectres, attaques/relâchements, absence de React state par trame, formes stables, callbacks périmés et nettoyage. Ce ne sont pas des tests de périphériques physiques ni du fournisseur.

Smoke navigateur : ouvrir un onglet isolé sur un preview du **nouveau build**. Intercepter la configuration pour activer `realtime_enabled` uniquement dans cet onglet ; remplacer `getUserMedia` par un flux local synthétique, le WebSocket par un transport en mémoire et isoler toute destination haut-parleur derrière un gain nul. Tester le vrai AudioContext, les analyseurs, le worklet et la lecture PCM locale sans permission micro, son audible ni appel fournisseur. Un silence PCM reste un test de silence ; pour tester les cellules actives, mesurer un signal synthétique non nul en amont du gain nul. Ne jamais présenter cette fixture comme une conversation vocale réelle.

Repères : `svg[data-voice-waveform]`, `[data-voice-cell]`, `data-voice-phase` (`button`, `connecting`, `active`, `muted`), `[data-voice-controls]`, `[data-voice-notice]`. Contrôler desktop/mobile/desktop court, FR/EN, mouvement réduit, silence, entrée synthétique, sortie synthétique pendant sourdine, retour au repos, arrêt et changement d’activité/langue. Les noms accessibles sont portés par les commandes et le statut, pas par le SVG.

### Nouvelle référence du bouton au repos

Aperçu statique reproductible du **vrai TSX rendu côté serveur** : [voice-rest-preview.svg](./voice-rest-preview.svg). Génération : `node test/render-voice-reference.mjs` ; utilise uniquement les dépendances déjà installées et écrit aussi `/tmp/nexo-voice-rest-preview.png` pour inspection. Les couleurs CSS sont résolues depuis les tokens pour les lecteurs SVG sans `color-mix`. Aucun serveur, contexte audio, micro ou fournisseur n’est invoqué. Cet aperçu ne prétend pas valider une conversation ou le layout complet.

Ajustement aéré : **33/33 tests ciblés** (géométrie, signal, UI, flux), typecheck, lint sans avertissement et build réussis ; empreinte SHA-256 de la géométrie active inchangée. Aperçu SVG régénéré, aucun redémarrage de serveur.

Vérification de la passe initiale compacte : `npm test` **211/211**, `npx tsc --noEmit`, `npm run lint` et `npm run build` réussis. Le runner intégré à l’IDE ne découvrait pas les fichiers `node:test` ; les suites ont donc été exécutées par la commande du projet. Aucune dépendance ajoutée ; aucun preview redémarré.

Le navigateur intégré a échoué à se connecter (timeout CDP de 30 secondes) pendant cette passe : aucune nouvelle validation interactive ni capture de page n’est revendiquée. Les contrôles ci-dessous sont des validations historiques, antérieures à ce coussin. Les tests actuels exécutent les transitions du vrai renderer avec des refs SVG et une horloge simulées, couvrant le retour après erreur/arrêt, les couleurs, les identités, le mouvement réduit et le signal mesuré.

### Premier smoke du 23 octobre 2026 (avant correction de fidélité visuelle)

Sur un build de production isolé, avec uniquement la fixture en mémoire décrite ci-dessus : 161 cellules montées, cinq visibles au repos/en connexion ; une entrée synthétique puis une sortie PCM synthétique pendant sourdine ont chacune dépassé cinq cellules visibles (83 au point de mesure). Le PCM nul est resté à cinq cellules ; la fin de lecture est revenue à cinq. Les gains vers les haut-parleurs sont restés à zéro. À l’entrée dans Voix, aucune capture ni aucun contexte n’était créé.

FR/EN, sourdine, arrêt explicite, erreur de connexion injectée, changement de langue/activité et retour sans autodémarrage ont été vérifiés ; les contextes de session et sockets de fixture étaient fermés après chaque arrêt. Le mouvement réduit est resté statique et son retrait a rétabli la réaction au signal mesuré. Captures visuelles desktop et mobile effectuées.

Mesures de layout : 1 440 × 900 → SVG 384 × 64 ; 1 280 × 650 → 384 × 40 ; 390 × 844 → 318 × 64. Pas de débordement horizontal détecté, commandes actives 44 × 44 et mention de pied de page visible aux trois tailles.

Limite du navigateur intégré : il déclarait l’onglet `hidden`, même après `bringToFront`. Le premier démarrage a donc correctement arrêté immédiatement le contexte sans capture. Pour poursuivre le smoke audio, `visibilityState` a été remplacé **dans la fixture de cet onglet seulement** par une valeur contrôlée ; le passage simulé à `hidden` a ensuite confirmé le retour au repos et la fermeture du moteur. Ce n’est pas une validation du changement d’onglet natif. Les timeouts et échéances ont été vérifiés par les tests moteur, pas par une conversation fournisseur ou une permission réelle. Aucun micro physique ni service vocal distant n’a été utilisé.

### Correction de fidélité visuelle et second smoke

La première version était trop plate et régulière par rapport à la référence. La correction privilégie maintenant les volumes charnus, six silhouettes Bézier légèrement concaves, 21 largeurs et 64 hauteurs distinctes dans la composition par défaut, l’empilement irrégulier et trois crêtes. Sur un signal synthétique fort, les colonnes 5, 12 et 19 ont sept cellules ; les creux 9 et 16 n’en ont qu’une. Le silence garde cinq cellules. L’enveloppe spatiale est fixe : un signal constant ne crée aucune oscillation artificielle.

Un nouvel onglet isolé sur le preview de développement 3109 présente une comparaison **ACTIF / REPOS** agrandie, injectée uniquement dans le navigateur (pas dans le produit). L’état actif vient de mesures du vrai graphe Web Audio alimenté par une source synthétique locale ; le panneau recopie ces attributs SVG pendant la mesure puis conserve une capture explicitement étiquetée. Le bouton de fixture permet de rejouer le signal silencieux sans appel fournisseur. Le panneau de repos provient du rendu après silence/sourdine. Aucune interception des WebSockets Next/HMR : seul le transport vocal est remplacé. Les captures desktop, mobile actif et mobile repos ont été prises ; la réduction des mouvements a été explicitement désactivée dans la fixture pour pouvoir inspecter la silhouette active.

Mesures après correction : 1 440 × 900 → emplacement SVG 384 × 96 ; 1 280 × 650 → 384 × 64 ; 390 × 844 → 318 × 96. Pas de débordement horizontal détecté, notice visible aux trois tailles. Bouton initial 64 × 64, commandes actives mobiles 44 × 44. La hauteur ne change pas entre activité et silence. Les captures actives ont montré 99 cellules sur l’entrée synthétique ; une sortie PCM synthétique pendant sourdine a aussi animé les galets (89 cellules au point de mesure pendant l’attaque). Tous les gains vers les haut-parleurs sont restés nuls. Sourdine : retour immédiat à cinq cellules ; l’échéance réelle de deux minutes a également arrêté une session de fixture. La limite de visibilité du navigateur intégré reste celle décrite ci-dessus.

Régressions ajoutées : trois maxima inégaux, creux, diversité des tailles et chemins, espacement calculé selon les hauteurs, bornes pour 19/23/27 colonnes, absence d’oscillation sous énergie constante, emplacement stable. Le moteur audio et l’analyse fréquentielle n’ont pas été modifiés par cette correction.
