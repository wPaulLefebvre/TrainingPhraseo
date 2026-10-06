// Évaluation des transmissions, sans aucun coût d'API :
//  - ouverte dans claude.ai (artefact publié) : correction par Claude, décomptée de l'utilisation
//    Claude de la personne qui utilise la page (capacité « sample ») ;
//  - partout ailleurs (GitHub Pages, hors ligne) : moteur de règles local.

import { PHON } from './radio.js';
import { RB_LABELS } from './scenarios.js';

// ── Détection du moteur Claude ────────────────────────────────────
let samplePromise = null;
let sampleBlocked = false; // refus de consentement ou indisponibilité pendant cette visite

export function getSample() {
  if (sampleBlocked) return Promise.resolve(null);
  if (!samplePromise) {
    samplePromise = window.claude?.use
      ? window.claude.use('sample').catch(() => null)
      : Promise.resolve(null);
  }
  return samplePromise;
}

export async function engineName(settings) {
  if (settings.engine === 'local') return 'local';
  return (await getSample()) ? 'claude' : 'local';
}

const BLOCKING = ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed', 'session_expired'];
const ERROR_COPY = {
  not_granted: 'Correction par Claude refusée pour cette visite.',
  rate_limited: 'Trop de demandes en même temps.',
  session_expired: 'Session claude.ai expirée, recharge la page.',
  invalid_json: 'Réponse de Claude illisible.',
  upstream_error: 'Claude est momentanément indisponible.',
};

async function askClaude(prompt, tier) {
  const sample = await getSample();
  if (!sample) throw Object.assign(new Error('Claude indisponible'), { code: 'unavailable' });
  try {
    return await sample.json(prompt, { modelTier: tier });
  } catch (e) {
    if (BLOCKING.includes(e?.code)) sampleBlocked = true;
    throw Object.assign(new Error(ERROR_COPY[e?.code] || 'Correction par Claude impossible.'), { code: e?.code });
  }
}

// ── Consignes données à Claude ────────────────────────────────────
const RULES = `RÉFÉRENCE : Manuel de phraséologie à l'usage de la circulation aérienne générale, DSNA, 10e édition (15 avril 2023), conforme SERA. Règles principales :
1. Premier appel : indicatif COMPLET. L'indicatif abrégé (premier caractère + deux derniers, ex. F-GKAJ → F-AJ) n'est utilisable qu'après que la station l'a employé elle-même.
2. Collationnement : le pilote répète piste, QNH, fréquence, code transpondeur, cap, niveau/altitude, conditions des clairances conditionnelles, instructions de circuit, et termine par son indicatif. « Roger » ne remplace JAMAIS un collationnement ni une réponse affirme/négatif.
3. Le pilote collationne les clairances de décollage et d'atterrissage par « je décolle »/« taking off » et « j'atterris »/« landing ». « Autorisé » est réservé au contrôleur.
4. AFIS : l'agent AFIS ne délivre AUCUNE clairance. Le pilote annonce ses intentions (« je m'aligne et je décolle », « j'atterris »), ne demande pas d'autorisation ; l'AFIS informe (« piste libre », trafic, vent, QNH).
5. Expressions conventionnelles (SERA.14045) : affirme/affirm, négatif/negative, répétez/say again, wilco, roger, standby, correction, je répète/I say again, rappelez/report. « Over » et « out » ne s'emploient normalement pas en VHF. Pas de « oui », « non », « OK », « pardon ».
6. La piste est toujours désignée par « piste »/« runway » suivi de son identification. Fréquences avec « décimale »/« decimal ».
7. Au premier contact, annoncer l'information ATIS reçue.
8. Message d'arrivée/transit VFR : indicatif, type, VFR de… à…, intention, position, altitude, estimée, information ATIS.
9. Détresse : « MAYDAY » x3, organisme, indicatif, nature, intentions, position, niveau, cap. Urgence : « PAN PAN » x3, même structure.
10. Messages brefs ; langage clair seulement si la phraséologie normalisée ne convient pas.
11. En anglais : nombres chiffre par chiffre pour piste, cap, vent, QNH (sauf milliers ronds), transpondeur.
12. Auto-information (pratique usuelle, hors manuel) : nom du terrain en début ET en fin de message, indicatif complet, position, intentions.
13. Circuit : vent arrière, base, finale, « main gauche/droite », « pour un toucher », « atterrissage complet », « je remets les gaz »/« going around ».
TOLÉRANCE : le texte vient d'une reconnaissance vocale. Ignore ponctuation, majuscules, chiffres en lettres ou en chiffres, « juliette »/« juliett », « m'aider » pour « mayday », homophones évidents. En cas de doute, sévérité « conseil » avec la mention « possiblement dû à la reconnaissance vocale ».
VARIANTES : la réponse modèle est indicative ; une formulation différente mais conforme est correcte. N'invente pas de règle ; une remarque qui relève de l'usage plutôt que du manuel porte la source « usage ».`;

