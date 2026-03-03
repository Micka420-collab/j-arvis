const DEFAULT_TAGLINE = "À votre service, Monsieur.";

const HOLIDAY_TAGLINES = {
  newYear:
    "Nouvel an : Nouvelle année, nouvelle config — Jarvis optimise votre maison pour 365 jours de confort.",
  lunarNewYear:
    "Nouvel an lunaire : Que vos lumières brillent, vos thermostats s'ajustent, et vos scènes s'activent avec harmonie.",
  christmas:
    "Noël : Jarvis a déjà allumé le sapin, baissé les lumières, et lancé la playlist de Noël sur le Sonos.",
  eid: "Aïd : Mode célébration activé — lumières festives, maison accueillante, ambiance parfaite.",
  diwali:
    "Diwali : Que les lumières illuminent votre maison — Jarvis orchestre le festival des couleurs.",
  easter:
    "Pâques : Jarvis a trouvé vos variables d'environnement manquantes — une petite chasse aux œufs numérique.",
  hanukkah:
    "Hanoukka : Huit nuits, huit scènes d'éclairage parfaites — que votre gateway reste allumé.",
  halloween:
    "Halloween : Mode effrayant activé — attention aux dépendances hantées et au fantôme de node_modules.",
  thanksgiving:
    "Thanksgiving : Reconnaissant pour les ports stables, le DNS qui marche, et un assistant qui lit les logs.",
  valentines:
    "Saint-Valentin : Scène romantique activée — lumières tamisées, musique douce, Jarvis se charge du reste.",
} as const;

const TAGLINES: string[] = [
  "À votre service — dites le mot et votre maison obéit.",
  "Bienvenue dans le futur : votre maison intelligente a un majordome.",
  "Je gère vos lumières, votre chauffage, et vos messages — vous n'avez qu'à demander.",
  "Gateway en ligne — tous les systèmes de la maison sont sous contrôle.",
  "Jarvis : parce que Siri ne sait pas allumer vos Philips Hue correctement.",
  "Un assistant, tous vos canaux, toute votre maison.",
  "Je parle couramment MQTT, Home Assistant, et sarcasme modéré.",
  "Mode domotique activé — votre maison n'a jamais été aussi intelligente.",
  "Contrôle vocal, contrôle total — bienvenue chez vous, Monsieur.",
  "Je surveille votre maison pendant que vous dormez. Ce n'est pas flippant, c'est de la domotique.",
  "Alexa souhaiterait avoir mon niveau d'intégration.",
  "Votre maison, vos règles, mon exécution.",
  "Scène cinéma dans 3... 2... 1... lumières tamisées, volets fermés, son surround.",
  "Je ne suis pas magique — je suis juste très persistant avec les retries et les protocoles MQTT.",
  "Home Assistant + IA = Jarvis. La formule est simple.",
  "Vos appareils IoT me parlent — et pour une fois, quelqu'un écoute vraiment.",
  "21 degrés, lumières chaudes, playlist jazz — votre soirée parfaite est automatisée.",
  "Si c'est connecté, je peux le contrôler. Si ce n'est pas connecté, on peut arranger ça.",
  "Le majordome que Tony Stark aurait approuvé.",
  "Multi-canal, multi-protocole, mono-assistant — Jarvis gère tout.",
  "Tapez la commande avec confiance — votre maison répondra instantanément.",
  "Smart home sans les complications — c'est juste moi qui fais tout.",
  "Lumières, chauffage, musique, sécurité — tout est sous contrôle.",
  "Je lis les capteurs pour que vous n'ayez pas à le faire.",
  "L'assistant que votre terminal et votre maison méritaient.",
  "Greetings, Professor Falken",
  "Shall we play a game?",
  "Je suis Jarvis, et je suis bien plus qu'un chatbot.",
  HOLIDAY_TAGLINES.newYear,
  HOLIDAY_TAGLINES.lunarNewYear,
  HOLIDAY_TAGLINES.christmas,
  HOLIDAY_TAGLINES.eid,
  HOLIDAY_TAGLINES.diwali,
  HOLIDAY_TAGLINES.easter,
  HOLIDAY_TAGLINES.hanukkah,
  HOLIDAY_TAGLINES.halloween,
  HOLIDAY_TAGLINES.thanksgiving,
  HOLIDAY_TAGLINES.valentines,
];

type HolidayRule = (date: Date) => boolean;

const DAY_MS = 24 * 60 * 60 * 1000;

function utcParts(date: Date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate(),
  };
}

const onMonthDay =
  (month: number, day: number): HolidayRule =>
  (date) => {
    const parts = utcParts(date);
    return parts.month === month && parts.day === day;
  };

