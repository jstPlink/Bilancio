import app.bilancio.mobile.Recurrence;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.TimeZone;

// Stampa «caso => data» per test/recurrence.test.js. Ora di riferimento: venerdi 2 ottobre 2026, 10:00 a Roma.
public class RecurrenceCheck {
    static final ZoneId ROME = ZoneId.of("Europe/Rome");
    static long ms(int y, int m, int d, int h, int min) { return ZonedDateTime.of(y, m, d, h, min, 0, 0, ROME).toInstant().toEpochMilli(); }
    static String show(long t) { return t == 0 ? "0" : ZonedDateTime.ofInstant(Instant.ofEpochMilli(t), ROME).toLocalDateTime().toString(); }
    static void line(String name, long t) { System.out.println(name + " => " + show(t)); }

    public static void main(String[] a) {
        TimeZone.setDefault(TimeZone.getTimeZone(ROME));
        long now = ms(2026, 10, 2, 10, 0);
        line("giornaliero ore 9 (gia passate)", Recurrence.next("daily", 1, 1, 9, 0, now));
        line("giornaliero ore 11", Recurrence.next("daily", 1, 1, 11, 0, now));
        line("lunedi ore 9", Recurrence.next("weekly", 1, 1, 9, 0, now));
        line("venerdi ore 9 (oggi e passato)", Recurrence.next("weekly", 5, 1, 9, 0, now));
        line("venerdi ore 11 (oggi)", Recurrence.next("weekly", 5, 1, 11, 0, now));
        line("domenica ore 8", Recurrence.next("weekly", 7, 1, 8, 0, now));
        line("mensile il 5", Recurrence.next("monthly", 5, 1, 9, 0, now));
        line("mensile il 2 ore 9 (passato)", Recurrence.next("monthly", 2, 1, 9, 0, now));
        line("mensile il 31", Recurrence.next("monthly", 31, 1, 9, 0, now));
        line("mensile il 31 da novembre", Recurrence.next("monthly", 31, 1, 9, 0, ms(2026, 11, 15, 10, 0)));
        line("mensile il 31 da gennaio 31 sera", Recurrence.next("monthly", 31, 1, 9, 0, ms(2027, 1, 31, 12, 0)));
        line("mensile il 31 da febbraio 2028", Recurrence.next("monthly", 31, 1, 9, 0, ms(2028, 1, 31, 12, 0)));
        line("annuale 15 marzo", Recurrence.next("yearly", 15, 3, 9, 0, now));
        line("annuale 29 febbraio", Recurrence.next("yearly", 29, 2, 9, 0, now));
        line("annuale 2 ottobre ore 9 (passato)", Recurrence.next("yearly", 2, 10, 9, 0, now));
        line("ricorrenza sconosciuta", Recurrence.next("boh", 1, 1, 9, 0, now));
    }
}