const STEP_SCHEMA = `{"note": <entier 0-10>, "verdict": "correct"|"acceptable"|"incorrect",
 "collationnement": [{"element": "QNH", "attendu": "1018", "entendu": "1018 ou absent", "ok": true}],
 "erreurs": [{"severite": "majeure"|"mineure"|"conseil", "categorie": "collationnement"|"indicatif"|"terminologie"|"omission"|"ordre"|"superflu"|"nombres"|"autre", "entendu": "<extrait>", "correction": "<formulation correcte>", "explication": "<1 phrase>", "source": "manuel"|"usage"}],
 "version_corrigee": "<transmission complète correcte, dans la langue de l'exercice>",
 "commentaire": "<1 à 2 phrases, en français>"}`;

const INTRO = `Tu es instructeur radiotéléphonie VFR pour l'examen PPL en France (normes DGAC/DSNA). Tu évalues les transmissions d'un élève pilote.
Barème : majeure = collationnement faux ou absent, indicatif faux, terme dangereux ou contraire au type de service ; mineure = ordre, formulation non standard, mot superflu ; conseil = amélioration facultative. Explications en français, concises.`;

function serviceLabel(kind) {
  return { afis: 'AFIS (information de vol, pas de clairance)', twr: 'Tour de contrôle (clairances ATC)', auto: 'Auto-information (aucune station au sol)' }[kind];
}

export function describeStep(ex) {
  return {
    service: serviceLabel(ex.kind),
    langue: ex.lang === 'fr' ? 'français' : 'anglais',
    message_station_precedent: ex.prevStation || '(aucun)',
    situation: ex.situation,
    indicatif_complet: ex.cs,
    indicatif_abrege: ex.csA,
    indicatif_abrege_autorise: ex.abbr,
    elements_obligatoires: ex.rb.map((k) => ({ element: RB_LABELS[k], valeur: k === 'atis' ? `${ex.rbValues[k]} (${PHON[ex.rbValues[k]]})` : ex.rbValues[k] })),
    reponse_modele: ex.model,
    origine_modele: ex.src === 'usage' ? 'pratique usuelle hors manuel' : 'manuel DSNA',
    transmission_eleve: ex.transcript,
  };
}

// Évalue une transmission. Repli automatique sur les règles locales.
export async function evaluateStep(settings, ex) {
  if ((await engineName(settings)) === 'claude') {
    try {
      const prompt = `${INTRO}\n${RULES}\n\nÉvalue cette transmission :\n${JSON.stringify(describeStep(ex), null, 1)}\n\nRéponds uniquement par un objet JSON de cette forme :\n${STEP_SCHEMA}`;
      const ev = await askClaude(prompt, 'quick');
      if (ev && typeof ev === 'object' && 'verdict' in ev) return { ...ev, engine: 'claude' };
      throw new Error('Réponse de Claude incomplète.');
    } catch (e) {
      const ev = localCheck(ex);
      ev.commentaire = `${e.message} Correction locale utilisée. ${ev.commentaire}`;
      return ev;
    }
  }
  return localCheck(ex);
}

