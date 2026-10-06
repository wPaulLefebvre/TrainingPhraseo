// Scénarios d'entraînement VFR (programme PPL).
// Types d'étapes :
//   atis  : diffusion ATIS (synthèse vocale)
//   quiz  : relevé des éléments ATIS
//   st    : message de la station (AFIS / Tour)
//   other : message d'un autre aéronef (auto-information)
//   pi    : transmission du pilote, évaluée
// Champs d'une étape pilote :
//   sit  : situation affichée (français)
//   fr/en: réponse modèle (indicative, d'autres formulations conformes sont acceptées)
//   rb   : éléments à collationner ou à annoncer impérativement
//   abbr : l'indicatif abrégé est-il autorisé à ce stade (la station l'a déjà employé)
//   src  : 'manuel' (manuel DSNA) ou 'usage' (pratique courante hors manuel)

export const RB_LABELS = {
  rwy: 'Piste', qnh: 'QNH', side: 'Main du circuit', atis: "Information ATIS", cs: 'Indicatif complet', freq: 'Fréquence',
};

export const SCENARIOS = [
  {
    id: 'atis', group: 'ATIS', adKind: 'afis', allowHome: true,
    title: "Écoute d'un ATIS",
    desc: "Écoute le message et relève lettre, piste, vent, QNH et température.",
    steps: [{ t: 'atis' }, { t: 'quiz' }],
  },

  {
    id: 'afis-dep', group: 'AFIS', adKind: 'afis', allowHome: true,
    title: 'Départ d\'un aérodrome AFIS',
    desc: 'Premier contact au parking, point d\'arrêt, alignement, sortie de circuit.',
    steps: [
      { t: 'atis' },
      {
        t: 'pi', abbr: false, rb: ['cs', 'atis'], src: 'manuel',
        sit: "Tu es au parking à {ad}, prêt à rouler, vol VFR vers {to} avec {pob}. Fais ton premier contact.",
        fr: '{st}, {cs}, bonjour, {type} au parking, {pob}, VFR à destination de {to}, information {atis}, pour rouler.',
        en: '{st}, {cs}, good morning, {type} at the parking, {pob}, VFR to {to}, information {atis}, request taxi.',
      },
      {
        t: 'st',
        fr: '{csA}, {st}, bonjour, piste {rwy} en service, QNH {qnh}, rappelez au point d\'arrêt piste {rwy}.',
        en: '{csA}, {st}, good morning, runway in use {rwy}, QNH {qnh}, report holding point runway {rwy}.',
      },
      {
        t: 'pi', abbr: true, rb: ['rwy', 'qnh'], src: 'manuel',
        sit: "Collationne l'information reçue.",
        fr: 'Piste {rwy}, QNH {qnh}, je rappelle au point d\'arrêt piste {rwy}, {csA}.',
        en: 'Runway {rwy}, QNH {qnh}, wilco, {csA}.',
      },
      {
        t: 'pi', abbr: true, rb: ['rwy'], src: 'usage',
        sit: 'Essais moteur terminés, tu es au point d\'arrêt piste {rwy}.',
        fr: '{st}, {csA}, au point d\'arrêt piste {rwy}, prêt au départ.',
        en: '{st}, {csA}, holding point runway {rwy}, ready for departure.',
      },
      {
        t: 'st',
        fr: '{csA}, piste {rwy} libre, vent {wind}.',
        en: '{csA}, runway {rwy} free, wind {wind}.',
      },
      {
        t: 'pi', abbr: true, rb: ['rwy'], src: 'usage',
        sit: "Annonce ton alignement et ton décollage (un AFIS ne délivre pas de clairance).",
        fr: 'Je m\'aligne et je décolle piste {rwy}, {csA}.',
        en: 'Lining up and taking off runway {rwy}, {csA}.',
      },
      {
        t: 'st',
        fr: '{csA}, rappelez quittant le circuit.',
        en: '{csA}, report leaving the circuit.',
      },
      {
        t: 'pi', abbr: true, rb: [], src: 'manuel',
        sit: 'Accuse réception.',
        fr: 'Je rappelle quittant le circuit, {csA}.',
        en: 'Wilco, {csA}.',
      },
      {
        t: 'pi', abbr: true, rb: [], src: 'manuel',
        sit: 'Tu sors du circuit vers {to}.',
        fr: '{st}, {csA}, sortie de circuit, je quitte la fréquence.',
        en: '{st}, {csA}, leaving circuit and frequency.',
      },
      { t: 'st', fr: '{csA}, au revoir.', en: '{csA}, good day.' },
    ],
  },

  {
    id: 'afis-arr', group: 'AFIS', adKind: 'afis', allowHome: true,
    title: 'Arrivée sur un aérodrome AFIS',
    desc: 'Message d\'arrivée VFR, intégration, information de trafic, finale, piste dégagée.',
    steps: [
      { t: 'atis' },
      {
        t: 'pi', abbr: false, rb: [], src: 'manuel',
        sit: 'Tu arrives de {from}, à {pos}, {alt}. Établis le contact.',
        fr: '{st}, {cs}, bonjour.',
        en: '{st}, {cs}, good morning.',
      },
      { t: 'st', fr: '{cs}, {st}, bonjour, j\'écoute.', en: '{cs}, {st}, good morning, pass your message.' },
      {
        t: 'pi', abbr: false, rb: ['cs', 'atis'], src: 'manuel',
        sit: 'Transmets ton message d\'arrivée : estimé verticale terrain à {eta}.',
        fr: '{cs}, {type}, VFR de {from} à {ad} pour atterrissage, {pos}, {alt}, estimé verticale terrain à {eta}, information {atis}.',
        en: '{cs}, {type}, VFR from {from} to {ad} for landing, {pos}, {alt}, estimate overhead at {eta}, information {atis}.',
      },
      {
        t: 'st',
        fr: '{csA}, piste {rwy} en service, QNH {qnh}, un {traf} dans le circuit, rappelez vent arrière main {side} piste {rwy}.',
        en: '{csA}, runway in use {rwy}, QNH {qnh}, one {traf} in the circuit, report {side} downwind runway {rwy}.',
      },
      {
        t: 'pi', abbr: true, rb: ['rwy', 'qnh', 'side'], src: 'manuel',
        sit: 'Collationne.',
        fr: 'Piste {rwy}, QNH {qnh}, je rappelle vent arrière main {side} piste {rwy}, {csA}.',
        en: 'Runway {rwy}, QNH {qnh}, wilco {side} downwind runway {rwy}, {csA}.',
      },
      {
        t: 'pi', abbr: true, rb: ['rwy', 'side'], src: 'manuel',
        sit: 'Tu es en vent arrière.',
        fr: '{st}, {csA}, vent arrière main {side} piste {rwy}.',
        en: '{st}, {csA}, {side} downwind runway {rwy}.',
      },
      {
        t: 'st',
        fr: '{csA}, trafic {traf} en base main {side}, rappelez finale piste {rwy}.',
        en: '{csA}, traffic {traf} on {side} base, report final runway {rwy}.',
      },
      {
        t: 'pi', abbr: true, rb: ['rwy'], src: 'manuel',
        sit: 'Tu as le trafic en vue.',
        fr: 'Trafic en vue, je rappelle finale piste {rwy}, {csA}.',
        en: 'Traffic in sight, reporting final runway {rwy}, {csA}.',
      },
      {
        t: 'pi', abbr: true, rb: ['rwy'], src: 'manuel',
        sit: 'Le trafic a dégagé, tu es en finale.',
        fr: '{st}, {csA}, finale piste {rwy}.',
        en: '{st}, {csA}, final runway {rwy}.',
      },
      { t: 'st', fr: '{csA}, piste {rwy} libre, vent {wind}.', en: '{csA}, runway {rwy} free, wind {wind}.' },
      {
        t: 'pi', abbr: true, rb: ['rwy'], src: 'manuel',
        sit: 'Annonce ton atterrissage.',
        fr: 'J\'atterris piste {rwy}, {csA}.',
        en: 'Landing runway {rwy}, {csA}.',
      },
      {
        t: 'pi', abbr: true, rb: [], src: 'usage',
        sit: 'Tu as dégagé la piste.',
        fr: '{st}, {csA}, piste dégagée.',
        en: '{st}, {csA}, runway vacated.',
      },
      { t: 'st', fr: '{csA}, roger.', en: '{csA}, roger.' },
    ],
  },

  {
    id: 'afis-circuit', group: 'AFIS', adKind: 'afis', allowHome: true,
    title: 'Tours de piste en AFIS',
    desc: 'Toucher, remise de gaz sur piste occupée, atterrissage complet.',
    steps: [
      { t: 'atis' },
      {
        t: 'pi', abbr: false, rb: ['cs', 'atis'], src: 'manuel',
        sit: 'Au parking à {ad}, tu pars pour des tours de piste en local, seul à bord. Premier contact.',
        fr: '{st}, {cs}, bonjour, {type} au parking, une personne à bord, pour des tours de piste, information {atis}, pour rouler.',
        en: '{st}, {cs}, good morning, {type} at the parking, one person on board, for circuits, information {atis}, request taxi.',
      },
      {
        t: 'st',
        fr: '{csA}, {st}, bonjour, piste {rwy} en service, circuit main {side}, QNH {qnh}, rappelez prêt au départ.',
        en: '{csA}, {st}, good morning, runway in use {rwy}, {side} circuit, QNH {qnh}, report ready for departure.',
      },
      {
        t: 'pi', abbr: true, rb: ['rwy', 'qnh', 'side'], src: 'manuel',
        sit: 'Collationne.',
        fr: 'Piste {rwy}, circuit main {side}, QNH {qnh}, je rappelle prêt, {csA}.',
        en: 'Runway {rwy}, {side} circuit, QNH {qnh}, wilco, {csA}.',
      },
      {
        t: 'pi', abbr: true, rb: ['rwy', 'side'], src: 'manuel',
        sit: 'Plus tard, tu es en vent arrière, tu prévois un toucher.',
        fr: '{st}, {csA}, vent arrière main {side} piste {rwy}, pour un toucher.',
        en: '{st}, {csA}, {side} downwind runway {rwy}, for touch and go.',
      },
      { t: 'st', fr: '{csA}, rappelez finale.', en: '{csA}, report final.' },
      { t: 'pi', abbr: true, rb: [], src: 'manuel', sit: 'Accuse réception.', fr: 'Je rappelle finale, {csA}.', en: 'Wilco, {csA}.' },
      {
        t: 'pi', abbr: true, rb: ['rwy'], src: 'manuel',
        sit: 'Tu es en finale.',
        fr: '{st}, {csA}, finale piste {rwy} pour un toucher.',
        en: '{st}, {csA}, final runway {rwy} for touch and go.',
      },
      {
        t: 'st',
        fr: '{csA}, attention, un {traf} vient de s\'aligner piste {rwy}.',
        en: '{csA}, caution, {traf} just lined up runway {rwy}.',
      },
      {
        t: 'pi', abbr: true, rb: [], src: 'manuel',
        sit: 'La piste est occupée : tu remets les gaz.',
        fr: 'Je remets les gaz, {csA}.',
        en: 'Going around, {csA}.',
      },
      { t: 'st', fr: '{csA}, rappelez vent arrière.', en: '{csA}, report downwind.' },
      { t: 'pi', abbr: true, rb: [], src: 'manuel', sit: 'Accuse réception.', fr: 'Je rappelle vent arrière, {csA}.', en: 'Wilco, {csA}.' },
      {
        t: 'pi', abbr: true, rb: ['rwy'], src: 'manuel',
        sit: 'Nouveau circuit : tu es en finale, cette fois pour un atterrissage complet.',
        fr: '{st}, {csA}, finale piste {rwy}, atterrissage complet.',
        en: '{st}, {csA}, final runway {rwy}, full stop.',
      },
      { t: 'st', fr: '{csA}, piste {rwy} libre, vent {wind}.', en: '{csA}, runway {rwy} free, wind {wind}.' },
      { t: 'pi', abbr: true, rb: ['rwy'], src: 'manuel', sit: 'Annonce ton atterrissage.', fr: 'J\'atterris piste {rwy}, {csA}.', en: 'Landing runway {rwy}, {csA}.' },
    ],
  },

  {
    id: 'afis-transit', group: 'AFIS', adKind: 'afis', allowHome: false,
    title: 'Transit à la verticale d\'un terrain AFIS',
    desc: 'Message de transit, information de trafic, sortie de fréquence.',
    steps: [
      { t: 'atis' },
      {
        t: 'pi', abbr: false, rb: ['cs', 'atis'], src: 'manuel',
        sit: 'En navigation de {from} vers {to}, tu passes à la verticale de {ad}. Tu es à {pos}, {altT}. Annonce ton transit en un seul message (estimé verticale à {eta}).',
        fr: '{st}, {cs}, bonjour, {type}, VFR de {from} à {to}, {pos}, {altT}, transit verticale terrain, estimé verticale à {eta}, information {atis}.',
        en: '{st}, {cs}, good morning, {type}, VFR from {from} to {to}, {pos}, {altT}, transit overhead the aerodrome, estimate overhead at {eta}, information {atis}.',
      },
      {
        t: 'st',
        fr: '{csA}, {st}, bonjour, QNH {qnh}, piste {rwy} en service, un {traf} dans le circuit main {side}, rappelez verticale.',
        en: '{csA}, {st}, good morning, QNH {qnh}, runway in use {rwy}, one {traf} in {side} circuit, report overhead.',
      },
      {
        t: 'pi', abbr: true, rb: ['qnh'], src: 'manuel',
        sit: 'Collationne.',
        fr: 'QNH {qnh}, je rappelle verticale, {csA}.',
        en: 'QNH {qnh}, wilco, {csA}.',
      },
      {
        t: 'pi', abbr: true, rb: [], src: 'manuel',
        sit: 'Tu es à la verticale du terrain, {altT}.',
        fr: '{st}, {csA}, verticale terrain, {altT}.',
        en: '{st}, {csA}, overhead the aerodrome, {altT}.',
      },
      { t: 'st', fr: '{csA}, rappelez quittant la fréquence.', en: '{csA}, report leaving frequency.' },
      { t: 'pi', abbr: true, rb: [], src: 'manuel', sit: 'Accuse réception.', fr: 'Je rappelle quittant la fréquence, {csA}.', en: 'Wilco, {csA}.' },
      {
        t: 'pi', abbr: true, rb: [], src: 'manuel',
        sit: 'Tu t\'éloignes vers {to}.',
        fr: '{st}, {csA}, je quitte la fréquence.',
        en: '{st}, {csA}, leaving frequency.',
      },
      { t: 'st', fr: '{csA}, au revoir.', en: '{csA}, good day.' },
    ],
  },

  {
    id: 'auto-arr', group: 'Auto-information', adKind: 'auto', allowHome: false,
    title: 'Arrivée en auto-information',
    desc: 'Pas de station au sol : annonces de position, trafic au sol, piste dégagée.',
    note: "Phraséologie d'auto-information : pratique usuelle, hors manuel DSNA. En France, l'auto-information se fait en français sauf mention contraire sur la carte VAC.",
    steps: [
      {
        t: 'pi', abbr: false, rb: [], src: 'usage',
        sit: 'Pas d\'ATIS, pas d\'AFIS. Tu arrives à {pos}, {alt}. Le vent observé favorise la piste {rwy}, circuit main {side}. Fais ta première annonce.',
        fr: '{st}, {cs}, {type}, {pos}, {alt}, pour intégration vent arrière main {side} piste {rwy}, {st}.',
        en: '{st}, {cs}, {type}, {pos}, {alt}, joining {side} downwind runway {rwy}, {st}.',
      },
      {
        t: 'other',
        fr: '{ad}, F-GHBD, au point d\'attente piste {rwy}, je m\'aligne et décolle dans une minute, {ad}.',
        en: '{ad} traffic, F-GHBD, holding point runway {rwy}, lining up and taking off in one minute, {ad} traffic.',
      },
      {
        t: 'pi', abbr: false, rb: ['rwy', 'side'], src: 'usage',
        sit: 'Tu entres en vent arrière.',
        fr: '{st}, {cs}, vent arrière main {side} piste {rwy}, pour atterrissage complet, {st}.',
        en: '{st}, {cs}, {side} downwind runway {rwy}, full stop, {st}.',
      },
      {
        t: 'pi', abbr: false, rb: ['rwy'], src: 'usage',
        sit: 'Tu es en finale.',
        fr: '{st}, {cs}, finale piste {rwy}, {st}.',
        en: '{st}, {cs}, final runway {rwy}, {st}.',
      },
      {
        t: 'pi', abbr: false, rb: ['rwy'], src: 'usage',
        sit: 'Tu as dégagé la piste.',
        fr: '{st}, {cs}, piste {rwy} dégagée, {st}.',
        en: '{st}, {cs}, runway {rwy} vacated, {st}.',
      },
    ],
  },

  {
    id: 'panpan', group: 'Urgence', adKind: 'afis', allowHome: true,
    title: 'Urgence : PAN PAN',
    desc: 'Moteur irrégulier, déroutement vers un terrain AFIS.',
    steps: [
      {
        t: 'pi', abbr: false, rb: ['cs'], src: 'manuel',
        sit: 'En navigation, le moteur devient irrégulier et perd des tours. Tu es à {pos}, {alt}, cap {hdg}, {pob}. Tu décides de te dérouter sur {ad}. Émets un message d\'urgence sur la fréquence de {st}.',
        fr: 'PAN PAN, PAN PAN, PAN PAN, {st}, {cs}, {type}, moteur irrégulier, je me déroute sur {ad} pour atterrissage, {pos}, {alt}, cap {hdg}, {pob}.',
        en: 'PAN PAN, PAN PAN, PAN PAN, {st}, {cs}, {type}, rough running engine, diverting to {ad} for landing, {pos}, {alt}, heading {hdg}, {pob}.',
      },
      {
        t: 'st',
        fr: '{cs}, PAN PAN roger, piste {rwy} en service, vent {wind}, QNH {qnh}, rappelez finale.',
        en: '{cs}, PAN PAN roger, runway in use {rwy}, wind {wind}, QNH {qnh}, report final.',
      },
      {
        t: 'pi', abbr: false, rb: ['rwy', 'qnh'], src: 'manuel',
        sit: 'Collationne (la station n\'a pas abrégé ton indicatif).',
        fr: 'Piste {rwy}, QNH {qnh}, je rappelle finale, {cs}.',
        en: 'Runway {rwy}, QNH {qnh}, wilco, {cs}.',
      },
      {
        t: 'pi', abbr: false, rb: ['rwy'], src: 'manuel',
        sit: 'Tu es en finale.',
        fr: '{st}, {cs}, finale piste {rwy}.',
        en: '{st}, {cs}, final runway {rwy}.',
      },
      { t: 'st', fr: '{cs}, piste {rwy} libre, vent {wind}.', en: '{cs}, runway {rwy} free, wind {wind}.' },
      { t: 'pi', abbr: false, rb: ['rwy'], src: 'manuel', sit: 'Annonce ton atterrissage.', fr: 'J\'atterris piste {rwy}, {cs}.', en: 'Landing runway {rwy}, {cs}.' },
    ],
  },

  {
    id: 'mayday', group: 'Urgence', adKind: 'afis', allowHome: true,
    title: 'Détresse : MAYDAY',
    desc: 'Panne moteur en campagne, message de détresse complet.',
    steps: [
      {
        t: 'pi', abbr: false, rb: ['cs'], src: 'manuel',
        sit: 'Panne moteur totale, redémarrage impossible. Tu es à {pos}, {alt}, cap {hdg}, {pob}. Tu vas te poser en campagne. Émets un message de détresse à {st}.',
        fr: 'MAYDAY, MAYDAY, MAYDAY, {st}, {cs}, {type}, panne moteur, atterrissage forcé en campagne, {pos}, {alt}, cap {hdg}, {pob}.',
        en: 'MAYDAY, MAYDAY, MAYDAY, {st}, {cs}, {type}, engine failure, forced landing in a field, {pos}, {alt}, heading {hdg}, {pob}.',
      },
      {
        t: 'st',
        fr: '{cs}, MAYDAY roger, QNH {qnh}, rappelez au sol si possible.',
        en: '{cs}, MAYDAY roger, QNH {qnh}, report on ground if able.',
      },
      {
        t: 'pi', abbr: false, rb: ['qnh'], src: 'manuel',
        sit: 'Collationne brièvement, tu es très occupé.',
        fr: 'QNH {qnh}, {cs}.',
        en: 'QNH {qnh}, {cs}.',
      },
      {
        t: 'pi', abbr: false, rb: [], src: 'usage',
        sit: 'Tu es posé dans un champ, sans blessé. Préviens la station.',
        fr: '{st}, {cs}, posé en campagne, personne n\'est blessé.',
        en: '{st}, {cs}, on ground in a field, no injuries.',
      },
    ],
  },

  {
    id: 'twr-arr', group: 'Aérodrome contrôlé', adKind: 'twr', allowHome: false,
    title: 'Arrivée sur un aérodrome contrôlé',
    desc: 'Clairance d\'intégration, collationnement, clairance d\'atterrissage.',
    steps: [
      { t: 'atis' },
      {
        t: 'pi', abbr: false, rb: [], src: 'manuel',
        sit: 'Tu arrives de {from}, à {pos}, {alt}. Établis le contact.',
        fr: '{st}, {cs}, bonjour.',
        en: '{st}, {cs}, good morning.',
      },
      { t: 'st', fr: '{cs}, {st}, bonjour, j\'écoute.', en: '{cs}, {st}, good morning, pass your message.' },
      {
        t: 'pi', abbr: false, rb: ['cs', 'atis'], src: 'manuel',
        sit: 'Transmets ton message (estimé verticale à {eta}).',
        fr: '{cs}, {type}, VFR de {from} à {ad} pour atterrissage, {pos}, {alt}, estimé verticale terrain à {eta}, information {atis}.',
        en: '{cs}, {type}, VFR from {from} to {ad} for landing, {pos}, {alt}, estimate overhead at {eta}, information {atis}.',
      },
      {
        t: 'st',
        fr: '{csA}, entrez vent arrière main {side} piste {rwy}, QNH {qnh}, rappelez vent arrière.',
        en: '{csA}, join {side} downwind runway {rwy}, QNH {qnh}, report downwind.',
      },
      {
        t: 'pi', abbr: true, rb: ['rwy', 'qnh', 'side'], src: 'manuel',
        sit: 'Collationne la clairance.',
        fr: 'J\'entre vent arrière main {side} piste {rwy}, QNH {qnh}, je rappelle vent arrière, {csA}.',
        en: 'Joining {side} downwind runway {rwy}, QNH {qnh}, reporting downwind, {csA}.',
      },
      {
        t: 'pi', abbr: true, rb: ['rwy', 'side'], src: 'manuel',
        sit: 'Tu es en vent arrière.',
        fr: '{st}, {csA}, vent arrière main {side} piste {rwy}.',
        en: '{st}, {csA}, {side} downwind runway {rwy}.',
      },
      {
        t: 'st',
        fr: '{csA}, numéro 2, trafic précédant un {traf} en base, rappelez finale piste {rwy}.',
        en: '{csA}, number 2, preceding traffic {traf} on base, report final runway {rwy}.',
      },
      {
        t: 'pi', abbr: true, rb: ['rwy'], src: 'manuel',
        sit: 'Tu as le trafic en vue.',
        fr: 'Numéro 2, trafic en vue, je rappelle finale piste {rwy}, {csA}.',
        en: 'Number 2, traffic in sight, reporting final runway {rwy}, {csA}.',
      },
      { t: 'pi', abbr: true, rb: ['rwy'], src: 'manuel', sit: 'Tu es en finale.', fr: '{st}, {csA}, finale piste {rwy}.', en: '{st}, {csA}, final runway {rwy}.' },
      {
        t: 'st',
        fr: '{csA}, vent {wind}, piste {rwy}, autorisé atterrissage.',
        en: '{csA}, wind {wind}, runway {rwy}, cleared to land.',
      },
      {
        t: 'pi', abbr: true, rb: ['rwy'], src: 'manuel',
        sit: 'Collationne la clairance d\'atterrissage.',
        fr: 'J\'atterris piste {rwy}, {csA}.',
        en: 'Landing runway {rwy}, {csA}.',
      },
    ],
  },
];

