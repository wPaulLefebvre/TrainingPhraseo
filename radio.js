// Génération du contexte d'un exercice et mise en forme radio (affichage + énonciation vocale).
// Règles d'énonciation tirées du Manuel de phraséologie DSNA (10e éd., avril 2023), chapitre 2.E.

import { AERODROMES } from './aerodromes.js';

export const PHON = {
  A: 'Alfa', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Fox', G: 'Golf', H: 'Hotel',
  I: 'India', J: 'Juliett', K: 'Kilo', L: 'Lima', M: 'Mike', N: 'November', O: 'Oscar', P: 'Papa',
  Q: 'Québec', R: 'Roméo', S: 'Sierra', T: 'Tango', U: 'Uniform', V: 'Victor', W: 'Whiskey',
  X: 'X-ray', Y: 'Yankee', Z: 'Zulu',
};
const EN_DIGITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'niner'];
const FR_DIGITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pad = (n, l = 2) => String(n).padStart(l, '0');

export const digitsEN = (s) => String(s).split('').map((c) => (/\d/.test(c) ? EN_DIGITS[+c] : c)).join(' ');
export const digitsFR = (s) => String(s).split('').map((c) => (/\d/.test(c) ? FR_DIGITS[+c] : c)).join(' ');
export const spellPhon = (s) => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '').split('')
  .map((c) => PHON[c] || EN_DIGITS[+c]).join(' ');

// Indicatif abrégé (type a) : premier caractère + deux derniers (GM1 SERA.14050)
export function abbreviate(reg) {
  const clean = reg.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `${clean[0]}-${clean.slice(-2)}`;
}

// Altitude en anglais : milliers "thousand", centaines "hundred"
function altEN(n) {
  const th = Math.floor(n / 1000), hu = Math.floor((n % 1000) / 100);
  let s = '';
  if (th) s += `${digitsEN(th)} thousand`;
  if (hu) s += `${s ? ' ' : ''}${digitsEN(hu)} hundred`;
  return s || digitsEN(n);
}
const fmtThousands = (n) => (n >= 1000 ? `${Math.floor(n / 1000)} ${pad(n % 1000, 3)}` : String(n));

// QNH anglais : 1000 → "one thousand", sinon chiffre par chiffre
const qnhEN = (q) => (q % 1000 === 0 ? `${digitsEN(q / 1000)} thousand` : digitsEN(q));

// Fréquence : 5e et 6e chiffres non énoncés s'ils valent zéro
function freqSpokenEN(f) {
  let [a, b] = f.split('.');
  b = b.replace(/0+$/, '') || '0';
  return `${digitsEN(a)} decimal ${digitsEN(b)}`;
}
function freqSpokenFR(f) {
  let [a, b] = f.split('.');
  b = b.replace(/0+$/, '') || '0';
  return `${a} décimale ${b}`;
}

const DIRS = [
  { fr: 'au nord', en: 'north', deg: 0 }, { fr: 'au nord-est', en: 'north-east', deg: 45 },
  { fr: "à l'est", en: 'east', deg: 90 }, { fr: 'au sud-est', en: 'south-east', deg: 135 },
  { fr: 'au sud', en: 'south', deg: 180 }, { fr: 'au sud-ouest', en: 'south-west', deg: 225 },
  { fr: "à l'ouest", en: 'west', deg: 270 }, { fr: 'au nord-ouest', en: 'north-west', deg: 315 },
];

const TRAFFIC = [
  { d: 'DR400', fr: 'D R quatre cents', en: 'D R four hundred' },
  { d: 'Cessna 172', fr: 'Cessna cent soixante-douze', en: 'Cessna one seven two' },
  { d: 'PA28', fr: 'P A vingt-huit', en: 'P A two eight' },
  { d: 'Robin DR500', fr: 'Robin D R cinq cents', en: 'Robin D R five hundred' },
  { d: 'ULM', fr: 'U L M', en: 'microlight' },
];