// Débrief du mode expérimenté : un seul appel pour tout le scénario
export async function evaluateSession(settings, exchanges, meta) {
  if ((await engineName(settings)) === 'claude' && exchanges.length) {
    try {
      const prompt = `${INTRO}\n${RULES}\n\nDébrief d'un scénario complet « ${meta.title} » (${meta.ad}, ${meta.lang === 'fr' ? 'français' : 'anglais'}). Évalue chaque transmission puis fais une synthèse. Transmissions :\n${JSON.stringify(exchanges.map(describeStep), null, 1)}\n\nRéponds uniquement par un objet JSON :\n{"note_globale": <0-10>, "synthese": "<3 phrases max>", "points_forts": ["..."], "axes_de_progres": ["..."], "etapes": [<un objet par transmission, dans l'ordre, au format ${STEP_SCHEMA}>]}`;
      const d = await askClaude(prompt, 'default');
      if (d && Array.isArray(d.etapes)) {
        d.etapes = d.etapes.map((e) => ({ ...e, engine: 'claude' }));
        return d;
      }
      throw new Error('Réponse de Claude incomplète.');
    } catch (e) {
      return localDebrief(exchanges, `${e.message} Correction locale utilisée.`);
    }
  }
  return localDebrief(exchanges);
}

function localDebrief(exchanges, note) {
  const etapes = exchanges.map(localCheck);
  const avg = etapes.length ? Math.round(etapes.reduce((t, e) => t + e.note, 0) / etapes.length * 10) / 10 : null;
  const cats = {};
  etapes.forEach((e) => e.erreurs.forEach((x) => { if (x.severite !== 'conseil') cats[x.categorie] = (cats[x.categorie] || 0) + 1; }));
  const top = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, n]) => `${c} (${n})`);
  return {
    local: true,
    note_globale: avg,
    synthese: `${note ? `${note} ` : ''}${top.length ? `Points à travailler : ${top.join(', ')}.` : 'Aucune erreur détectée par les règles locales.'}`,
    points_forts: [], axes_de_progres: [], etapes,
  };
}

// ── Moteur de règles local ────────────────────────────────────────
const LETTER_RX = {
  A: 'alfa|alpha', B: 'bravo', C: 'charlie', D: 'delta', E: 'echo', F: 'fox', G: 'golf', H: 'hotel', I: 'india',
  J: 'juliet', K: 'kilo', L: 'lima', M: 'mike|maik', N: 'november|novembre', O: 'oscar', P: 'papa', Q: 'quebec|kebec',
  R: 'romeo', S: 'sierra', T: 'tango', U: 'uniform', V: 'victor', W: 'whisk', X: 'x ?ray|xray|ix ?re', Y: 'yankee|yanki', Z: 'zulu|zoulou',
};
const WORD_DIGITS = {
  zero: 0, un: 1, une: 1, one: 1, deux: 2, two: 2, trois: 3, three: 3, tree: 3, quatre: 4, four: 4,
  cinq: 5, five: 5, fife: 5, six: 6, sept: 7, seven: 7, huit: 8, eight: 8, neuf: 9, nine: 9, niner: 9,
};

const strip = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function normalize(t) {
  let s = ` ${strip(t.toLowerCase())} `.replace(/[.,;:!?'’"«»()-]/g, ' ');
  s = s.replace(/\b[a-z]+\b/g, (w) => (w in WORD_DIGITS ? String(WORD_DIGITS[w]) : w));
  s = s.replace(/(\d)\s+(?=\d)/g, '$1');
  return s.replace(/\s+/g, ' ');
}

// Positions (index de mot) des lettres phonétiques reconnues, dans l'ordre du texte
function letterHits(norm) {
  const words = norm.trim().split(' ');
  const hits = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i] + (words[i + 1] ? ` ${words[i + 1]}` : '');
    for (const [L, rx] of Object.entries(LETTER_RX)) {
      if (new RegExp(`^(${rx})`).test(w)) { hits.push({ L, i }); break; }
    }
  }
  return { hits, count: words.length };
}

