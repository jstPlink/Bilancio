package app.bilancio.mobile;

import java.util.Arrays;
import java.util.Calendar;

/** Stampa i divisori della barra del mese per qualche mese: li legge test/weeks.test.js. */
public class WeeksCheck {
    static void line(String name, int days, int calendarDow) {
        System.out.println(name + " => " + Arrays.toString(MonthWeeks.dividers(days, MonthWeeks.mondayIndex(calendarDow))));
    }

    public static void main(String[] args) {
        line("ottobre 2026 (31 giorni, il 1 e giovedi)", 31, Calendar.THURSDAY);
        line("novembre 2026 (30 giorni, il 1 e domenica)", 30, Calendar.SUNDAY);
        line("febbraio 2027 (28 giorni, il 1 e lunedi, finisce di domenica)", 28, Calendar.MONDAY);
        line("febbraio 2028 (29 giorni, il 1 e martedi)", 29, Calendar.TUESDAY);
        line("gennaio 2027 (31 giorni, il 1 e venerdi)", 31, Calendar.FRIDAY);
        line("agosto 2027 (31 giorni, il 1 e domenica)", 31, Calendar.SUNDAY);
        System.out.println("indice lunedi/sabato/domenica => " + MonthWeeks.mondayIndex(Calendar.MONDAY) + " " + MonthWeeks.mondayIndex(Calendar.SATURDAY) + " " + MonthWeeks.mondayIndex(Calendar.SUNDAY));
    }
}
