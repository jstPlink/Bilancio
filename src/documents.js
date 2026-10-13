// Documenti: tre categorie (buste paga, estratti conto, bollette), ognuna con una cartella online (Seafile) condivisa con un LINK. Gli indirizzi li sceglie l'utente dalla scheda Documenti e stanno nel server (mai nel
// codice o nella documentazione). Il server legge l'elenco dei file dalla cartella e carica i nuovi file con le API pubbliche dei link di Seafile.
export const DOCUMENTS = { payslips: 'Buste paga', statements: 'Estratti conto', bills: 'Bollette' };

const clean = (v) => String(v ?? '').trim();
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

/** Controlla e normalizza i link: `input` è { chiave: { url } } (o direttamente l'indirizzo); le chiavi non inviate restano come sono. */
export function normalizeDocuments(input, current = {}) {
  const out = {};
  for (const [k, label] of Object.entries(DOCUMENTS)) {
    const now = typeof current[k] === 'string' ? current[k] : (current[k]?.url ?? '');
    const given = typeof input?.[k] === 'string' ? input[k] : input?.[k]?.url;
    out[k] = { url: given === undefined ? now : normalizeUrl(given, label) };
  }
  return out;
}

export const listDocuments = (db) => Object.entries(DOCUMENTS).map(([key, label]) => ({ key, label, url: db.settings.documents?.[key]?.url ?? '' }));

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

/**
 * Carica un file nella cartella con lo stesso link. Seafile lo permette se il link di condivisione ha il permesso di caricamento (…/d/codice/);
 * un link di caricamento (…/u/d/codice/) funziona anch'esso.
 */
export async function uploadFile(url, name, buffer, fetchImpl = fetch) {
  const share = shareOf(url);
  if (!share) throw new Error('Il link non è un link di Seafile (…/d/codice/).');
  const isUploadLink = /\/u\/d\//.test(new URL(url).pathname);
  const api = isUploadLink ? `${share.origin}/api/v2.1/upload-links/${share.token}/upload/` : `${share.origin}/api/v2.1/share-links/${share.token}/upload/?path=/`;
  const first = await fetchImpl(api, { headers: { Accept: 'application/json' } });
  if (first.status === 403 || first.status === 404) throw new Error('Questo link non permette di caricare file: in Seafile abilita il caricamento sul link di condivisione, oppure usa un link di caricamento.');
  if (!first.ok) throw new Error(`Seafile non accetta il caricamento (${first.status}).`);
  const link = (await first.json()).upload_link;
  if (!link) throw new Error('Seafile non ha dato un indirizzo di caricamento.');
  const form = new FormData();
  form.append('parent_dir', '/');
  form.append('file', new Blob([buffer]), name);
  const res = await fetchImpl(`${link}${link.includes('?') ? '&' : '?'}ret-json=1`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Caricamento non riuscito (${res.status}).`);
  return true;
}

/** Scarica un file della cartella (per leggerlo sul server). */
export async function downloadFile(url, name, fetchImpl = fetch) {
  const share = shareOf(url);
  if (!share) throw new Error('Il link non è un link di Seafile (…/d/codice/).');
  const res = await fetchImpl(`${share.origin}/d/${share.token}/files/?p=${encodeURIComponent(`/${name}`)}&dl=1`);
  if (!res.ok) throw new Error(`Non riesco a scaricare «${name}» da Seafile (${res.status}).`);
  return Buffer.from(await res.arrayBuffer());
}
