import { SCENARIOS, RB_LABELS } from './scenarios.js';
import { AERODROMES } from './aerodromes.js';
import { buildContext, render, aircraftList, PHON } from './radio.js';
import {
  sttSupported, ttsSupported, startListening, stopListening, speak, stopSpeaking, squelch, unlockAudio, voicesFor,
} from './speech.js';
import { evaluateStep, evaluateSession, engineName, localCheck } from './evaluator.js';
import { loadSettings, saveSettings, loadHistory, addSession, clearHistory } from './storage.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const screen = $('#screen');
const settings = loadSettings();
let session = null;

// ── Façade radio ──────────────────────────────────────────────────
function setLcd({ station, freq, info, qnh } = {}) {
  $('#lcd-station').textContent = station ?? 'PHRASÉO RADIO';
  $('#lcd-freq').textContent = freq ?? '— — —';
  $('#lcd-info').textContent = info ?? '';
  $('#lcd-qnh').textContent = qnh ?? '';
}
function lamp(state) { $('#lamp').className = `lamp ${state || ''}`; }

document.addEventListener('pointerdown', unlockAudio, { once: true });

$('#btn-home').addEventListener('click', () => {
  if (session && !session.done && !confirm('Abandonner l\'exercice en cours ?')) return;
  endSessionQuietly();
  renderHome();
});
$('#btn-history').addEventListener('click', () => {
  if (session && !session.done && !confirm('Abandonner l\'exercice en cours ?')) return;
  endSessionQuietly();
  renderHistory();
});
$('#btn-settings').addEventListener('click', () => {
  if (session && !session.done && !confirm('Abandonner l\'exercice en cours ?')) return;
  endSessionQuietly();
  renderSettings();
});

function endSessionQuietly() {
  stopSpeaking();
  stopListening();
  lamp();
  if (session) session.aborted = true;
  session = null;
  setLcd();
}

// ── Accueil ───────────────────────────────────────────────────────
const MODE_HELP = {
  debutant: 'Correction après chaque transmission, réponse type disponible, messages de la station affichés.',
  experimente: 'Messages à l\'écoute seulement, aucune aide, débrief complet à la fin du scénario.',
};

function renderHome() {
  screen.innerHTML = '';
  screen.append($('#tpl-home').content.cloneNode(true));

  const syncSeg = () => {
    screen.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-checked', b.dataset.lang === settings.lang));
    screen.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-checked', b.dataset.mode === settings.mode));
    $('#mode-help').textContent = MODE_HELP[settings.mode];
  };
  screen.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => { settings.lang = b.dataset.lang; saveSettings(settings); syncSeg(); }));
  screen.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { settings.mode = b.dataset.mode; saveSettings(settings); syncSeg(); }));
  syncSeg();

  const notices = [];
  if (!aircraftList(settings).length) notices.push('Renseigne l\'immatriculation complète de tes avions (ex. F-GKAJ) pour t\'entraîner avec ton indicatif. <button data-go="settings">Ouvrir les réglages</button>');
  if (!sttSupported) notices.push('Reconnaissance vocale indisponible ici : utilise la dictée du clavier iOS (icône micro du clavier) ou tape tes transmissions.');
  const paint = () => {
    $('#notices').innerHTML = notices.map((n) => `<div class="notice">${n}</div>`).join('');
    $('#notices').querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', renderSettings));
  };
  paint();
  engineName(settings).then((eng) => {
    if (!$('#engine-line')) return;
    $('#engine-line').textContent = eng === 'claude'
      ? 'Correction par Claude, décomptée de ton utilisation Claude (aucun coût supplémentaire).'
      : 'Correction par règles locales, gratuite et hors ligne.';
  });

  const history = loadHistory();
  const groups = [...new Set(SCENARIOS.map((s) => s.group))];
  $('#scenario-list').innerHTML = groups.map((g) => `
    <h3>${esc(g)}</h3>
    ${SCENARIOS.filter((s) => s.group === g).map((s) => {
      const last = history.find((h) => h.scnId === s.id);
      return `<button class="scn" data-scn="${s.id}">
        <strong>${esc(s.title)}</strong>
        <span>${esc(s.desc)}</span>
        ${last ? `<span class="last">Dernier essai : ${last.note ?? '–'}/10, ${new Date(last.date).toLocaleDateString('fr-FR')}</span>` : ''}
      </button>`;
    }).join('')}`).join('');
  $('#scenario-list').querySelectorAll('[data-scn]').forEach((b) => b.addEventListener('click', () => {
    unlockAudio();
    startScenario(SCENARIOS.find((s) => s.id === b.dataset.scn));
  }));
  setLcd();
  window.scrollTo(0, 0);
}