// Éléments de contenu attendus par la correction locale, transmission pilote par transmission pilote
const NEEDS = {
  'afis-dep': [['type', 'pob', 'vfr', 'to', 'taxi'], ['report'], ['holding', 'ready'], ['lineup', 'takeoff'], ['report'], ['leaving']],
  'afis-arr': [[], ['type', 'vfr', 'from', 'landing', 'pos', 'alt', 'eta'], ['report'], ['downwind'], ['insight', 'report'], ['final'], ['landing'], ['vacated']],
  'afis-circuit': [['type', 'circuits', 'taxi'], ['report'], ['downwind', 'touch'], ['report'], ['final', 'touch'], ['goaround'], ['report'], ['final', 'landing'], ['landing']],
  'afis-transit': [['type', 'vfr', 'from', 'to', 'pos', 'alt', 'transit', 'eta'], ['report'], ['overhead', 'alt'], ['report'], ['leaving']],
  'auto-arr': [['type', 'pos', 'alt', 'downwind'], ['downwind', 'landing'], ['final'], ['vacated']],
  panpan: [['type', 'nature', 'intent', 'pos', 'alt', 'hdg', 'pob'], ['report'], ['final'], ['landing']],
  mayday: [['type', 'nature', 'intent', 'pos', 'alt', 'hdg', 'pob'], [], ['ground', 'injuries']],
  'twr-arr': [[], ['type', 'vfr', 'from', 'landing', 'pos', 'alt', 'eta'], ['downwind', 'report'], ['downwind'], ['number', 'insight'], ['final'], ['landing']],
};
const URGENCY = { panpan: 'panpan', mayday: 'mayday' };

for (const scn of SCENARIOS) {
  const pilotSteps = scn.steps.filter((st) => st.t === 'pi');
  (NEEDS[scn.id] || []).forEach((need, i) => { if (pilotSteps[i]) pilotSteps[i].need = need; });
  if (URGENCY[scn.id] && pilotSteps[0]) pilotSteps[0].urg = URGENCY[scn.id];
}
