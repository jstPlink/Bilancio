import fs from 'node:fs/promises';
import path from 'node:path';

// Una "sorgente" è un link di condivisione Seafile (https://host/d/<token>/,
// cartella pubblica) oppure una cartella locale.

const SEAFILE_SHARE = /^(https?:\/\/[^/\s]+)\/d\/([\w-]+)/i;

export function classifySource(value) {
  const v = (value ?? '').trim().replace(/^"(.*)"$/, '$1');
  if (!v) return null;
  const m = SEAFILE_SHARE.exec(v);
  if (m) return { type: 'seafile', base: m[1], token: m[2] };
  if (/^https?:\/\//i.test(v)) {
    return { type: 'invalid', reason: 'Link non riconosciuto: usa un link di condivisione Seafile (…/d/xxxx/) o un percorso locale.' };
  }
  return { type: 'local', dir: v };
}

// ------------------------------------------------------------------- locale

async function* walkLocal(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walkLocal(full);
    else if (/\.pdf$/i.test(entry.name)) yield full;
  }
}

async function listLocal(dir) {
  const files = [];
  for await (const full of walkLocal(dir)) {
    const st = await fs.stat(full);
    files.push({
      key: `local:${full}`,
      name: path.relative(dir, full),
      version: `${st.size}-${Math.round(st.mtimeMs)}`,
      modified: st.mtime,
      read: () => fs.readFile(full),
    });
  }
  return files;
}

// ------------------------------------------------------------------ seafile

async function seafileDirents({ base, token }, dir) {
  const url = `${base}/api/v2.1/share-links/${token}/dirents/?path=${encodeURIComponent(dir)}`;
  const res = await fetch(url);
  if (res.status === 403 || res.status === 401) {
    throw new Error('Il link Seafile richiede una password o non è più valido.');
  }
  if (!res.ok) throw new Error(`Seafile ha risposto ${res.status} per ${dir}`);
  return (await res.json()).dirent_list ?? [];
}

async function listSeafile(src, dir = '/') {
  const files = [];
  for (const e of await seafileDirents(src, dir)) {
    if (e.is_dir) {
      files.push(...await listSeafile(src, e.folder_path));
    } else if (/\.pdf$/i.test(e.file_name)) {
      files.push({
        key: `seafile:${src.base}/d/${src.token}|${e.file_path}`,
        name: e.file_path.replace(/^\//, ''),
        version: `${e.size}-${e.last_modified}`,
        modified: new Date(e.last_modified),
        read: async () => {
          const res = await fetch(`${src.base}/d/${src.token}/files/?p=${encodeURIComponent(e.file_path)}&dl=1`);
          if (!res.ok) throw new Error(`Download fallito (${res.status})`);
          return Buffer.from(await res.arrayBuffer());
        },
      });
    }
  }
  return files;
}

// ------------------------------------------------------------------ comune

export async function listSource(value) {
  const src = classifySource(value);
  if (!src) return [];
  if (src.type === 'invalid') throw new Error(src.reason);
  if (src.type === 'seafile') {
    try {
      return await listSeafile(src);
    } catch (e) {
      throw new Error(e.cause ? `Seafile non raggiungibile (${src.base}): ${e.cause.code ?? e.message}` : e.message);
    }
  }
  try {
    return await listLocal(src.dir);
  } catch (e) {
    throw new Error(`Cartella non leggibile (${src.dir}): ${e.code ?? e.message}`);
  }
}

// Apertura del PDF originale dall'interfaccia.
export function openTarget(key) {
  if (key.startsWith('local:')) return { type: 'local', path: key.slice(6) };
  if (key.startsWith('seafile:')) {
    const [share, file] = key.slice(8).split('|');
    return { type: 'url', url: `${share}/files/?p=${encodeURIComponent(file)}` };
  }
  return null;
}