// ── Session ───────────────────────────────────────────────────────
function startScenario(scn) {
  const ctx = buildContext(scn, settings);
  session = {
    scn, ctx, lang: settings.lang, mode: settings.mode, i: 0,
    attempts: {}, // index d'étape → dernière tentative { ex, ev }
    exchanges: [], prevStation: '', started: Date.now(), done: false,
  };
  const s = session;
  const kindLabel = { afis: 'AFIS', twr: 'Tour', auto: 'Auto-information' }[ctx.ad.kind];
  screen.innerHTML = `
    <section>
      <div class="session-head">
        <h2>${esc(scn.title)}</h2>
        <p>${esc(ctx.ad.full)} (${ctx.ad.oaci}), ${kindLabel}, ${s.lang === 'fr' ? 'français' : 'anglais'}, mode ${s.mode === 'debutant' ? 'débutant' : 'expérimenté'}. Indicatif ${esc(ctx.reg)}, ${esc(ctx.acType || '')}.</p>
        ${scn.note ? `<p>${esc(scn.note)}</p>` : ''}
      </div>
      <div class="log" id="log"></div>
      <div class="dock" id="dock"></div>
    </section>`;
  setLcd({ station: render('{st}', ctx, s.lang).toUpperCase(), freq: ctx.ad.freq });
  window.scrollTo(0, 0);
  runStep();
}

const logEl = () => $('#log');
const dockEl = () => $('#dock');
function appendLog(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  const node = div.firstElementChild;
  logEl().append(node);
  node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return node;
}
function setDock(html) { dockEl().innerHTML = html; }
const alive = (s) => s === session && !s.aborted;

async function runStep() {
  const s = session;
  if (!alive(s)) return;
  const step = s.scn.steps[s.i];
  if (!step) { finishSession(); return; }
  ({ atis: stepAtis, quiz: stepQuiz, st: stepStation, other: stepStation, pi: stepPilot })[step.t](step);
}
function next() { if (!session) return; session.i += 1; runStep(); }

function voiceOpts(lang) { return { rate: settings.rate, voice: lang === 'fr' ? settings.voiceFr : settings.voiceEn }; }

async function transmit(text, lang) {
  const s = session;
  lamp('rx');
  await squelch();
  if (!alive(s)) return;
  await speak(text, lang, voiceOpts(lang));
  if (!alive(s)) return;
  await squelch(0.08, 0.05);
  lamp();
}

function hiddenText(text, label = 'Afficher le texte') {
  return `<span class="hidden-text">À l'écoute uniquement. <button class="reveal" data-reveal="${esc(text)}">${label}</button></span>`;
}
function wireReveal(node) {
  node.querySelectorAll('[data-reveal]').forEach((b) => b.addEventListener('click', () => {
    const span = document.createElement('span');
    span.className = 'atis-text';
    span.textContent = b.dataset.reveal;
    b.parentElement.replaceWith(span);
  }));
}