// Cherche une suite de lettres (sous-séquence ordonnée et compacte) ; renvoie l'index du dernier mot ou -1
function findSeq(hits, letters) {
  for (let s = 0; s < hits.length; s++) {
    if (hits[s].L !== letters[0]) continue;
    let k = 1, last = hits[s].i, j = s + 1;
    while (k < letters.length && j < hits.length) {
      if (hits[j].i - last > 2) break;
      if (hits[j].L === letters[k]) { k++; last = hits[j].i; }
      j++;
    }
    if (k === letters.length) return last;
  }
  return -1;
}
function findSeqLast(hits, letters) {
  let res = -1;
  for (let s = 0; s < hits.length; s++) {
    const r = findSeq(hits.slice(s), letters);
    if (r > res) res = r;
  }
  return res;
}

const has = (norm, rx) => new RegExp(rx).test(norm);

// Éléments attendus par étape (champ « need » des scénarios)
const NEED = {
  type: { label: "Type d'avion", test: (n, ex) => has(n, strip(ex.acType || 'dr400').toLowerCase().replace(/[^a-z0-9]/g, '').split('').join(' ?')) || has(n, '(robin|cessna|piper|tecnam|aquila|dr ?4|pa ?28|c ?1[57]2)') },
  vfr: { label: 'VFR', test: (n) => has(n, 'v ?f ?r') },
  pos: { label: 'Position', test: (n) => has(n, '\\b(nm|nautique|mile|nord|sud|est|ouest|north|south|east|west)') },
  alt: { label: 'Altitude', test: (n) => has(n, '(pied|feet|ft)\\b') },
  eta: { label: 'Heure estimée', test: (n) => has(n, 'estim') },
  hdg: { label: 'Cap', test: (n) => has(n, '\\b(cap|heading)\\b') },
  pob: { label: 'Personnes à bord', test: (n) => has(n, '(personne|a bord|persons|on board|pob)') },
  from: { label: 'Provenance', test: (n, ex) => has(n, strip(ex.fromName).toLowerCase().split(' ')[0]) },
  to: { label: 'Destination', test: (n, ex) => has(n, strip(ex.toName).toLowerCase().split(' ')[0]) },
  landing: { label: 'Atterrissage', test: (n) => has(n, '(atterri|landing|full stop|atterrissage complet)') },
  takeoff: { label: 'Décollage', test: (n) => has(n, '(decoll|taking off|take off)') },
  lineup: { label: 'Alignement', test: (n) => has(n, '(align|lining up|line up)') },
  taxi: { label: 'Demande de roulage', test: (n) => has(n, '(roul|taxi)') },
  goaround: { label: 'Remise de gaz', test: (n) => has(n, '(remet|remise|going around|go around)') },
  touch: { label: 'Toucher', test: (n) => has(n, '(toucher|touch)') },
  downwind: { label: 'Vent arrière', test: (n) => has(n, '(vent arriere|downwind)') },
  final: { label: 'Finale', test: (n) => has(n, 'final') },
  vacated: { label: 'Piste dégagée', test: (n) => has(n, '(degag|vacat)') },
  leaving: { label: 'Quitte la fréquence / le circuit', test: (n) => has(n, '(quitt|leaving)') },
  ready: { label: 'Prêt au départ', test: (n) => has(n, '(pret|ready)') },
  holding: { label: "Point d'arrêt", test: (n) => has(n, '(point d ?arret|holding)') },
  overhead: { label: 'Verticale', test: (n) => has(n, '(verticale|overhead)') },
  transit: { label: 'Transit', test: (n) => has(n, 'transit') },
  insight: { label: 'Trafic en vue', test: (n) => has(n, '(en vue|in sight)') },
  number: { label: 'Numéro dans la séquence', test: (n) => has(n, '(numero|number) ?2') },
  report: { label: 'Accusé de réception (je rappelle / wilco)', test: (n) => has(n, '(rappel|wilco|report)') },
  circuits: { label: 'Tours de piste', test: (n) => has(n, '(tours? de piste|circuit)') },
  nature: { label: 'Nature du problème', test: (n) => has(n, '(moteur|engine|panne|failure|rough)') },
  intent: { label: 'Intentions', test: (n) => has(n, '(deroute|divert|atterri|landing|campagne|field|force)') },
  ground: { label: 'Posé', test: (n) => has(n, '(pose|on ground|au sol|landed)') },
  injuries: { label: 'Blessés', test: (n) => has(n, '(bless|injur)') },
};

