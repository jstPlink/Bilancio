// Orari dell'aggiornamento automatico delle banche: ogni giorno alle 5:00, 12:00 e 17:00 (ora italiana, anche se il server gira in UTC).
// `BILANCIO_AUTO_READ_HOUR` accetta un'ora o un elenco separato da virgole (es. «5,12,17»).
export const AUTO_READ_HOURS = String(process.env.BILANCIO_AUTO_READ_HOUR ?? '5,12,17').split(',').map((h) => Number(h.trim())).filter((h) => Number.isInteger(h) && h >= 0 && h < 24);
export const AUTO_READ_HOUR = AUTO_READ_HOURS[0] ?? 5;
export const AUTO_READ_TZ = process.env.BILANCIO_TZ ?? 'Europe/Rome';

// Differenza (ms) tra l'ora locale del fuso e UTC in quell'istante: +7200000 per l'Italia d'estate.
function offsetAt(ts, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(fmt.formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ts / 1000) * 1000;
}

/** Il prossimo istante in cui, nel fuso dato, l'orologio segna `hour`:00. Tiene conto dell'ora legale. */
export function nextDailyRun(now = new Date(), hour = AUTO_READ_HOUR, timeZone = AUTO_READ_TZ) {
  const ts = now.getTime();
  const local = ts + offsetAt(ts, timeZone);
  const d = new Date(local);
  let target = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, 0, 0);
  if (target - offsetAt(ts, timeZone) <= ts) target += 86400000; // oggi è già passato: domani
  // l'ora legale può cambiare tra adesso e quell'ora: si ricalcola con lo scarto di quell'istante
  let at = target - offsetAt(target - offsetAt(ts, timeZone), timeZone);
  if (at <= ts) at += 86400000;
  return new Date(at);
}

/** Il prossimo istante tra quelli di tutti gli orari dati. */
export function nextRun(now = new Date(), hours = AUTO_READ_HOURS, timeZone = AUTO_READ_TZ) {
  return new Date(Math.min(...hours.map((h) => nextDailyRun(now, h, timeZone).getTime())));
}