// ATIS
async function stepAtis() {
  const s = session;
  const { ctx, lang } = s;
  const txt = ctx.atisText[lang];
  const beginner = s.mode === 'debutant';
  const node = appendLog(`<div class="msg station"><span class="who">ATIS ${esc(ctx.ad.name)}</span>
    ${beginner ? `<span class="atis-text">${esc(txt.d)}</span>` : hiddenText(txt.d)}</div>`);
  wireReveal(node);
  setLcd({ station: `ATIS ${ctx.ad.name.toUpperCase()}`, freq: ctx.ad.freq });
  const play = async () => {
    setDock(`<p class="dock-note">Diffusion de l'ATIS…</p>`);
    await transmit(txt.s, lang);
    if (!alive(s)) return;
    setDock(`<div class="actions">
      <button class="btn" id="replay">Réécouter</button>
      <button class="btn primary" id="go">${s.scn.steps[s.i + 1]?.t === 'quiz' ? 'Relever les éléments' : 'Passer sur la fréquence'}</button></div>
      ${!ttsSupported ? '<p class="dock-note">Synthèse vocale indisponible : lis le texte.</p>' : ''}`);
    $('#replay').addEventListener('click', play);
    $('#go').addEventListener('click', () => {
      stopSpeaking();
      setLcd({ station: render('{st}', ctx, lang).toUpperCase(), freq: ctx.ad.freq, info: `INFO ${ctx.atis}` });
      next();
    });
  };
  play();
}

// Relevé ATIS
function stepQuiz() {
  const s = session;
  const { ctx } = s;
  const items = [
    { k: 'atis', label: 'Lettre', expect: ctx.atis, norm: (v) => v.trim().toUpperCase().slice(0, 1) },
    { k: 'rwy', label: 'Piste', expect: ctx.rwy, norm: (v) => v.replace(/\D/g, '').padStart(2, '0') },
    { k: 'wd', label: 'Vent (direction)', expect: String(ctx.windDir).padStart(3, '0'), norm: (v) => v.replace(/\D/g, '').padStart(3, '0') },
    { k: 'ws', label: 'Vent (nœuds)', expect: String(ctx.windSpd), norm: (v) => String(+v.replace(/\D/g, '') || '') },
    { k: 'qnh', label: 'QNH', expect: String(ctx.qnh), norm: (v) => v.replace(/\D/g, '') },
    { k: 'temp', label: 'Température', expect: String(ctx.temp), norm: (v) => v.replace(/[^\d-]/g, '') },
  ];
  const node = appendLog(`<form class="quiz" id="quiz" autocomplete="off">
    ${items.map((it) => `<label>${esc(it.label)}<input name="${it.k}" inputmode="${it.k === 'atis' ? 'text' : 'numeric'}"><span class="res" data-res="${it.k}"></span></label>`).join('')}
  </form>`);
  setDock(`<div class="actions"><button class="btn primary" id="check">Vérifier</button><button class="btn" id="relisten">Réécouter l'ATIS</button></div>`);
  $('#relisten').addEventListener('click', () => transmit(ctx.atisText[s.lang].s, s.lang));
  $('#check').addEventListener('click', () => {
    let good = 0;
    const errors = [];
    items.forEach((it) => {
      const val = node.querySelector(`[name=${it.k}]`).value;
      const ok = val && it.norm(val) === it.expect;
      if (ok) good += 1;
      else errors.push({ severite: 'majeure', categorie: 'ATIS', entendu: val || 'vide', correction: it.expect, explication: `${it.label} mal relevé(e).`, source: 'manuel' });
      const res = node.querySelector(`[data-res="${it.k}"]`);
      res.textContent = ok ? '✓' : `→ ${it.expect}`;
      res.className = `res ${ok ? 'ok' : 'ko'}`;
    });
    const note = Math.round((good / items.length) * 10);
    s.attempts[s.i] = { ex: { situation: 'Relevé ATIS', transcript: '', model: ctx.atisText[s.lang].d }, ev: { note, verdict: note >= 8 ? 'correct' : note >= 5 ? 'acceptable' : 'incorrect', erreurs: errors } };
    stopSpeaking();
    setDock(`<p class="dock-note">${good}/${items.length} éléments justes.</p><div class="actions"><button class="btn primary" id="go">Terminer</button></div>`);
    $('#go').addEventListener('click', next);
  });
}