const TERMS = [
  { rx: '\\b(ok|okay|d accord|dac)\\b', sev: 'mineure', cat: 'terminologie', said: 'OK / d\'accord', fr: 'roger / wilco', en: 'roger / wilco', why: '« OK » n\'est pas une expression conventionnelle (SERA.14045).' },
  { rx: '^ ?(oui|yes|yeah)\\b|\\b(oui|yes)\\b', sev: 'mineure', cat: 'terminologie', said: 'oui / yes', fr: 'affirme', en: 'affirm', why: 'Répondre « affirme » / « affirm », pas « oui ».' },
  { rx: '^ ?(non|no)\\b', sev: 'mineure', cat: 'terminologie', said: 'non / no', fr: 'négatif', en: 'negative', why: 'Répondre « négatif » / « negative », pas « non ».' },
  { rx: '\\b(pardon|quoi|what)\\b', sev: 'mineure', cat: 'terminologie', said: 'pardon', fr: 'répétez', en: 'say again', why: 'Pour faire répéter : « répétez » / « say again ».' },
  { rx: '\\b(over|out|termine)\\s*$', sev: 'mineure', cat: 'superflu', said: 'over / out', fr: '(rien)', en: '(nothing)', why: '« Over » et « out » ne s\'emploient normalement pas en VHF.' },
  { rx: '\\b(merci|thank you|thanks)\\b', sev: 'conseil', cat: 'superflu', said: 'merci', fr: '(à supprimer)', en: '(remove)', why: 'Formule de politesse superflue en dehors du premier et du dernier contact.' },
  { rx: '\\b(euh|heu|hum|uh|um)\\b', sev: 'conseil', cat: 'superflu', said: 'euh', fr: '(à supprimer)', en: '(remove)', why: 'Prépare ton message avant d\'appuyer sur l\'alternat.' },
];

