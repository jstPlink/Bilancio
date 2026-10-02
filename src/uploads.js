// Documenti caricati a mano dall'app: scelta del tipo (estratto conto, bolletta, busta paga) e nome del file.
import { PLACES, PLACE_KINDS } from './grid.js';

export const UPLOAD_TYPES = ['estratto', 'bolletta', 'busta'];
export const UPLOAD_BILL_KINDS = [...PLACE_KINDS];

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Legge e controlla i parametri della richiesta (query string): tipo, nome, e per le bollette il tipo di utenza e la casa.
export function parseUploadRequest(query = {}) {
  const type = String(query.type ?? '');
  if (!UPLOAD_TYPES.includes(type)) throw new Error('Scegli che tipo di documento è: estratto conto, bolletta o busta paga.');
  const name = String(query.name ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!name) throw new Error('Scrivi un nome per il documento.');
  const info = { type, name };
  if (type === 'bolletta') {
    const kind = String(query.kind ?? '');
    if (!UPLOAD_BILL_KINDS.includes(kind)) throw new Error('Scegli che bolletta è: acqua, luce, gas o wifi.');
    const place = String(query.place ?? PLACES[0]);
    if (!PLACES.includes(place)) throw new Error('Casa non valida.');
    Object.assign(info, { kind, place });
  }
  return info;
}

// Nome mostrato in Documenti. La casa è la prima cartella del nome (come per le bollette lette dalle cartelle).
export function uploadedDocName({ type, name, place }) {
  const file = /\.(pdf|csv)$/i.test(name) ? name : `${name}.${type === 'estratto' ? 'csv' : 'pdf'}`;
  return type === 'bolletta' && place ? `${cap(place)}/${file}` : file;
}

export const isPdf = (buffer) => buffer.subarray(0, 5).toString('latin1') === '%PDF-';