// Station ou autre aéronef
async function stepStation(step) {
  const s = session;
  const { ctx, lang } = s;
  const d = render(step[lang], ctx, lang, 'd');
  const sp = render(step[lang], ctx, lang, 's');
  const who = step.t === 'other' ? 'Autre aéronef' : render('{st}', ctx, lang);
  const beginner = s.mode === 'debutant';
  const node = appendLog(`<div class="msg ${step.t === 'other' ? 'other' : 'station'}"><span class="who">${esc(who)}</span>
    ${beginner ? esc(d) : hiddenText(d)}</div>`);
  wireReveal(node);
  if (step.t === 'st') s.prevStation = d;
  if (step[lang].includes('{qnh}')) {
    setLcd({ station: render('{st}', ctx, lang).toUpperCase(), freq: ctx.ad.freq, info: $('#lcd-info').textContent, qnh: `Q${ctx.qnh}` });
  }
  setDock(`<p class="dock-note">Réception…</p>`);
  await transmit(sp, lang);
  if (!alive(s)) return;
  next();
}

// Transmission du pilote
function buildExchange(step, transcript) {
  const s = session;
  const { ctx, lang } = s;
  return {
    kind: ctx.ad.kind, lang,
    prevStation: s.prevStation,
    situation: render(step.sit, ctx, 'fr', 'd'),
    cs: ctx.reg, csA: ctx.abbr, abbr: step.abbr,
    rb: step.rb,
    rbValues: Object.fromEntries(step.rb.map((k) => [k, k === 'side' ? (lang === 'fr' ? ctx.side : (ctx.side === 'gauche' ? 'left-hand' : 'right-hand')) : ctx.keys[k]])),
    model: render(step[lang], ctx, lang, 'd'),
    modelTpl: step[lang],
    src: step.src,
    need: step.need || [],
    urgency: step.urg || null,
    stationFirst: /^(PAN PAN, PAN PAN, PAN PAN, |MAYDAY, MAYDAY, MAYDAY, )?\{st\}/.test(step[lang]),
    stationName: render('{st}', ctx, lang, 'd'),
    acType: ctx.acType,
    fromName: ctx.from.name,
    toName: ctx.to.name,
    transcript,
  };
}

function stepPilot(step) {
  const s = session;
  const { ctx, lang } = s;
  const beginner = s.mode === 'debutant';
  const model = render(step[lang], ctx, lang, 'd');
  const node = appendLog(`<div class="sit">${esc(render(step.sit, ctx, 'fr', 'd'))}
    ${(() => { const req = step.rb.map((k) => RB_LABELS[k]); if (!step.abbr && !step.rb.includes('cs')) req.push('Indicatif complet'); return req.length ? `<span class="src">À inclure : ${req.join(', ')}</span>` : ''; })()}
    ${beginner ? `<button class="link" data-hint>Voir la réponse type</button><div class="hint" hidden>${esc(model)}${step.src === 'usage' ? '<br><small>(pratique usuelle, hors manuel)</small>' : ''}</div>` : ''}
  </div>`);
  node.querySelector('[data-hint]')?.addEventListener('click', (e) => { e.target.nextElementSibling.hidden = false; e.target.remove(); });

  setDock(`
    <textarea id="tx" placeholder="${sttSupported ? 'Maintiens le bouton et parle, ou tape ici' : 'Tape ta transmission'}" aria-label="Ta transmission"></textarea>
    <div class="dock-row">
      ${sttSupported ? `<button class="ptt" id="ptt">Alternat — maintenir pour parler</button>` : '<span class="dock-note">Saisie clavier</span>'}
      <button class="btn primary" id="send" disabled>Émettre</button>
    </div>
    <p class="dock-note" id="dock-status">${lang === 'fr' ? 'Transmission en français.' : 'Transmit in English.'}</p>`);
  const tx = $('#tx');
  const send = $('#send');
  tx.addEventListener('input', () => { send.disabled = !tx.value.trim(); });
  if (sttSupported) wirePtt($('#ptt'), tx, send, lang);
  send.addEventListener('click', () => submitPilot(step, tx.value.trim()));
}