const REMARKS = [
  null, null,
  { fr: 'Activité parachutage en cours, verticale terrain, jusqu\'au niveau 120', en: 'Parachute activity in progress overhead the aerodrome up to level 120' },
  { fr: 'PAPI piste {rwy} en panne', en: 'PAPI runway {rwy} unserviceable' },
  { fr: 'Péril aviaire', en: 'Bird hazard' },
  { fr: 'Travaux en bordure de piste {rwy}', en: 'Work in progress next to runway {rwy}' },
];

const CLOUDS = [
  { cavok: true },
  { fr: 'peu', en: 'few', h: [1500, 2000, 2500, 3000, 3500] },
  { fr: 'épars', en: 'scattered', h: [2000, 2500, 3000, 4000] },
  { fr: 'fragmentés', en: 'broken', h: [3000, 3500, 4500] },
];

// Valeur à double forme : affichée (d) et énoncée (s), éventuellement par langue
const v = (d, s = d) => ({ d, s });
const vl = (fr, en) => ({ fr, en });

function pickRunway(ad, windDir) {
  // Choisit le QFU le plus face au vent
  let best = ad.rwys[0], bestDiff = 999;
  for (const r of ad.rwys) {
    const diff = Math.abs(((+r * 10 - windDir + 540) % 360) - 180);
    if (diff < bestDiff) { bestDiff = diff; best = r; }
  }
  return best;
}

export function aircraftList(settings) {
  return (settings.aircraft || []).filter((a) => a.reg && a.reg.replace(/[^A-Z0-9]/gi, '').length >= 4);
}