export function localCheck(ex) {
  const norm = normalize(ex.transcript);
  const { hits, count } = letterHits(norm);
  const erreurs = [];
  const coll = [];
  const add = (severite, categorie, entendu, correction, explication, source = 'manuel') =>
    erreurs.push({ severite, categorie, entendu, correction, explication, source });

  // 1. Indicatif
  const full = ex.cs.replace(/[^A-Z0-9]/gi, '').toUpperCase().split('');
  const abbrL = [full[0], ...full.slice(-2)];
  const fullEnd = findSeqLast(hits, full);
  const abbrEnd = findSeqLast(hits, abbrL);
  const csEnd = Math.max(fullEnd, abbrEnd);
  const csSpoken = full.map((l) => PHON[l]).join(' ');
  const abbrSpoken = abbrL.map((l) => PHON[l]).join(' ');
  if (csEnd < 0) {
    add('majeure', 'indicatif', '—', ex.abbr ? `${ex.csA} (${abbrSpoken})` : `${ex.cs} (${csSpoken})`,
      'Indicatif absent ou erroné : il doit figurer dans chaque transmission, en alphabet phonétique.');
  } else if (!ex.abbr && fullEnd < 0) {
    add('majeure', 'indicatif', ex.csA, `${ex.cs} (${csSpoken})`,
      'Indicatif complet obligatoire tant que la station ne l\'a pas abrégé elle-même.');
  }
  if (ex.rb.includes('cs')) coll.push({ element: RB_LABELS.cs, attendu: ex.cs, entendu: fullEnd >= 0 ? ex.cs : (abbrEnd >= 0 ? ex.csA : 'absent'), ok: fullEnd >= 0 });
  // Indicatif en fin de collationnement
  const endsWithCs = /\{csA?\}\.?\s*$/.test(ex.modelTpl || '') || ex.model.trim().replace(/\.$/, '').endsWith(ex.abbr ? ex.csA : ex.cs);
  const isReadback = ex.rb.some((k) => ['qnh', 'rwy', 'side', 'freq'].includes(k));
  if (csEnd >= 0 && endsWithCs && count - 1 - csEnd > 2) {
    add(isReadback ? 'mineure' : 'conseil', 'ordre', '…', 'indicatif en fin de message', 'Dans un collationnement ou une réponse, l\'indicatif se place à la fin.');
  }

  // 2. Nom de la station en début de message (appel)
  if (ex.stationFirst && ex.stationName) {
    const st = strip(ex.stationName.toLowerCase()).split(' ')[0];
    const firstWords = norm.trim().split(' ').slice(0, 3).join(' ');
    if (!firstWords.includes(st)) {
      const wrong = norm.match(/^\s*(?:mayday \S+ \S+ |pan pan pan pan pan pan )?([a-z]+(?: [a-z]+)?) (information|info|tour|tower|traffic)\b/);
      if (wrong) add('majeure', 'autre', `${wrong[1]} ${wrong[2]}`, ex.stationName, 'Mauvaise station appelée : vérifie le nom de l\'organisme avant d\'émettre.');
      else add('mineure', 'ordre', '—', ex.stationName, 'Un appel commence par le nom de la station appelée.');
    }
  }
  if (ex.kind === 'auto' && ex.stationName) {
    const st = strip(ex.stationName.toLowerCase()).split(' ')[0];
    const lastWords = norm.trim().split(' ').slice(-3).join(' ');
    if (!lastWords.includes(st)) add('mineure', 'ordre', '—', `… ${ex.stationName}`, 'En auto-information, le message se termine par le nom du terrain.', 'usage');
  }

  // 3. Collationnement des valeurs
  const nums = (norm.match(/\d+/g) || []);
  for (const k of ex.rb) {
    if (k === 'cs') continue;
    const val = String(ex.rbValues[k]);
    let ok = false, said = 'absent';
    if (k === 'qnh') {
      ok = nums.includes(val);
      const other = nums.find((n) => /^(9[5-9]\d|10[0-4]\d)$/.test(n) && n !== val);
      if (!ok && other) said = other;
    } else if (k === 'rwy') {
      const m = norm.match(/(piste|runway)\s*(\d{1,2})/);
      ok = nums.some((n) => n === val || n === String(+val));
      if (m && +m[2] !== +val) { ok = false; said = m[2]; }
    } else if (k === 'side') {
      const left = /gauche|left/.test(val);
      ok = left ? /gauche|left/.test(norm) : /droite|right/.test(norm);
      if (!ok && (left ? /droite|right/.test(norm) : /gauche|left/.test(norm))) said = left ? 'droite' : 'gauche';
    } else if (k === 'atis') {
      const m = norm.match(/information\s+([a-z]+(?: [a-z]+)?)/);
      ok = new RegExp(`information (${LETTER_RX[val]}|${val.toLowerCase()}\\b)`).test(norm);
      if (!ok && m) said = m[1];
    } else if (k === 'freq') {
      ok = norm.replace(/\s/g, '').includes(val.replace(/\D/g, '').replace(/0+$/, ''));
    }
    coll.push({ element: RB_LABELS[k], attendu: k === 'atis' ? `${val} (${PHON[val]})` : val, entendu: ok ? val : said, ok });
    if (!ok) {
      add('majeure', 'collationnement', said, k === 'atis' ? `information ${PHON[val]}` : `${RB_LABELS[k]} ${val}`,
        said === 'absent'
          ? (k === 'atis' ? 'Annonce l\'information ATIS reçue dès le premier contact.' : `Élément « ${RB_LABELS[k]} » à collationner.`)
          : `Valeur erronée : « ${said} » au lieu de « ${val} ».`);
    }
  }

  // 4. « Roger » à la place d'un collationnement
  const needsReadback = ex.rb.some((k) => ['qnh', 'rwy', 'side', 'freq'].includes(k));
  if (needsReadback && /\broger\b/.test(norm) && coll.some((c) => !c.ok)) {
    add('majeure', 'collationnement', 'roger', 'collationnement complet', '« Roger » ne remplace jamais un collationnement.');
  }

  // 5. Clairances et service
  if (/\b(autoris|clearance|cleared|clear for)/.test(norm)) {
    if (ex.kind === 'afis' || ex.kind === 'auto') {
      add('majeure', 'terminologie', 'autorisation / clearance', 'annonce d\'intention (je m\'aligne et je décolle, j\'atterris)',
        ex.kind === 'afis' ? 'Un AFIS ne délivre aucune clairance : le pilote annonce ses intentions.' : 'En auto-information, personne ne délivre de clairance.');
    } else {
      add('majeure', 'terminologie', 'autorisé', ex.lang === 'fr' ? 'j\'atterris / je décolle' : 'landing / taking off',
        '« Autorisé » est réservé au contrôleur ; le pilote collationne par « j\'atterris » / « je décolle ».');
    }
  }

  // 6. Éléments de contenu attendus
  for (const key of ex.need || []) {
    const n = NEED[key];
    if (n && !n.test(norm, ex)) add(['nature', 'intent'].includes(key) ? 'majeure' : 'mineure', 'omission', 'absent', n.label, `Élément attendu dans ce message : ${n.label.toLowerCase()}.`);
  }

  // 7. Messages de détresse et d'urgence
  if (ex.urgency) {
    const word = ex.urgency === 'mayday' ? '(mayday|m aider|mai de)' : '(pan)';
    const c = (norm.match(new RegExp(word, 'g')) || []).length;
    const expected = ex.urgency === 'mayday' ? 3 : 6;
    if (c === 0) add('majeure', 'omission', 'absent', ex.urgency === 'mayday' ? 'MAYDAY MAYDAY MAYDAY' : 'PAN PAN, PAN PAN, PAN PAN', 'Le message doit commencer par le signal de détresse ou d\'urgence.');
    else if (c < expected) add('mineure', 'ordre', `${c}×`, ex.urgency === 'mayday' ? 'MAYDAY ×3' : 'PAN PAN ×3', 'Le signal se prononce de préférence trois fois (SERA.14095).');
  }

  // 8. Termes non conventionnels
  for (const t of TERMS) {
    if (new RegExp(t.rx).test(norm)) add(t.sev, t.cat, t.said, ex.lang === 'fr' ? t.fr : t.en, t.why);
  }
  // En anglais : piste/runway
  if (ex.lang === 'en' && ex.rb.includes('rwy') && /\bpiste\b/.test(norm)) add('majeure', 'terminologie', 'piste', 'runway', 'Exercice en anglais : « runway ».');
  if (ex.lang === 'fr' && ex.rb.includes('rwy') && /\brunway\b/.test(norm)) add('majeure', 'terminologie', 'runway', 'piste', 'Exercice en français : « piste ».');

  const majors = erreurs.filter((e) => e.severite === 'majeure').length;
  const minors = erreurs.filter((e) => e.severite === 'mineure').length;
  const note = Math.max(0, 10 - majors * 3 - minors);
  return {
    local: true, engine: 'local',
    note,
    verdict: majors ? 'incorrect' : minors ? 'acceptable' : 'correct',
    collationnement: coll,
    erreurs,
    version_corrigee: ex.model,
    commentaire: majors || minors ? '' : 'Rien à signaler par les règles locales.',
  };
}