function wirePtt(btn, tx, send, lang) {
  let listening = false, latched = false, t0 = 0;
  const status = $('#dock-status');
  const stop = () => { stopListening(); };
  const reset = () => {
    listening = false; latched = false;
    btn.classList.remove('on'); btn.textContent = 'Alternat — maintenir pour parler';
    lamp();
    send.disabled = !tx.value.trim();
  };
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (listening && latched) { stop(); return; }
    if (listening) return;
    listening = true; t0 = Date.now();
    btn.classList.add('on'); btn.textContent = 'Émission…';
    lamp('tx');
    send.disabled = true;
    startListening(lang, {
      onText: (t) => { tx.value = t; },
      onEnd: () => reset(),
      onError: (err) => {
        if (err === 'not-allowed' || err === 'service-not-allowed') status.textContent = 'Micro indisponible ici : touche la zone de texte et utilise la dictée du clavier iOS (icône micro), ou autorise le micro dans Réglages iOS › Safari.';
        else if (err === 'no-speech') status.textContent = 'Aucune voix détectée, réessaie.';
        else if (err !== 'aborted') status.textContent = `Reconnaissance vocale : ${err}`;
        reset();
      },
    });
  });
  const release = () => {
    if (!listening) return;
    if (!latched && Date.now() - t0 < 350) { // tap bref : mode bascule
      latched = true; btn.textContent = 'Touche pour arrêter';
      return;
    }
    if (!latched) stop();
  };
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointercancel', release);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
}

async function submitPilot(step, transcript) {
  const s = session;
  if (!transcript) return;
  stopListening();
  const ex = buildExchange(step, transcript);
  appendLog(`<div class="msg pilot"><span class="who">Toi</span>${esc(transcript)}</div>`);

  if (s.mode === 'experimente') {
    s.attempts[s.i] = { ex, ev: null };
    next();
    return;
  }
  setDock(`<p class="dock-note"><span class="spinner"></span>Correction en cours…</p>`);
  const ev = await evaluateStep(settings, ex);
  if (!alive(s)) return;
  s.attempts[s.i] = { ex, ev };
  appendLog(evalHtml(ev));
  setDock(`<div class="actions">
    <button class="btn" id="retry">Recommencer</button>
    <button class="btn primary" id="go">Continuer</button></div>`);
  $('#retry').addEventListener('click', () => stepPilot(step));
  $('#go').addEventListener('click', next);
}

function errWords(e) {
  const missing = !e.entendu || ['—', 'absent', 'vide'].includes(String(e.entendu).toLowerCase());
  return `${missing ? 'Manque : ' : `<s>${esc(e.entendu)}</s> `}<ins>${esc(e.correction)}</ins>`;
}

function evalHtml(ev, title) {
  const verdictLabel = { correct: 'Correct', acceptable: 'Acceptable', incorrect: 'À reprendre' }[ev.verdict] || ev.verdict;
  return `<div class="eval">
    <div class="eval-head">
      <span class="verdict ${esc(ev.verdict)}">${title ? `${esc(title)} : ` : ''}${esc(verdictLabel)}</span>
      <span class="score">${ev.note ?? '–'}/10</span>
    </div>
    <span class="local-tag">${ev.engine === 'claude' ? 'Corrigé par Claude' : 'Règles locales'}</span>
    ${ev.collationnement?.length ? `<div class="rb">${ev.collationnement.map((c) => `<span class="${c.ok ? 'ok' : 'ko'}">${c.ok ? '✓' : '✗'} ${esc(c.element)} ${esc(c.attendu)}</span>`).join('')}</div>` : ''}
    ${ev.erreurs?.length ? `<ul class="err">${ev.erreurs.map((e) => `<li class="${esc(e.severite)}">
        ${errWords(e)}
        <small>${esc(e.explication)}${e.source === 'usage' ? ' (usage, hors manuel)' : ''}</small></li>`).join('')}</ul>` : ''}
    ${ev.version_corrigee && ev.verdict !== 'correct' ? `<div class="fixed">${esc(ev.version_corrigee)}</div>` : ''}
    ${ev.commentaire ? `<p class="comment">${esc(ev.commentaire)}</p>` : ''}
  </div>`;
}

