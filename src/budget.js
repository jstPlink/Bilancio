import { buildCells, EXPENSE_KINDS, INCOME_KINDS, SPENDING_KINDS } from './grid.js';

// Budget mensile per le spese correnti (spesa, svago, carburante) e stima fatta dall'app sui mesi già chiusi.
// Il budget sta nelle impostazioni (`settings.budgets`, `settings.savingsGoal`); la stima si ricalcola a ogni richiesta.

export const BUDGET_KINDS = ['spese', 'svago', 'carburante'];
export const ESTIMATE_MONTHS = 6; // quanti mesi chiusi, al massimo, entrano nella media

const round = (n) => Math.round(n * 100) / 100;
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

/** Solo i tre budget previsti, solo importi > 0: il resto (vuoto, zero, testo) vuol dire «nessun budget». */
export function cleanBudgets(input) {
  const out = {};
  for (const k of BUDGET_KINDS) {
    const n = Number(input?.[k]);
    if (input?.[k] != null && input[k] !== '' && n > 0) out[k] = round(n);
  }
  return out;
}

/**
 * La stima: media mensile di ciascuna voce sugli ultimi mesi chiusi (il mese in corso non c'è ancora tutto) e, da lì,
 * i budget consigliati per arrivare al risparmio voluto.
 *   disponibile = entrate medie − spese fisse medie (bollette, affitto, prestito, donazioni, tasse) − risparmio voluto
 * Se i budget abituali stanno nel disponibile, il consiglio è la media stessa; se no, si tagliano le tre voci tutte nella stessa
 * proporzione. Se nemmeno senza spese correnti si arriva al risparmio voluto, `reachable` è falso.
 */
export function estimateBudget(db, { now = new Date(), savings = db.settings?.savingsGoal ?? 0, window = ESTIMATE_MONTHS } = {}) {
  const goal = Math.max(0, Number(savings) || 0);
  const index = (y, m) => y * 12 + m - 1;
  const current = index(now.getFullYear(), now.getMonth() + 1);

  const months = new Map();
  for (const c of buildCells(db, now).values()) {
    if (c.amount == null) continue;
    const i = index(c.year, c.month);
    if (i >= current) continue;
    if (!months.has(i)) months.set(i, { income: 0, fixed: 0, spend: Object.fromEntries(BUDGET_KINDS.map((k) => [k, 0])) });
    const m = months.get(i);
    if (INCOME_KINDS.has(c.kind)) m.income += c.amount;
    else if (SPENDING_KINDS.has(c.kind)) m.spend[c.kind] += c.amount;
    else if (EXPENSE_KINDS.includes(c.kind)) m.fixed += c.amount;
  }
  // I mesi che contano sono quelli in cui c'è almeno una spesa corrente: prima non c'erano ancora movimenti della banca.
  const used = [...months.entries()]
    .filter(([, m]) => BUDGET_KINDS.some((k) => m.spend[k] > 0))
    .sort((a, b) => a[0] - b[0]).slice(-window);
  const ym = (i) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;

  const result = {
    months: used.length, from: used.length ? ym(used[0][0]) : null, to: used.length ? ym(used.at(-1)[0]) : null,
    average: null, income: null, fixed: null, savings: goal,
    available: null, savingsNoCuts: null, suggested: null, expectedSavings: null, reachable: true,
  };
  if (!used.length) return result;

  const n = used.length;
  const average = Object.fromEntries(BUDGET_KINDS.map((k) => [k, round(sum(used.map(([, m]) => m.spend[k])) / n)]));
  const incomeMonths = used.filter(([, m]) => m.income > 0);
  const income = incomeMonths.length ? round(sum(incomeMonths.map(([, m]) => m.income)) / incomeMonths.length) : null;
  const fixed = round(sum(used.map(([, m]) => m.fixed)) / n);
  const usual = sum(Object.values(average));
  Object.assign(result, { average, income, fixed });

  if (income == null) {
    // Senza entrate non si può dire quanto resta: si consiglia la media.
    result.suggested = { ...average };
    return result;
  }
  result.available = round(income - fixed - goal);
  result.savingsNoCuts = round(income - fixed - usual);
  const factor = usual > 0 ? Math.min(1, Math.max(0, result.available / usual)) : 1;
  result.suggested = Object.fromEntries(BUDGET_KINDS.map((k) => [k, factor === 1 ? average[k] : Math.round(average[k] * factor)]));
  result.expectedSavings = round(income - fixed - sum(Object.values(result.suggested)));
  result.reachable = result.available >= 0;
  return result;
}

/** Quello che serve alla pagina: budget e risparmio impostati, più la stima (anche con un risparmio diverso, per provare). */
export function budgetOverview(db, { savings, now } = {}) {
  const s = db.settings ?? {};
  return {
    budgets: cleanBudgets(s.budgets),
    savingsGoal: Number(s.savingsGoal) > 0 ? Number(s.savingsGoal) : 0,
    estimate: estimateBudget(db, { now, savings: savings ?? s.savingsGoal ?? 0 }),
  };
}
