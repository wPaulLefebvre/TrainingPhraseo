// Reconnaissance vocale (Web Speech API, gérée par Safari iOS) et synthèse vocale.

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const sttSupported = !!SR;
export const ttsSupported = 'speechSynthesis' in window;

const LANG_CODES = { fr: 'fr-FR', en: 'en-GB' };

// ── Reconnaissance ────────────────────────────────────────────────
let rec = null;
let finalText = '';

export function startListening(lang, { onText, onEnd, onError }) {
  if (!SR) { onError?.('unsupported'); return; }
  stopSpeaking();
  rec = new SR();
  rec.lang = LANG_CODES[lang];
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  finalText = '';
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript + ' ';
      else interim += r[0].transcript;
    }
    onText?.((finalText + interim).replace(/\s+/g, ' ').trim());
  };
  rec.onerror = (e) => onError?.(e.error);
  rec.onend = () => { onEnd?.(finalText.trim()); rec = null; };
  try { rec.start(); } catch (err) { onError?.(String(err)); }
}

export function stopListening() {
  if (rec) { try { rec.stop(); } catch (_) { /* déjà arrêté */ } }
}

// ── Synthèse ──────────────────────────────────────────────────────
let voicesCache = [];
function loadVoices() { voicesCache = ttsSupported ? speechSynthesis.getVoices() : []; }
if (ttsSupported) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }

export function voicesFor(lang) {
  if (!voicesCache.length) loadVoices();
  const prefix = lang === 'fr' ? 'fr' : 'en';
  return voicesCache.filter((v) => v.lang.toLowerCase().startsWith(prefix));
}

function chooseVoice(lang, wanted) {
  const list = voicesFor(lang);
  if (wanted) { const w = list.find((v) => v.voiceURI === wanted); if (w) return w; }
  const code = LANG_CODES[lang].toLowerCase();
  return list.find((v) => v.lang.toLowerCase().replace('_', '-') === code) || list[0] || null;
}

// iOS n'autorise la synthèse qu'après un geste utilisateur : on « débloque » au premier tap.
let unlocked = false;
export function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  if (ttsSupported) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); }
  getAudioCtx();
}

export function speak(text, lang, opts = {}) {
  return new Promise((resolve) => {
    if (!ttsSupported || opts.muted) { resolve(); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = LANG_CODES[lang];
    const voice = chooseVoice(lang, opts.voice);
    if (voice) u.voice = voice;
    u.rate = opts.rate || 1;
    u.pitch = opts.pitch || 1;
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    u.onend = finish;
    u.onerror = finish;
    speechSynthesis.speak(u);
    // Garde-fou : certains navigateurs ne déclenchent pas onend
    setTimeout(finish, Math.max(4000, text.length * 120));
  });
}

export function stopSpeaking() { if (ttsSupported) speechSynthesis.cancel(); }

// ── Bruit de squelch (alternat) ───────────────────────────────────
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx?.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

export function squelch(duration = 0.12, volume = 0.08) {
  const ctx = getAudioCtx();
  if (!ctx) return Promise.resolve();
  const len = Math.floor(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass'; filter.frequency.value = 1800; filter.Q.value = 0.8;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start();
  return new Promise((r) => setTimeout(r, duration * 1000 + 60));
}