async function finishSession() {
  const s = session;
  if (!s || s.done) return;
  s.done = true;
  lamp();
  const indices = Object.keys(s.attempts).map(Number).sort((a, b) => a - b);
  let debrief = null;

  if (s.mode === 'experimente') {
    const exs = indices.filter((i) => s.scn.steps[i].t === 'pi').map((i) => s.attempts[i].ex);
    setDock(`<p class="dock-note"><span class="spinner"></span>Débrief en cours… (jusqu'à une minute avec Claude)</p>`);
    if (exs.length) {
      debrief = await evaluateSession(settings, exs, { title: s.scn.title, ad: s.ctx.ad.name, lang: s.lang });
      if (!alive(s)) return;
      const piIdx = indices.filter((i) => s.scn.steps[i].t === 'pi');
      piIdx.forEach((i, n) => { if (debrief.etapes?.[n]) s.attempts[i].ev = debrief.etapes[n]; });
    }
    indices.forEach((i) => { if (!s.attempts[i].ev) s.attempts[i].ev = localCheck(s.attempts[i].ex); });
    if (debrief) {
      appendLog(`<div class="eval">
        <div class="eval-head"><span class="verdict">Débrief</span><span class="score">${debrief.note_globale ?? '–'}/10</span></div>
        <p>${esc(debrief.synthese || '')}</p>
        ${debrief.points_forts?.length ? `<p><strong>Points forts</strong></p><ul class="recurring">${debrief.points_forts.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
        ${debrief.axes_de_progres?.length ? `<p><strong>Axes de progrès</strong></p><ul class="recurring">${debrief.axes_de_progres.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
      </div>`);
    }
    indices.filter((i) => s.scn.steps[i].t === 'pi').forEach((i, n) => {
      const a = s.attempts[i];
      appendLog(`<div><div class="msg pilot"><span class="who">Transmission ${n + 1} — ${esc(a.ex.situation)}</span>${esc(a.ex.transcript)}</div>${evalHtml(a.ev)}</div>`);
    });
  }

  const evs = indices.map((i) => s.attempts[i].ev).filter(Boolean);
  const note = debrief?.note_globale ?? (evs.length ? Math.round(evs.reduce((t, e) => t + (e.note || 0), 0) / evs.length * 10) / 10 : null);
  const errors = indices.flatMap((i) => (s.attempts[i].ev?.erreurs || []).map((e) => ({ ...e, step: i })));

  addSession({
    id: `${Date.now()}`, date: new Date().toISOString(), scnId: s.scn.id, title: s.scn.title,
    ad: s.ctx.ad.name, lang: s.lang, mode: s.mode, note, reg: s.ctx.reg,
    synthese: debrief?.synthese || '',
    errors: errors.map(({ severite, categorie, entendu, correction, explication, step }) => ({ severite, categorie, entendu, correction, explication, step })),
    steps: indices.map((i) => ({ situation: s.attempts[i].ex.situation, transcript: s.attempts[i].ex.transcript, model: s.attempts[i].ex.model, note: s.attempts[i].ev?.note, verdict: s.attempts[i].ev?.verdict })),
  });

  appendLog(`<div class="eval"><div class="eval-head"><span class="verdict">Fin de l'exercice</span><span class="score">${note ?? '–'}/10</span></div>
    <p class="comment">${errors.filter((e) => e.severite === 'majeure').length} erreur(s) majeure(s), ${errors.filter((e) => e.severite !== 'majeure').length} remarque(s). Session enregistrée dans l'historique.</p></div>`);
  setDock(`<div class="actions">
    <button class="btn primary" id="again">Refaire avec d'autres conditions</button>
    <button class="btn" id="home">Autres exercices</button></div>`);
  $('#again').addEventListener('click', () => startScenario(s.scn));
  $('#home').addEventListener('click', () => { session = null; renderHome(); });
}

// ── Historique ────────────────────────────────────────────────────
function renderHistory() {
  setLcd({ station: 'HISTORIQUE', freq: '' });
  const h = loadHistory();
  if (!h.length) {
    screen.innerHTML = `<section><h2>Historique</h2><p class="empty">Aucune session pour l'instant. Termine un exercice pour suivre ta progression ici.</p>
      <button class="btn primary" id="back">Choisir un exercice</button></section>`;
    $('#back').addEventListener('click', renderHome);
    return;
  }
  const recent = h.slice(0, 20);
  const notes = recent.map((x) => x.note).filter((n) => n != null);
  const avg = notes.length ? (notes.reduce((a, b) => a + b, 0) / notes.length).toFixed(1) : '–';
  const cats = {};
  recent.forEach((x) => x.errors.forEach((e) => { cats[e.categorie] = (cats[e.categorie] || 0) + 1; }));
  const catList = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  const max = catList[0]?.[1] || 1;
  const corr = {};
  recent.forEach((x) => x.errors.filter((e) => e.severite !== 'conseil').forEach((e) => {
    const key = e.explication;
    corr[key] = corr[key] || { n: 0, e };
    corr[key].n += 1;
  }));
  const recurring = Object.values(corr).filter((c) => c.n > 1).sort((a, b) => b.n - a.n).slice(0, 5);

  screen.innerHTML = `<section>
    <h2>Historique</h2>
    <p>${h.length} session(s). Moyenne des 20 dernières : <strong>${avg}/10</strong>.</p>
    ${catList.length ? `<h3>Types d'erreurs récents</h3>${catList.map(([c, n]) => `<div class="bar"><span>${esc(c)}</span><i style="width:${Math.round((n / max) * 100)}%"></i><span>${n}</span></div>`).join('')}` : ''}
    ${recurring.length ? `<h3>Erreurs qui reviennent</h3><ul class="recurring">${recurring.map((c) => `<li>${esc(c.e.explication)} <small>(${c.n} fois)</small></li>`).join('')}</ul>` : ''}
    <h3>Sessions</h3>
    ${h.map((x) => `<details class="hist-item">
      <summary><span><strong>${esc(x.title)}</strong><br><span class="meta">${new Date(x.date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}, ${esc(x.ad)}, ${x.lang.toUpperCase()}, ${x.mode === 'debutant' ? 'débutant' : 'expérimenté'}</span></span>
      <span class="score">${x.note ?? '–'}/10</span></summary>
      ${x.synthese ? `<p class="comment">${esc(x.synthese)}</p>` : ''}
      ${x.steps.filter((st) => st.transcript).map((st) => `<div class="msg pilot" style="margin-top:8px"><span class="who">${esc(st.situation)} (${st.note ?? '–'}/10)</span>${esc(st.transcript)}<div class="fixed">${esc(st.model)}</div></div>`).join('')}
      ${x.errors.length ? `<ul class="err">${x.errors.map((e) => `<li class="${esc(e.severite)}">${errWords(e)}<small>${esc(e.explication)}</small></li>`).join('')}</ul>` : ''}
    </details>`).join('')}
    <div class="actions" style="margin-top:18px">
      <button class="btn" id="export">Exporter (JSON)</button>
      <button class="btn" id="clear">Effacer l'historique</button>
    </div>
  </section>`;
  $('#export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(h, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `phraseo-historique-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('#clear').addEventListener('click', () => {
    if (confirm('Effacer tout l\'historique ? Cette action est définitive.')) { clearHistory(); renderHistory(); }
  });
  window.scrollTo(0, 0);
}

// ── Réglages ──────────────────────────────────────────────────────
function renderSettings() {
  setLcd({ station: 'RÉGLAGES', freq: '' });
  const afis = AERODROMES.filter((a) => a.kind === 'afis');
  const voiceSelect = (lang, cur) => {
    const list = voicesFor(lang);
    return `<select data-voice="${lang}"><option value="">Automatique</option>${list.map((v) => `<option value="${esc(v.voiceURI)}" ${v.voiceURI === cur ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('')}</select>`;
  };
  screen.innerHTML = `<section class="form">
    <h2>Réglages</h2>

    <h3>Avions</h3>
    ${settings.aircraft.map((a, i) => `<div class="pair">
      <label class="field"><span>Immatriculation ${i + 1}</span><input data-ac="${i}" data-f="reg" value="${esc(a.reg)}" placeholder="F-GKAJ" autocapitalize="characters" autocomplete="off"></label>
      <label class="field"><span>Type</span><input data-ac="${i}" data-f="type" value="${esc(a.type)}" placeholder="DR400"></label>
    </div>`).join('')}
    <label class="field"><span>Terrain de base (AFIS)</span>
      <select id="homeAd"><option value="">Aucun</option>${afis.map((a) => `<option value="${a.oaci}" ${a.oaci === settings.homeAd ? 'selected' : ''}>${esc(a.full)}</option>`).join('')}</select>
      <small>Proposé plus souvent dans les exercices AFIS.</small></label>

    <h3>Correction</h3>
    <label class="field"><span>Moteur de correction</span>
      <select id="engine">
        <option value="auto" ${settings.engine !== 'local' ? 'selected' : ''}>Claude si disponible, sinon règles locales</option>
        <option value="local" ${settings.engine === 'local' ? 'selected' : ''}>Toujours les règles locales</option>
      </select>
      <small id="engineInfo"></small></label>

    <h3>Voix</h3>
    <label class="field"><span>Débit de parole : <output id="rateOut">${settings.rate.toFixed(2)}</output></span>
      <input id="rate" type="range" min="0.8" max="1.4" step="0.05" value="${settings.rate}"></label>
    <label class="field"><span>Voix française</span>${voiceSelect('fr', settings.voiceFr)}</label>
    <label class="field"><span>Voix anglaise</span>${voiceSelect('en', settings.voiceEn)}</label>
    <div class="actions"><button class="btn" data-test="fr">Écouter (FR)</button><button class="btn" data-test="en">Écouter (EN)</button></div>
    <p class="dock-note" style="color:var(--ink-soft)">Sur iPhone, des voix de meilleure qualité se téléchargent dans Réglages › Accessibilité › Contenu énoncé › Voix.</p>

    <button class="btn primary" id="done">Enregistrer et revenir</button>
  </section>`;

  const save = () => saveSettings(settings);
  screen.querySelectorAll('[data-ac]').forEach((inp) => inp.addEventListener('input', () => {
    const val = inp.dataset.f === 'reg' ? inp.value.toUpperCase().trim() : inp.value.trim();
    settings.aircraft[+inp.dataset.ac][inp.dataset.f] = val;
    save();
  }));
  $('#homeAd').addEventListener('change', (e) => { settings.homeAd = e.target.value; save(); });
  const showEngine = () => engineName({ engine: 'auto' }).then((eng) => {
    $('#engineInfo').textContent = eng === 'claude'
      ? 'Claude est disponible ici : les corrections sont décomptées de ton utilisation Claude, sans facturation à part. Au premier appel, claude.ai te demande l\'autorisation.'
      : 'Claude n\'est pas disponible ici (version GitHub ou hors ligne) : correction par règles locales, gratuite. Ouvre l\'app publiée dans claude.ai pour la correction par Claude.';
  });
  showEngine();
  $('#engine').addEventListener('change', (e) => { settings.engine = e.target.value; save(); });
  $('#rate').addEventListener('input', (e) => { settings.rate = +e.target.value; $('#rateOut').textContent = settings.rate.toFixed(2); save(); });
  screen.querySelectorAll('[data-voice]').forEach((sel) => sel.addEventListener('change', () => {
    settings[sel.dataset.voice === 'fr' ? 'voiceFr' : 'voiceEn'] = sel.value; save();
  }));
  screen.querySelectorAll('[data-test]').forEach((b) => b.addEventListener('click', () => {
    unlockAudio();
    const l = b.dataset.test;
    speak(l === 'fr' ? 'Fox Alfa Juliett, piste deux neuf libre, vent deux huit zéro degrés, huit nœuds.' : 'Fox Alfa Juliett, runway two niner free, wind two eight zero degrees, eight knots.', l, voiceOpts(l));
  }));
  $('#done').addEventListener('click', renderHome);
  window.scrollTo(0, 0);
}

// ── Démarrage ─────────────────────────────────────────────────────
if ('serviceWorker' in navigator && location.protocol === 'https:' && !window.claude) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
renderHome();