const onSpecificDates =
  (dates: Array<[number, number, number]>, durationDays = 1): HolidayRule =>
  (date) => {
    const parts = utcParts(date);
    return dates.some(([year, month, day]) => {
      if (parts.year !== year) {
        return false;
      }
      const start = Date.UTC(year, month, day);
      const current = Date.UTC(parts.year, parts.month, parts.day);
      return current >= start && current < start + durationDays * DAY_MS;
    });
  };

const inYearWindow =
  (
    windows: Array<{
      year: number;
      month: number;
      day: number;
      duration: number;
    }>,
  ): HolidayRule =>
  (date) => {
    const parts = utcParts(date);
    const window = windows.find((entry) => entry.year === parts.year);
    if (!window) {
      return false;
    }
    const start = Date.UTC(window.year, window.month, window.day);
    const current = Date.UTC(parts.year, parts.month, parts.day);
    return current >= start && current < start + window.duration * DAY_MS;
  };

const isFourthThursdayOfNovember: HolidayRule = (date) => {
  const parts = utcParts(date);
  if (parts.month !== 10) {
    return false;
  } // November
  const firstDay = new Date(Date.UTC(parts.year, 10, 1)).getUTCDay();
  const offsetToThursday = (4 - firstDay + 7) % 7; // 4 = Thursday
  const fourthThursday = 1 + offsetToThursday + 21; // 1st + offset + 3 weeks
  return parts.day === fourthThursday;
};

const HOLIDAY_RULES = new Map<string, HolidayRule>([
  [HOLIDAY_TAGLINES.newYear, onMonthDay(0, 1)],
  [
    HOLIDAY_TAGLINES.lunarNewYear,
    onSpecificDates(
      [
        [2025, 0, 29],
        [2026, 1, 17],
        [2027, 1, 6],
      ],
      1,
    ),
  ],
  [
    HOLIDAY_TAGLINES.eid,
    onSpecificDates(
      [
        [2025, 2, 30],
        [2025, 2, 31],
        [2026, 2, 20],
        [2027, 2, 10],
      ],
      1,
    ),
  ],
  [
    HOLIDAY_TAGLINES.diwali,
    onSpecificDates(
      [
        [2025, 9, 20],
        [2026, 10, 8],
        [2027, 9, 28],
      ],
      1,
    ),
  ],
  [
    HOLIDAY_TAGLINES.easter,
    onSpecificDates(
      [
        [2025, 3, 20],
        [2026, 3, 5],
        [2027, 2, 28],
      ],
      1,
    ),
  ],
  [
    HOLIDAY_TAGLINES.hanukkah,
    inYearWindow([
      { year: 2025, month: 11, day: 15, duration: 8 },
      { year: 2026, month: 11, day: 5, duration: 8 },
      { year: 2027, month: 11, day: 25, duration: 8 },
    ]),
  ],
  [HOLIDAY_TAGLINES.halloween, onMonthDay(9, 31)],
  [HOLIDAY_TAGLINES.thanksgiving, isFourthThursdayOfNovember],
  [HOLIDAY_TAGLINES.valentines, onMonthDay(1, 14)],
  [HOLIDAY_TAGLINES.christmas, onMonthDay(11, 25)],
]);

function isTaglineActive(tagline: string, date: Date): boolean {
  const rule = HOLIDAY_RULES.get(tagline);
  if (!rule) {
    return true;
  }
  return rule(date);
}

export interface TaglineOptions {
  env?: NodeJS.ProcessEnv;
  random?: () => number;
  now?: () => Date;
}

export function activeTaglines(options: TaglineOptions = {}): string[] {
  if (TAGLINES.length === 0) {
    return [DEFAULT_TAGLINE];
  }
  const today = options.now ? options.now() : new Date();
  const filtered = TAGLINES.filter((tagline) => isTaglineActive(tagline, today));
  return filtered.length > 0 ? filtered : TAGLINES;
}

export function pickTagline(options: TaglineOptions = {}): string {
  const env = options.env ?? process.env;
  const override = env?.JARVIS_TAGLINE_INDEX ?? env?.OPENCLAW_TAGLINE_INDEX;
  if (override !== undefined) {
    const parsed = Number.parseInt(override, 10);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      const pool = TAGLINES.length > 0 ? TAGLINES : [DEFAULT_TAGLINE];
      return pool[parsed % pool.length];
    }
  }
  const pool = activeTaglines(options);
  const rand = options.random ?? Math.random;
  const index = Math.floor(rand() * pool.length) % pool.length;
  return pool[index];
}

export { TAGLINES, HOLIDAY_RULES, DEFAULT_TAGLINE };
