// =========================================================
// BANKLITE - PROGRESO DE NIVEL EN PUNTOS (puntos.html)
// Calcula el ancho de la barra de nivel para que coincida con las marcas
// Bronce · Plata · Oro, que están repartidas en tramos iguales (0 %, 50 %, 100 %
// con tres niveles). Usa los puntos GANADOS (data.earned), que son los que definen
// el nivel; los disponibles (data.balance) bajan al canjear y no cuentan aquí.
// Sin DOM: lo prueba scripts/puntos-progreso.test.mjs con node --test.
// =========================================================

// earned: puntos ganados · level: { index, min } · next: { min } o null si es el
// nivel más alto · levelCount: cuántos niveles (marcas) hay en la barra.
// Devuelve el porcentaje (0-100): índice del nivel + avance dentro de su tramo.
function pointsProgress(earned, level, next, levelCount) {
    const segments = Math.max(1, (Number(levelCount) || 3) - 1);
    if (!next) return 100;
    const index = Math.min(Math.max(Number(level.index) || 0, 0), segments);
    const span = next.min - level.min;
    const within = span > 0 ? Math.min(Math.max((Number(earned) - level.min) / span, 0), 1) : 0;
    return Math.min(100, ((index + within) / segments) * 100);
}