export function buildContext(scn, settings) {
  const pool = AERODROMES.filter((a) => a.kind === scn.adKind);
  const preferred = settings.homeAd && pool.find((a) => a.oaci === settings.homeAd);
  const ad = scn.allowHome && preferred && Math.random() < 0.4 ? preferred : pick(pool);
  const others = AERODROMES.filter((a) => a.oaci !== ad.oaci);
  const from = pick(others);
  const to = pick(others.filter((a) => a.oaci !== from.oaci));

  const acList = aircraftList(settings);
  const ac = acList.length ? pick(acList) : { reg: 'F-GABC', type: 'DR400' };
  const reg = ac.reg.toUpperCase().replace(/\s/g, '');
  const regClean = reg.replace(/[^A-Z0-9]/g, '');
  const regDisp = regClean.length > 1 ? `${regClean[0]}-${regClean.slice(1)}` : reg;
  const abbr = abbreviate(reg);

  const windDir = rnd(0, 35) * 10 || 360;
  const windSpd = rnd(3, 14);
  const gust = Math.random() < 0.15 ? windSpd + rnd(8, 12) : null;
  const rwy = pickRunway(ad, windDir);
  const qnh = rnd(1004, 1029);
  const atis = String.fromCharCode(65 + rnd(0, 25));
  const now = new Date();
  const recMin = Math.max(0, now.getUTCMinutes() - rnd(5, 25));
  const recTime = `${pad(now.getUTCHours())}${pad(Math.floor(recMin / 10) * 10)}`;
  const temp = rnd(4, 27);
  const dew = temp - rnd(1, 9);
  const cloud = pick(CLOUDS);
  const cloudH = cloud.cavok ? null : pick(cloud.h);
  const vis = cloud.cavok ? null : pick([10, 10, 9, 8, 7]);
  const side = Math.random() < 0.7 ? 'gauche' : 'droite';
  const dir = pick(DIRS);
  const dist = rnd(8, 15);
  const alt = pick([1500, 2000, 2500, 3000]);
  const etaMin = (now.getUTCMinutes() + rnd(6, 12)) % 60;
  const pob = rnd(1, 3);
  const hdg = (dir.deg + 180) % 360; // vers le terrain
  const traffic = pick(TRAFFIC);
  const remark = pick(REMARKS);
  const exitDir = pick(DIRS);

  const windFR = `${pad(windDir, 3)} degrés, ${windSpd} nœuds${gust ? `, rafales ${gust} nœuds` : ''}`;
  const windFRs = `${digitsFR(pad(windDir, 3))} degrés, ${windSpd} nœuds${gust ? `, rafales ${gust} nœuds` : ''}`;
  const windEN = `${pad(windDir, 3)} degrees, ${windSpd} knots${gust ? ` gusting ${gust} knots` : ''}`;
  const windENs = `${digitsEN(pad(windDir, 3))} degrees, ${digitsEN(windSpd)} knots${gust ? ` gusting ${digitsEN(gust)} knots` : ''}`;

  const stName = {
    afis: vl(v(`${ad.name} Information`), v(`${ad.name} Information`)),
    twr: vl(v(`${ad.name} Tour`), v(`${ad.name} Tower`)),
    auto: vl(v(ad.name), v(`${ad.name} traffic`)),
  }[ad.kind];

  const vars = {
    cs: v(regDisp, spellPhon(regClean)),
    csA: v(abbr, spellPhon(abbr)),
    type: v(ac.type || 'DR400'),
    st: stName,
    ad: v(ad.name),
    from: v(from.name),
    to: v(to.name),
    rwy: vl(v(rwy, rwy.startsWith('0') ? digitsFR(rwy) : rwy), v(rwy, digitsEN(rwy))),
    qnh: vl(v(String(qnh), String(qnh)), v(String(qnh), qnhEN(qnh))),
    atis: v(atis, PHON[atis]),
    wind: vl(v(windFR, windFRs), v(windEN, windENs)),
    side: vl(v(side), v(side === 'gauche' ? 'left-hand' : 'right-hand')),
    pos: vl(v(`${dist} NM ${dir.fr} de ${ad.name}`, `${dist} nautiques ${dir.fr} de ${ad.name}`),
      v(`${dist} NM ${dir.en} of ${ad.name}`, `${digitsEN(dist)} miles ${dir.en} of ${ad.name}`)),
    alt: vl(v(`${fmtThousands(alt)} pieds`), v(`${fmtThousands(alt)} feet`, `${altEN(alt)} feet`)),
    altT: vl(v(`${fmtThousands(alt + 500)} pieds`), v(`${fmtThousands(alt + 500)} feet`, `${altEN(alt + 500)} feet`)),
    eta: vl(v(pad(etaMin)), v(pad(etaMin), digitsEN(pad(etaMin)))),
    pob: vl(v(`${pob} personne${pob > 1 ? 's' : ''} à bord`), v(`${pob} person${pob > 1 ? 's' : ''} on board`)),
    hdg: vl(v(pad(hdg || 360, 3), digitsFR(pad(hdg || 360, 3))), v(pad(hdg || 360, 3), digitsEN(pad(hdg || 360, 3)))),
    traf: vl(v(traffic.d, traffic.fr), v(traffic.d, traffic.en)),
    freq: vl(v(ad.freq.replace('.', ','), freqSpokenFR(ad.freq)), v(ad.freq, freqSpokenEN(ad.freq))),
    exit: vl(v(exitDir.fr.replace(/^(au |à l')/, (m) => (m === 'au ' ? 'le ' : "l'"))), v(exitDir.en)),
  };

  const ctx = {
    ad, from, to, reg: regDisp, abbr, acType: ac.type, rwy, qnh, atis, windDir, windSpd, gust, temp, dew,
    side, recTime, cloud, cloudH, vis, remark, vars,
    // Valeurs clés exposées pour le contrôle des collationnements
    keys: { rwy, qnh: String(qnh), atis, side, csA: abbr, cs: regDisp, freq: ad.freq },
  };
  ctx.atisText = { fr: buildAtis(ctx, 'fr'), en: buildAtis(ctx, 'en') };
  return ctx;
}

// Remplace {clé} par la forme affichée (d) ou énoncée (s) dans la langue demandée
export function render(tpl, ctx, lang, form = 'd') {
  const out = tpl.replace(/\{(\w+)\}/g, (m, k) => {
    const val = ctx.vars[k];
    if (!val) return m;
    const byLang = val.fr || val.en ? val[lang] || val.fr : val;
    return byLang[form];
  });
  // Élision française : « de Arcachon » → « d'Arcachon »
  let res = lang === 'fr' ? out.replace(/\bde (?=[AEIOUYÂÉÈÊÎÔ])/g, "d'") : out;
  // Sigles épelés pour la synthèse vocale (manuel, chap. 2.D)
  if (form === 's') res = res.replace(/\bQNH\b/g, 'Q N H').replace(/\bVFR\b/g, 'V F R').replace(/\bPAPI\b/g, 'Papi');
  return res;
}

function buildAtis(ctx, lang) {
  const { ad, atis, recTime, rwy, temp, dew, qnh, cloud, cloudH, vis, remark } = ctx;
  const lines = [];
  if (lang === 'fr') {
    lines.push(v(`Bonjour, ici ${ad.name}, information ${atis}`, `Bonjour, ici ${ad.name}, information ${PHON[atis]}`));
    lines.push(v(`Enregistrée à ${recTime} UTC`, `Enregistrée à ${digitsFR(recTime)} U T C`));
    lines.push(v(`Piste en service ${rwy}`, `Piste en service ${rwy.startsWith('0') ? digitsFR(rwy) : rwy}`));
    if (remark) lines.push(v(remark.fr.replace('{rwy}', rwy)));
    lines.push(v(`Vent ${ctx.vars.wind.fr.d}`, `Vent ${ctx.vars.wind.fr.s}`));
    if (cloud.cavok) lines.push(v('CAVOK', 'Cav O K'));
    else {
      lines.push(v(`Visibilité ${vis === 10 ? '10 kilomètres ou plus' : `${vis} kilomètres`}`));
      lines.push(v(`Nuages ${cloud.fr} ${fmtThousands(cloudH)} pieds`));
    }
    lines.push(v(`Température ${temp}, point de rosée ${dew}`, `Température ${temp < 0 ? 'moins ' + -temp : temp}, point de rosée ${dew < 0 ? 'moins ' + -dew : dew}`));
    lines.push(v(`QNH ${qnh}`, `Q N H ${qnh}`));
    lines.push(v(`Informez ${ad.name} dès le premier contact que vous avez reçu l'information ${atis}`,
      `Informez ${ad.name} dès le premier contact que vous avez reçu l'information ${PHON[atis]}`));
  } else {
    lines.push(v(`Good morning, this is ${ad.name} information ${atis}`, `Good morning, this is ${ad.name} information ${PHON[atis]}`));
    lines.push(v(`Recorded at ${recTime} UTC`, `Recorded at ${digitsEN(recTime)} U T C`));
    lines.push(v(`Runway in use ${rwy}`, `Runway in use ${digitsEN(rwy)}`));
    if (remark) lines.push(v(remark.en.replace('{rwy}', rwy), remark.en.replace('{rwy}', digitsEN(rwy))));
    lines.push(v(`Wind ${ctx.vars.wind.en.d}`, `Wind ${ctx.vars.wind.en.s}`));
    if (cloud.cavok) lines.push(v('CAVOK', 'Cav O K'));
    else {
      lines.push(v(`Visibility ${vis === 10 ? '10 kilometres or more' : `${vis} kilometres`}`,
        `Visibility ${vis === 10 ? 'one zero kilometres or more' : `${digitsEN(vis)} kilometres`}`));
      lines.push(v(`Clouds ${cloud.en} ${fmtThousands(cloudH)} feet`, `Clouds ${cloud.en} ${altEN(cloudH)} feet`));
    }
    const tEN = (t) => (t < 0 ? `minus ${digitsEN(-t)}` : digitsEN(t));
    lines.push(v(`Temperature ${temp}, dew point ${pad(dew)}`, `Temperature ${tEN(temp)}, dew point ${tEN(dew)}`));
    lines.push(v(`QNH ${qnh}`, `Q N H ${qnhEN(qnh)}`));
    lines.push(v(`Inform ${ad.name} on initial contact you have received information ${atis}`,
      `Inform ${ad.name} on initial contact you have received information ${PHON[atis]}`));
  }
  return { d: lines.map((l) => l.d).join('.\n') + '.', s: lines.map((l) => l.s).join('. ') + '.' };
}
