// Original Nexo copy, including both sides of each editorial remix.
// No quotations, borrowed maxims, or author attributions.
export type EntranceFragment = {
  before: string;
  struck?: string;
  replacement?: string;
  after?: string;
};
export type EntranceEntry = EntranceFragment & { id: string; kind: "encouragement" | "remix" };

type BilingualLine = readonly [fr: string, en: string];
type BilingualRemix = readonly [fr: EntranceFragment, en: EntranceFragment];

const encouragements = [
  ["Respire", "Breathe"],
  ["Ressens", "Feel"],
  ["Sois toi", "Be yourself"],
  ["Ose la pause", "Dare to pause"],
  ["Tu comptes", "You matter"],
  ["Prends place", "Come on in"],
  ["À ton rythme", "At your pace"],
  ["Un petit pas", "A small step"],
  ["Souffle", "Take a breath"],
  ["Ose jouer", "Dare to play"],
  ["Prends l’air", "Get some air"],
  ["Sans hâte", "No rush"],
  ["On est là", "We’re here"],
  ["Ose essayer", "Dare to try"],
  ["À ton écoute", "Here to listen"],
  ["Reste curieux", "Stay curious"],
  ["Quelques mots suffisent pour commencer", "A few words are enough to begin"],
  ["Tu as le droit de ralentir", "It’s okay to slow down"],
  ["Un petit pas, c’est déjà un début", "A small step is still a start"],
  ["Fais une place à ce qui te plaît", "Make space for what you enjoy"],
  ["Tu peux aussi choisir de faire une pause", "Taking a break is a choice too"],
  ["Le prochain pas peut être minuscule", "The next step can be tiny"],
  ["Pas besoin de savoir quoi dire", "You don’t have to know what to say"],
  ["Viens comme tu es, avec ce que tu ressens", "Come as you are, however you feel"],
  ["Accorde-toi un moment qui te fait du bien", "Give yourself a moment that feels good"],
  ["Ici, tu peux poser tes questions", "There is room for your questions"],
  ["Tout n’a pas besoin d’être parfait aujourd’hui", "Not everything has to be perfect today"],
  ["Garde un peu de place pour l’imprévu", "Leave a little room for the unexpected"],
  ["Un simple bonjour peut ouvrir la conversation", "A simple hello can start a conversation"],
  ["Avance à ta façon, sans te comparer", "Find your own way, without comparing yourself to others"],
  ["Un moment pour toi, sans rien à prouver", "A moment for you, with nothing to prove"],
  ["Fais simple, fais à ta façon", "Keep it simple, do it your way"],
] as const satisfies readonly BilingualLine[];

const remixes = [
  [{ before: "Tu peux t’accorder une", struck: "récompense", replacement: "pause" }, { before: "You can give yourself a", struck: "reward", replacement: "break" }],
  [{ before: "Le prochain pas demande de la", struck: "vitesse", replacement: "curiosité" }, { before: "The next step needs", struck: "speed", replacement: "curiosity" }],
  [{ before: "Offre-toi un", struck: "défi de plus", replacement: "moment de calme" }, { before: "Give yourself", struck: "another challenge", replacement: "a moment of calm" }],
  [{ before: "Avancer, c’est aussi savoir", struck: "accélérer", replacement: "s’écouter" }, { before: "Moving forward also means", struck: "speeding up", replacement: "listening to yourself" }],
  [{ before: "Pour commencer, apporte ta", struck: "certitude", replacement: "curiosité" }, { before: "To begin, bring your", struck: "certainty", replacement: "curiosity" }],
  [{ before: "Pour avancer, cherche moins de", struck: "perfection", replacement: "pression" }, { before: "To move forward, aim for less", struck: "perfection", replacement: "pressure" }],
  [{ before: "Accorde-toi le droit de", struck: "réussir", replacement: "recommencer" }, { before: "Give yourself permission to", struck: "succeed", replacement: "start again" }],
  [{ before: "Le bon rythme est celui du", struck: "chronomètre", replacement: "moment présent" }, { before: "A good pace follows the", struck: "stopwatch", replacement: "present moment" }],
  [{ before: "Entre deux tâches, prends une", struck: "longueur d’avance", replacement: "pause" }, { before: "Between tasks, make time for", struck: "getting ahead", replacement: "a break" }],
  [{ before: "Fais de la place à tes", struck: "obligations", replacement: "envies" }, { before: "Make room for", struck: "your obligations", replacement: "what you want" }],
  [{ before: "Une rencontre commence sans", struck: "hésitation", replacement: "scénario" }, { before: "You can connect without", struck: "hesitation", replacement: "a script" }],
  [{ before: "Ton brouillon mérite un", struck: "verdict", replacement: "second regard" }, { before: "Your rough draft deserves a", struck: "verdict", replacement: "second look" }],
  [{ before: "Tu peux prendre le temps de", struck: "tout prévoir", replacement: "t’écouter" }, { before: "You can take time to", struck: "plan everything", replacement: "listen to yourself" }],
  [{ before: "Tu peux changer de", struck: "programme", replacement: "rythme", after: "sans te justifier" }, { before: "You can change your", struck: "plans", replacement: "pace", after: "without having to explain yourself" }],
  [{ before: "Prends le temps de remarquer les", struck: "grands résultats", replacement: "petits progrès" }, { before: "Take time to notice", struck: "big results", replacement: "small steps forward" }],
  [{ before: "Ici, tu peux partager tes", struck: "réussites", replacement: "ressentis" }, { before: "Here, you can share your", struck: "achievements", replacement: "feelings" }],
] as const satisfies readonly BilingualRemix[];

