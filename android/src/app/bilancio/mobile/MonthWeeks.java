package app.bilancio.mobile;

/**
 * Le settimane della barra del mese nel widget «Questo mese 2»: i divisori cadono alla fine di ogni domenica (le settimane vanno da lunedì a
 * domenica), quindi il primo e l'ultimo blocco possono essere più corti e i blocchi sono da quattro a sei, a seconda di come cade il mese.
 * La barra è proporzionale ai giorni. Classe pura, senza Android, così si prova con un test.
 */
final class MonthWeeks {
    private MonthWeeks() {}

    /** Giorno della settimana con lunedì = 0 … domenica = 6, da un valore di {@code java.util.Calendar.DAY_OF_WEEK} (domenica = 1 … sabato = 7). */
    static int mondayIndex(int calendarDayOfWeek) {
        return (calendarDayOfWeek + 5) % 7;
    }

    /**
     * I giorni dopo i quali cade un divisore: le domeniche del mese, tranne l'ultimo giorno (un divisore a fine barra non serve).
     *
     * @param days     giorni del mese (28–31)
     * @param firstDow giorno della settimana del 1°, con lunedì = 0 … domenica = 6
     */
    static int[] dividers(int days, int firstDow) {
        int[] tmp = new int[6];
        int n = 0;
        for (int d = 1; d < days; d++) {
            if ((d - 1 + firstDow) % 7 == 6) tmp[n++] = d;
        }
        return java.util.Arrays.copyOf(tmp, n);
    }
}
