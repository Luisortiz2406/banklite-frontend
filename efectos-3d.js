// =========================================================
// BANKLITE - EFECTOS 3D
// Inclinación de la tarjeta (dashboard.html) y de la medalla de nivel
// (puntos.html) siguiendo el puntero. Solo decorativo: en pantallas táctiles
// o con "reducir movimiento" no hace nada y el diseño queda igual.
// =========================================================

// Inclina `el` hasta `max` grados hacia el puntero y le pasa la posición del
// brillo en --mx / --my (porcentajes). Al salir el puntero vuelve suave a cero.
function tiltOnPointer(el, max) {
    if (!el) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const limit = max || 10;
    let frame = 0;
    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;

    function step() {
        x += (targetX - x) * 0.12;
        y += (targetY - y) * 0.12;
        el.style.transform = `perspective(900px) rotateX(${y.toFixed(2)}deg) rotateY(${x.toFixed(2)}deg)`;
        el.style.setProperty("--mx", `${((x / limit) * 50 + 50).toFixed(1)}%`);
        el.style.setProperty("--my", `${((-y / limit) * 50 + 50).toFixed(1)}%`);
        frame = Math.abs(targetX - x) > 0.01 || Math.abs(targetY - y) > 0.01 ? requestAnimationFrame(step) : 0;
    }

    function kick() {
        if (!frame) frame = requestAnimationFrame(step);
    }

    el.addEventListener("pointermove", event => {
        const box = el.getBoundingClientRect();
        targetX = ((event.clientX - box.left) / box.width - 0.5) * 2 * limit;
        targetY = -((event.clientY - box.top) / box.height - 0.5) * 2 * limit;
        kick();
    });

    el.addEventListener("pointerleave", () => {
        targetX = 0;
        targetY = 0;
        kick();
    });
}