function localizedEntries(language: 0 | 1): readonly EntranceEntry[] {
  return [
    ...encouragements.map((line, index): EntranceEntry => ({ id: `encouragement-${index}`, kind: "encouragement", before: line[language] })),
    ...remixes.map((line, index): EntranceEntry => ({ id: `remix-${index}`, kind: "remix", ...line[language] })),
  ];
}

export const entranceEntries = { fr: localizedEntries(0), en: localizedEntries(1) } as const;

export type EntranceUnit = { text: string; role: "before" | "struck" | "replacement" | "after" };
export function entranceUnits(entry: EntranceEntry): EntranceUnit[] {
  return (["before", "struck", "replacement", "after"] as const).flatMap(role =>
    (entry[role]?.trim().split(/\s+/).filter(Boolean) ?? []).map(text => ({ text, role })),
  );
}

export const letterFamilies = ["zoom", "lateral", "fold", "evaporate"] as const;
export const phraseFamilies = ["stamp", "stairs", "wall"] as const;
export type EntranceFamily = typeof letterFamilies[number] | typeof phraseFamilies[number];
export const entranceExits = ["lift", "peel", "slide", "erase"] as const;
export const entrancePalettes = ["sky", "sage", "amber", "ink"] as const;
export type EntranceScene = {
  entry: EntranceEntry;
  family: EntranceFamily;
  exit: typeof entranceExits[number];
  palette: typeof entrancePalettes[number];
  reverse: boolean;
  variation: number;
  serial: number;
};

// A bounded Fisher–Yates bag. No repeats until exhausted, including refill seams.
export function createEntranceBag<T>(items: readonly T[], random = Math.random) {
  if (!items.length) throw new Error("An entrance bag needs at least one item");
  let bag: T[] = [];
  let last: T | undefined;
  return (avoid: T | undefined = last): T => {
    if (!bag.length) {
      bag = [...items];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    // Also avoid the previous family when switching between short/phrase bags.
    const index = bag.findIndex(item => item !== avoid);
    if (index < 0 && items.length > 1) {
      const alternate = items.find(item => item !== avoid)!;
      // Keep the deferred item for the next call rather than discarding it.
      last = alternate;
      return alternate;
    }
    last = bag.splice(Math.max(0, index), 1)[0];
    return last;
  };
}

export function supportsLetterFlight(entry: EntranceEntry) {
  return entry.kind === "encouragement" && Array.from(entry.before).filter(char => char !== " ").length <= 12;
}

export function createEntranceSequence(locale: "fr" | "en", random = Math.random) {
  const nextEntry = createEntranceBag(entranceEntries[locale], random);
  const nextLetter = createEntranceBag(letterFamilies, random);
  const nextPhrase = createEntranceBag(phraseFamilies, random);
  const nextPalette = createEntranceBag(entrancePalettes, random);
  const nextExit = createEntranceBag(entranceExits, random);
  let previous: EntranceScene | undefined;
  let serial = 0;
  return (): EntranceScene => {
    const entry = nextEntry();
    // Short encouragements keep all four spectacular per-letter families.
    const family = supportsLetterFlight(entry) ? nextLetter() : nextPhrase(previous?.family as typeof phraseFamilies[number] | undefined);
    previous = { entry, family, palette: nextPalette(), exit: nextExit(), reverse: random() < 0.5, variation: Math.floor(random() * 3), serial: serial++ };
    return previous;
  };
}

// Font-measured rows, not guessed character widths; all coordinates stay in 1200×600.
export function entrancePhraseLayout(widths: readonly number[], stairs: boolean) {
  const gap = stairs ? 34 : 22;
  const rows: { indices: number[]; width: number }[] = [];
  for (let index = 0; index < widths.length; index++) {
    let row = rows.at(-1);
    if (!row || row.width + gap + widths[index] > 940 || (stairs && row.indices.length === 3)) {
      row = { indices: [], width: 0 };
      rows.push(row);
    }
    row.width += (row.indices.length ? gap : 0) + widths[index];
    row.indices.push(index);
  }
  const pitch = stairs ? 100 : 82;
  const positions: { x: number; y: number; step: number }[] = [];
  rows.forEach((row, rowIndex) => {
    let x = 600 - row.width / 2;
    row.indices.forEach((index, column) => {
      positions[index] = { x, y: 285 - (rows.length - 1) * pitch / 2 + rowIndex * pitch + (stairs ? column * 22 : 0), step: column };
      x += widths[index] + gap;
    });
  });
  return positions;
}
