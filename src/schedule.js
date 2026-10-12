// Orari dell'aggiornamento automatico delle banche (ora italiana, anche se il server gira in UTC) e date «italiane».
// MYBANK_AUTO_HOURS accetta un elenco di ore separato da virgole (es. «5,11,14,19»).
export const AUTO_HOURS = String(process.env.MYBANK_AUTO_HOURS ?? '5,11,14,19').split(',').map((h) => Number(h.trim())).filter((h) => Number.isInteger(h) && h >= 0 && h < 24);
export const TZ = process.env.MYBANK_TZ ?? 'Europe/Rome';

// Differenza (ms) tra l'ora locale del fuso e UTC in quell'istante: +7200000 per l'Italia d'estate.
function offsetAt(ts, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(fmt.formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ts / 1000) * 1000;
}

/** Il prossimo istante in cui, nel fuso dato, l'orologio segna `hour`:00. Tiene conto dell'ora legale. */
export function nextDailyRun(now = new Date(), hour = AUTO_HOURS[0] ?? 5, timeZone = TZ) {
  const ts = now.getTime();
  const d = new Date(ts + offsetAt(ts, timeZone));
  let target = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, 0, 0);
  if (target - offsetAt(ts, timeZone) <= ts) target += 86400000; // oggi è già passato: domani
  // l'ora legale può cambiare tra adesso e quell'ora: si ricalcola con lo scarto di quell'istante
  let at = target - offsetAt(target - offsetAt(ts, timeZone), timeZone);
  if (at <= ts) at += 86400000;
  return new Date(at);
}

/** Il prossimo istante tra quelli di tutti gli orari dati. */
export function nextRun(now = new Date(), hours = AUTO_HOURS, timeZone = TZ) {
  return new Date(Math.min(...hours.map((h) => nextDailyRun(now, h, timeZone).getTime())));
}

/** Data e ora «italiane» di un istante: { year, month (1-12), day, hour, minute, iso: 'AAAA-MM-GG', daysInMonth }. */
export function localParts(now = new Date(), timeZone = TZ) {
  const ts = now.getTime();
  const d = new Date(ts + offsetAt(ts, timeZone));
  const year = d.getUTCFullYear(), month = d.getUTCMonth() + 1, day = d.getUTCDate();
  const pad = (n) => String(n).padStart(2, '0');
  return { year, month, day, hour: d.getUTCHours(), minute: d.getUTCMinutes(), iso: `${year}-${pad(month)}-${pad(day)}`, daysInMonth: new Date(Date.UTC(year, month, 0)).getUTCDate() };
}
