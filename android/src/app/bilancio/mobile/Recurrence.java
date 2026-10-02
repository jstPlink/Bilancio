package app.bilancio.mobile;

import java.util.Calendar;

/** Calcolo della prossima data di un promemoria ricorrente. Solo Java standard: si prova anche fuori da Android (test/recurrence.test.js). */
public final class Recurrence {
    private Recurrence() {}

    private static Calendar at(int year, int month0, int day, int hour, int minute) {
        Calendar t = Calendar.getInstance();
        t.clear();
        t.set(year, month0, 1, hour, minute, 0);
        t.set(Calendar.DAY_OF_MONTH, Math.min(day, t.getActualMaximum(Calendar.DAY_OF_MONTH))); // il 31 in un mese corto vale l'ultimo giorno
        return t;
    }

    /**
     * Prossimo scatto dopo `now` (millisecondi), oppure 0 se la ricorrenza non è valida.
     * repeat: daily | weekly | monthly | yearly. day: 1–7 (lunedì–domenica) se weekly, 1–31 se monthly o yearly. month: 1–12 se yearly.
     */
    public static long next(String repeat, int day, int month, int hour, int minute, long now) {
        Calendar base = Calendar.getInstance();
        base.setTimeInMillis(now);
        int y = base.get(Calendar.YEAR);
        int mo = base.get(Calendar.MONTH);
        int d = base.get(Calendar.DAY_OF_MONTH);
        switch (repeat) {
            case "daily": {
                Calendar t = at(y, mo, d, hour, minute);
                if (t.getTimeInMillis() <= now) t.add(Calendar.DAY_OF_MONTH, 1);
                return t.getTimeInMillis();
            }
            case "weekly": {
                int target = day == 7 ? Calendar.SUNDAY : day + 1; // 1 = lunedì … 7 = domenica
                Calendar t = at(y, mo, d, hour, minute);
                for (int i = 0; i < 9; i++) {
                    if (t.get(Calendar.DAY_OF_WEEK) == target && t.getTimeInMillis() > now) return t.getTimeInMillis();
                    t.add(Calendar.DAY_OF_MONTH, 1);
                }
                return 0;
            }
            case "monthly": {
                for (int i = 0; i < 26; i++) {
                    Calendar t = at(y, mo + i, day, hour, minute);
                    if (t.getTimeInMillis() > now) return t.getTimeInMillis();
                }
                return 0;
            }
            case "yearly": {
                for (int i = 0; i < 9; i++) {
                    Calendar t = at(y + i, month - 1, day, hour, minute);
                    if (t.getTimeInMillis() > now) return t.getTimeInMillis();
                }
                return 0;
            }
            default: return 0;
        }
    }
}
