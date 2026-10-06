// Réglages et historique, stockés localement sur l'appareil (localStorage).

const SETTINGS_KEY = 'phraseo.settings.v1';
const HISTORY_KEY = 'phraseo.history.v1';

const DEFAULTS = {
  engine: 'auto', // 'auto' : Claude si disponible (artefact claude.ai), sinon règles locales
  aircraft: [{ reg: '', type: 'DR400' }, { reg: '', type: 'DR400' }],
  homeAd: '',
  lang: 'fr',
  mode: 'debutant',
  rate: 1.05,
  voiceFr: '',
  voiceEn: '',
};

function read(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
function write(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; }
}

export function loadSettings() {
  const { apiKey, model, usage, ...s } = read(SETTINGS_KEY, {}); // anciens champs API supprimés
  return { ...DEFAULTS, ...s };
}
export function saveSettings(s) { write(SETTINGS_KEY, s); }

export function loadHistory() { return read(HISTORY_KEY, []); }
export function addSession(session) {
  const h = loadHistory();
  h.unshift(session);
  write(HISTORY_KEY, h.slice(0, 200));
}
export function clearHistory() { write(HISTORY_KEY, []); }
