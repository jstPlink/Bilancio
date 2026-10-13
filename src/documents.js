// Documenti: tre categorie (buste paga, estratti conto, bollette), ognuna con una cartella online (Seafile) condivisa con un link di consultazione
// e, se si vuole caricare da qui, un link di caricamento. Gli indirizzi li sceglie l'utente dalla scheda Documenti e stanno nel server (mai nel
// codice o nella documentazione). Il server legge l'elenco dei file dalla cartella e carica i nuovi file con le API pubbliche dei link di Seafile.
export const DOCUMENTS = { payslips: 'Buste paga', statements: 'Estratti conto', bills: 'Bollette' };

const clean = (v) => String(v ?? '').trim();
const empty = () => ({ url: '', upload: '' });

/** Un indirizzo scritto dall'utente → indirizzo http/https completo (senza schema: https). Vuoto = ''. Lancia un errore in italiano. */
function normalizeUrl(raw, label) {
  const s = clean(raw);
  if (!s) return '';
  if (s.length > 500) throw new Error(`${label}: indirizzo troppo lungo.`);
  let url;
  try { url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`); } catch { throw new Error(`Indirizzo non valido per ${label}.`); }
  if (!/^https?:$/.test(url.protocol) || !url.hostname) throw new Error(`${label}: serve un indirizzo http o https.`);
  return url.href;
}

/** Controlla e normalizza gli indirizzi: `input` è { chiave: { url, upload } }; le chiavi o i campi non inviati restano come sono. */
export function normalizeDocuments(input, current = {}) {
  const out = {};
  for (const [k, label] of Object.entries(DOCUMENTS)) {
    const now = typeof current[k] === 'string' ? { ...empty(), url: current[k] } : { ...empty(), ...(current[k] ?? {}) };
    const given = input?.[k];
    if (given && typeof given === 'object') {
      if (given.url !== undefined) now.url = normalizeUrl(given.url, label);
      if (given.upload !== undefined) now.upload = normalizeUrl(given.upload, `${label} (caricamento)`);
    }
    out[k] = now;
  }
  return out;
}

export const listDocuments = (db) => Object.entries(DOCUMENTS).map(([key, label]) => ({ key, label, url: db.settings.documents?.[key]?.url ?? '', upload: db.settings.documents?.[key]?.upload ?? '' }));

/** Da un link di Seafile («https://sito/d/<codice>/» o «https://sito/u/d/<codice>/») all'origine e al codice; null se non lo è. */
export function shareOf(url) {
  try {
    const u = new URL(url);
    const m = /\/(?:u\/)?d\/([A-Za-z0-9]+)\/?/.exec(u.pathname);
    return m ? { origin: u.origin, token: m[1] } : null;
  } catch { return null; }
}

const FILE_LIMIT = 500;

/** I file della cartella condivisa, dal più recente per nome; ognuno con l'indirizzo per aprirlo su Seafile. */
export async function listFolder(url, fetchImpl = fetch) {
  const share = shareOf(url);
  if (!share) throw new Error('L\'indirizzo non è un link di condivisione di Seafile (…/d/codice/).');
  const res = await fetchImpl(`${share.origin}/api/v2.1/share-links/${share.token}/dirents/?path=/`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Seafile non risponde (${res.status}): controlla il link della cartella.`);
  const data = await res.json();
  const files = (data.dirent_list ?? []).filter((d) => !d.is_dir).map((d) => ({
    name: d.file_name, size: d.size ?? 0, modified: d.last_modified ?? '',
    url: `${share.origin}/d/${share.token}/files/?p=${encodeURIComponent(d.file_path)}`,
  }));
  files.sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }));
  return { folderUrl: `${share.origin}/d/${share.token}/`, files: files.slice(0, FILE_LIMIT), total: files.length };
}

/** Un nome di file accettabile: niente cartelle, niente caratteri strani; lancia un errore in italiano. */
export function cleanFileName(raw) {
  const name = clean(raw).replace(/\s+/g, ' ');
  if (!name) throw new Error('Scrivi il nome del file.');
  if (name.length > 150) throw new Error('Il nome del file è troppo lungo (al massimo 150 caratteri).');
  if (/[\\/:*?"<>|\u0000-\u001f]/.test(name) || name.startsWith('.')) throw new Error('Il nome del file non può contenere / \\ : * ? " < > | e non può iniziare con un punto.');
  return name;
}

/** Carica un file nella cartella con il link di caricamento di Seafile. */
export async function uploadFile(uploadUrl, name, buffer, fetchImpl = fetch) {
  const share = shareOf(uploadUrl);
  if (!share) throw new Error('Il link di caricamento non è valido (…/u/d/codice/).');
  const first = await fetchImpl(`${share.origin}/api/v2.1/upload-links/${share.token}/upload/`, { headers: { Accept: 'application/json' } });
  if (!first.ok) throw new Error(`Seafile non accetta il caricamento (${first.status}): controlla il link di caricamento.`);
  const link = (await first.json()).upload_link;
  if (!link) throw new Error('Seafile non ha dato un indirizzo di caricamento.');
  const form = new FormData();
  form.append('parent_dir', '/');
  form.append('file', new Blob([buffer]), name);
  const res = await fetchImpl(`${link}?ret-json=1`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Caricamento non riuscito (${res.status}).`);
  return true;
}
